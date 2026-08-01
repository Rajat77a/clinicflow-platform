-- Preserve every supported patient-registration field and keep doctor assignment
-- naming consistent with the directory query. The legacy RPC remains available
-- during rolling frontend deployments.

begin;

alter table public.patients
  add column if not exists whatsapp_phone text;

create or replace function public.register_patient_with_details(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_sex text,
  p_phone text,
  p_doctor_user_id uuid,
  p_idempotency_key text,
  p_blood_group text,
  p_email text,
  p_whatsapp_phone text,
  p_address text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text,
  p_allergies text[],
  p_chronic_conditions text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior jsonb;
  hospital uuid := private.current_hospital_id();
  patient_id uuid := extensions.gen_random_uuid();
  mrn text;
  normalized_allergies text[];
  normalized_conditions text[];
begin
  prior := private.claim_command(p_idempotency_key, 'register-patient-with-details');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if nullif(trim(p_first_name), '') is null
    or nullif(trim(p_last_name), '') is null
    or p_date_of_birth is null
    or p_date_of_birth > current_date
  then
    raise exception 'Valid patient name and date of birth are required'
      using errcode = '22023';
  end if;

  if p_sex is not null
    and p_sex not in ('female', 'male', 'intersex', 'unknown', 'not_disclosed')
  then
    raise exception 'Invalid patient sex' using errcode = '22023';
  end if;

  if nullif(trim(p_blood_group), '') is not null
    and trim(p_blood_group) not in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
  then
    raise exception 'Invalid blood group' using errcode = '22023';
  end if;

  if char_length(coalesce(p_phone, '')) > 40
    or char_length(coalesce(p_whatsapp_phone, '')) > 40
    or char_length(coalesce(p_email, '')) > 254
    or char_length(coalesce(p_address, '')) > 1000
    or char_length(coalesce(p_emergency_contact_name, '')) > 200
    or char_length(coalesce(p_emergency_contact_phone, '')) > 40
  then
    raise exception 'Patient contact details exceed the allowed length'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into normalized_allergies
  from (
    select trim(item) as value, ordinal
    from unnest(coalesce(p_allergies, '{}'::text[])) with ordinality as entries(item, ordinal)
    where nullif(trim(item), '') is not null
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into normalized_conditions
  from (
    select trim(item) as value, ordinal
    from unnest(coalesce(p_chronic_conditions, '{}'::text[])) with ordinality as entries(item, ordinal)
    where nullif(trim(item), '') is not null
  ) normalized;

  if cardinality(normalized_allergies) > 20
    or cardinality(normalized_conditions) > 20
    or exists (select 1 from unnest(normalized_allergies || normalized_conditions) item where char_length(item) > 200)
  then
    raise exception 'Patient medical lists exceed the allowed size'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from private.active_doctor_assignment(p_doctor_user_id)
  ) then
    raise exception 'Assigned doctor is not active in this hospital'
      using errcode = '23503';
  end if;

  mrn := format(
    'CF-%s-%s',
    extract(year from current_date)::integer,
    lpad(nextval('public.medical_record_number_seq')::text, 7, '0')
  );

  insert into public.patients (
    id, hospital_id, medical_record_number, first_name, last_name,
    date_of_birth, sex, blood_group, phone, email, whatsapp_phone,
    address, emergency_contact, allergies, chronic_conditions, created_by
  )
  values (
    patient_id, hospital, mrn, trim(p_first_name), trim(p_last_name),
    p_date_of_birth, p_sex, nullif(trim(p_blood_group), ''),
    nullif(trim(p_phone), ''), nullif(trim(p_email), ''),
    nullif(trim(p_whatsapp_phone), ''),
    jsonb_build_object('line', coalesce(trim(p_address), '')),
    jsonb_build_object(
      'name', coalesce(trim(p_emergency_contact_name), ''),
      'phone', coalesce(trim(p_emergency_contact_phone), '')
    ),
    normalized_allergies, normalized_conditions, auth.uid()
  );

  insert into public.patient_care_teams (
    patient_id, staff_user_id, relationship, assigned_by
  )
  values (patient_id, p_doctor_user_id, 'primary_doctor', auth.uid());

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', patient_id)
  );
  return patient_id;
end;
$$;

revoke all on function public.register_patient_with_details(
  text, text, date, text, text, uuid, text, text, text, text, text,
  text, text, text[], text[]
) from public, anon;
grant execute on function public.register_patient_with_details(
  text, text, date, text, text, uuid, text, text, text, text, text,
  text, text, text[], text[]
) to authenticated;

create or replace function public.search_patients(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  hospital_id uuid,
  medical_record_number text,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  phone text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  version integer,
  doctor_user_id uuid,
  doctor_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_patients as (
    select
      p.id, p.hospital_id, p.medical_record_number, p.first_name, p.last_name,
      p.date_of_birth, p.sex, p.phone, p.status, p.created_at, p.updated_at,
      p.version, assigned.staff_user_id as doctor_user_id, assigned.doctor_name
    from public.patients p
    left join lateral (
      select team.staff_user_id, profile.display_name as doctor_name
      from public.patient_care_teams team
      left join public.profiles profile on profile.id = team.staff_user_id
      where team.patient_id = p.id
        and team.active
        and team.relationship in ('primary_doctor', 'primary')
      order by team.assigned_at desc
      limit 1
    ) assigned on true
    where nullif(btrim(p_query), '') is null
      or concat_ws(
        ' ', p.id::text, p.medical_record_number, p.first_name, p.last_name, p.phone
      ) ilike '%' || btrim(p_query) || '%'
  )
  select visible_patients.*, count(*) over () as total_count
  from visible_patients
  order by created_at desc, id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

commit;
