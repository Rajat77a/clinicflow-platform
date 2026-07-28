-- Validate patient assignments without exposing staff directory rows to receptionists.

begin;

create or replace function public.register_patient(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_sex text,
  p_phone text,
  p_doctor_user_id uuid,
  p_idempotency_key text
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
begin
  prior := private.claim_command(p_idempotency_key, 'register-patient');
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
    raise exception 'Invalid patient sex'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from private.active_doctor_assignment(p_doctor_user_id)
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
    id,
    hospital_id,
    medical_record_number,
    first_name,
    last_name,
    date_of_birth,
    sex,
    phone,
    created_by
  )
  values (
    patient_id,
    hospital,
    mrn,
    trim(p_first_name),
    trim(p_last_name),
    p_date_of_birth,
    p_sex,
    nullif(trim(p_phone), ''),
    auth.uid()
  );

  insert into public.patient_care_teams (
    patient_id,
    staff_user_id,
    relationship,
    assigned_by
  )
  values (patient_id, p_doctor_user_id, 'primary_doctor', auth.uid());

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', patient_id)
  );
  return patient_id;
end;
$$;

revoke all on function public.register_patient(text, text, date, text, text, uuid, text)
  from public, anon;
grant execute on function public.register_patient(text, text, date, text, text, uuid, text)
  to authenticated;

commit;
