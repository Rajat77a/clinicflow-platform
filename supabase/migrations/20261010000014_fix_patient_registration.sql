-- Restore the original register_patient_with_details but allow p_doctor_user_id to be null

CREATE OR REPLACE FUNCTION public.register_patient_with_details(
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  prior jsonb;
  hospital uuid := private.current_hospital_id();
  patient_id uuid := extensions.gen_random_uuid();
  mrn text;
  normalized_allergies text[];
  normalized_conditions text[];
BEGIN
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

  if p_doctor_user_id is not null and not exists (
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

  if p_doctor_user_id is not null then
    insert into public.patient_care_teams (
      patient_id, staff_user_id, relationship, assigned_by
    )
    values (patient_id, p_doctor_user_id, 'primary_doctor', auth.uid());
  end if;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', patient_id)
  );
  return patient_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_patient_with_details(
  text, text, date, text, text, uuid, text, text, text, text, text,
  text, text, text[], text[]
) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_patient_with_details(
  text, text, date, text, text, uuid, text, text, text, text, text,
  text, text, text[], text[]
) TO authenticated;
NOTIFY pgrst, 'reload schema';
