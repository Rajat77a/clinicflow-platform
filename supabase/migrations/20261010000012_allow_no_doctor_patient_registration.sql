-- Allow creating patients without a doctor

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
  SECURITY DEFINER
  SET search_path = 'public', 'extensions'
AS $$
DECLARE
  hospital uuid;
  patient_id uuid;
BEGIN
  IF private.check_command(p_idempotency_key) THEN
    RETURN (
      SELECT entity_id::uuid
      FROM public.audit_events
      WHERE idempotency_key = p_idempotency_key
        AND action = 'patient.registered'
      LIMIT 1
    );
  END IF;

  hospital := private.current_hospital_id();
  IF hospital IS NULL THEN
    RAISE EXCEPTION 'A clinic workspace is required' USING errcode = '23502';
  END IF;

  IF NOT private.has_permission('patients.create') THEN
    RAISE EXCEPTION 'Permission denied' USING errcode = '42501';
  END IF;

  IF p_doctor_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM private.active_doctor_assignment(p_doctor_user_id)
    ) THEN
      RAISE EXCEPTION 'Assigned doctor is not active in this hospital'
        USING errcode = '23503';
    END IF;
  END IF;

  INSERT INTO public.patients (
    hospital_id,
    first_name,
    last_name,
    date_of_birth,
    sex,
    phone,
    blood_group,
    email,
    whatsapp_phone,
    address,
    emergency_contact_name,
    emergency_contact_phone,
    allergies,
    chronic_conditions,
    registered_by
  )
  VALUES (
    hospital,
    trim(p_first_name),
    trim(p_last_name),
    p_date_of_birth,
    p_sex,
    trim(p_phone),
    trim(p_blood_group),
    lower(trim(p_email)),
    trim(p_whatsapp_phone),
    trim(p_address),
    trim(p_emergency_contact_name),
    trim(p_emergency_contact_phone),
    p_allergies,
    p_chronic_conditions,
    auth.uid()
  )
  RETURNING id INTO patient_id;

  IF p_doctor_user_id IS NOT NULL THEN
    INSERT INTO public.patient_care_teams (
      patient_id, staff_user_id, relationship, assigned_by
    )
    VALUES (patient_id, p_doctor_user_id, 'primary_doctor', auth.uid());
  END IF;

  PERFORM private.finish_command(
    p_idempotency_key,
    'patient.registered',
    'patient',
    patient_id::text
  );

  RETURN patient_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
