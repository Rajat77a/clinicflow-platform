-- Atomic application commands. These functions run with the caller's privileges,
-- so table grants and RLS remain the final authorization boundary.

alter table public.staff_memberships
  add column specialty text,
  add column shift text;

create sequence public.medical_record_number_seq;
revoke all on sequence public.medical_record_number_seq from public, anon;
grant usage, select on sequence public.medical_record_number_seq to authenticated;

create or replace function public.list_active_doctors()
returns table (
  user_id uuid,
  display_name text,
  specialty text,
  email text,
  phone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.display_name, m.specialty, p.email, p.phone
  from public.staff_memberships m
  join public.profiles p on p.id = m.user_id
  where m.hospital_id = private.current_hospital_id()
    and m.role_code = 'doctor'
    and m.active
    and private.has_permission('appointments.read')
  order by p.display_name
$$;

create or replace function private.claim_command(
  command_key text,
  command_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hospital uuid := private.current_hospital_id();
  prior_response jsonb;
begin
  if auth.uid() is null or hospital is null then
    raise exception 'An active hospital membership is required'
      using errcode = '42501';
  end if;
  if char_length(command_key) not between 16 and 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  insert into public.idempotency_keys (
    hospital_id,
    actor_user_id,
    key,
    command,
    expires_at
  )
  values (
    hospital,
    auth.uid(),
    command_key,
    command_name,
    now() + interval '24 hours'
  )
  on conflict (hospital_id, actor_user_id, key) do nothing;

  if not found then
    select response_body
    into prior_response
    from public.idempotency_keys
    where hospital_id = hospital
      and actor_user_id = auth.uid()
      and key = command_key
      and command = command_name;

    if prior_response is null then
      raise exception 'Idempotency key is already used by another command'
        using errcode = '23505';
    end if;
  end if;

  return prior_response;
end;
$$;

create or replace function private.finish_command(
  command_key text,
  response jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.idempotency_keys
  set response_code = 200,
      response_body = response
  where hospital_id = private.current_hospital_id()
    and actor_user_id = auth.uid()
    and key = command_key
$$;

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
  patient_id uuid;
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

  if not exists (
    select 1
    from public.staff_memberships
    where user_id = p_doctor_user_id
      and hospital_id = hospital
      and role_code = 'doctor'
      and active
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
    hospital,
    mrn,
    trim(p_first_name),
    trim(p_last_name),
    p_date_of_birth,
    p_sex,
    nullif(trim(p_phone), ''),
    auth.uid()
  )
  returning id into patient_id;

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

create or replace function public.book_appointment(
  p_patient_id uuid,
  p_doctor_user_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_reason text,
  p_administrative_notes text,
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
  facility uuid;
  department uuid;
  appointment_id uuid;
begin
  prior := private.claim_command(p_idempotency_key, 'book-appointment');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if p_starts_at < now() - interval '5 minutes'
    or p_duration_minutes not between 5 and 480
    or nullif(trim(p_reason), '') is null
  then
    raise exception 'Invalid appointment time, duration, or reason'
      using errcode = '22023';
  end if;

  select coalesce(m.facility_id, f.id), m.department_id
  into facility, department
  from public.staff_memberships m
  left join lateral (
    select id
    from public.facilities
    where hospital_id = hospital and active
    order by created_at
    limit 1
  ) f on true
  where m.user_id = p_doctor_user_id
    and m.hospital_id = hospital
    and m.role_code = 'doctor'
    and m.active;

  if facility is null then
    raise exception 'The doctor has no active hospital facility'
      using errcode = '23503';
  end if;

  insert into public.appointments (
    hospital_id,
    facility_id,
    department_id,
    patient_id,
    doctor_user_id,
    starts_at,
    ends_at,
    reason,
    administrative_notes,
    created_by
  )
  values (
    hospital,
    facility,
    department,
    p_patient_id,
    p_doctor_user_id,
    p_starts_at,
    p_starts_at + make_interval(mins => p_duration_minutes),
    trim(p_reason),
    nullif(trim(p_administrative_notes), ''),
    auth.uid()
  )
  returning id into appointment_id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', appointment_id)
  );
  return appointment_id;
end;
$$;

create or replace function public.update_appointment(
  p_appointment_id uuid,
  p_expected_version integer,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_status text,
  p_reason text,
  p_administrative_notes text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
begin
  if p_duration_minutes not between 5 and 480 then
    raise exception 'Invalid appointment duration' using errcode = '22023';
  end if;

  update public.appointments
  set starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => p_duration_minutes),
      status = p_status,
      reason = trim(p_reason),
      administrative_notes = nullif(trim(p_administrative_notes), '')
  where id = p_appointment_id
    and version = p_expected_version
  returning version into next_version;

  if next_version is null then
    raise exception 'Appointment changed since it was loaded'
      using errcode = '40001';
  end if;
  return next_version;
end;
$$;

create or replace function public.sign_prescription(
  p_patient_id uuid,
  p_diagnosis text,
  p_clinical_notes text,
  p_follow_up_at timestamptz,
  p_medicines jsonb,
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
  encounter_id uuid;
  prescription_id uuid;
  inserted_items integer;
begin
  prior := private.claim_command(p_idempotency_key, 'sign-prescription');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if nullif(trim(p_diagnosis), '') is null
    or jsonb_typeof(p_medicines) <> 'array'
    or jsonb_array_length(p_medicines) = 0
  then
    raise exception 'Diagnosis and at least one medicine are required'
      using errcode = '22023';
  end if;

  insert into public.encounters (
    hospital_id,
    patient_id,
    clinician_user_id,
    status,
    clinical_notes,
    diagnoses,
    completed_at
  )
  values (
    hospital,
    p_patient_id,
    auth.uid(),
    'completed',
    nullif(trim(p_clinical_notes), ''),
    array[trim(p_diagnosis)],
    now()
  )
  returning id into encounter_id;

  insert into public.prescriptions (
    hospital_id,
    encounter_id,
    patient_id,
    prescriber_user_id,
    status,
    instructions,
    follow_up_at
  )
  values (
    hospital,
    encounter_id,
    p_patient_id,
    auth.uid(),
    'draft',
    nullif(trim(p_clinical_notes), ''),
    p_follow_up_at
  )
  returning id into prescription_id;

  insert into public.prescription_items (
    prescription_id,
    medicine_name,
    dosage,
    frequency,
    duration,
    instructions
  )
  select
    prescription_id,
    trim(item ->> 'name'),
    trim(item ->> 'dosage'),
    trim(item ->> 'frequency'),
    trim(item ->> 'duration'),
    nullif(trim(item ->> 'instructions'), '')
  from jsonb_array_elements(p_medicines) item
  where nullif(trim(item ->> 'name'), '') is not null
    and nullif(trim(item ->> 'dosage'), '') is not null
    and nullif(trim(item ->> 'frequency'), '') is not null
    and nullif(trim(item ->> 'duration'), '') is not null;

  get diagnostics inserted_items = row_count;
  if inserted_items <> jsonb_array_length(p_medicines) then
    raise exception 'Every medicine requires name, dosage, frequency, and duration'
      using errcode = '22023';
  end if;

  update public.prescriptions
  set status = 'signed',
      signed_at = now()
  where id = prescription_id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', prescription_id)
  );
  return prescription_id;
end;
$$;

create or replace function public.record_lab_result(
  p_patient_id uuid,
  p_test_name text,
  p_result jsonb,
  p_interpretation text,
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
  order_id uuid;
  result_id uuid;
begin
  prior := private.claim_command(p_idempotency_key, 'record-lab-result');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if nullif(trim(p_test_name), '') is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'Test name and structured result are required'
      using errcode = '22023';
  end if;

  insert into public.lab_orders (
    hospital_id,
    patient_id,
    ordered_by,
    test_code,
    test_name,
    status,
    completed_at
  )
  values (
    hospital,
    p_patient_id,
    auth.uid(),
    'MANUAL',
    trim(p_test_name),
    'completed',
    now()
  )
  returning id into order_id;

  insert into public.lab_results (
    lab_order_id,
    result,
    interpretation,
    status,
    recorded_by,
    verified_by,
    verified_at
  )
  values (
    order_id,
    p_result,
    nullif(trim(p_interpretation), ''),
    'final',
    auth.uid(),
    auth.uid(),
    now()
  )
  returning id into result_id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', result_id)
  );
  return result_id;
end;
$$;

create or replace function public.create_invoice(
  p_patient_id uuid,
  p_description text,
  p_amount numeric,
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
  invoice_id uuid;
  invoice_number text;
begin
  prior := private.claim_command(p_idempotency_key, 'create-invoice');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if p_amount <= 0 or nullif(trim(p_description), '') is null then
    raise exception 'Invoice description and positive amount are required'
      using errcode = '22023';
  end if;

  invoice_number := format(
    'INV-%s-%s',
    to_char(current_date, 'YYYYMMDD'),
    upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))
  );

  insert into public.invoices (
    hospital_id,
    patient_id,
    invoice_number,
    status,
    subtotal,
    issued_at,
    due_at,
    created_by
  )
  values (
    hospital,
    p_patient_id,
    invoice_number,
    'draft',
    p_amount,
    now(),
    now() + interval '30 days',
    auth.uid()
  )
  returning id into invoice_id;

  insert into public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price
  )
  values (invoice_id, trim(p_description), 1, p_amount);

  update public.invoices
  set status = 'issued'
  where id = invoice_id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', invoice_id)
  );
  return invoice_id;
end;
$$;

revoke all on function private.claim_command(text, text) from public, anon;
revoke all on function private.finish_command(text, jsonb) from public, anon;
revoke all on function public.list_active_doctors() from public, anon;
grant execute on function private.claim_command(text, text) to authenticated;
grant execute on function private.finish_command(text, jsonb) to authenticated;
grant execute on function public.list_active_doctors() to authenticated;

revoke all on function public.register_patient(text, text, date, text, text, uuid, text) from public, anon;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text) from public, anon;
revoke all on function public.update_appointment(uuid, integer, timestamptz, integer, text, text, text) from public, anon;
revoke all on function public.sign_prescription(uuid, text, text, timestamptz, jsonb, text) from public, anon;
revoke all on function public.record_lab_result(uuid, text, jsonb, text, text) from public, anon;
revoke all on function public.create_invoice(uuid, text, numeric, text) from public, anon;

grant execute on function public.register_patient(text, text, date, text, text, uuid, text) to authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text) to authenticated;
grant execute on function public.update_appointment(uuid, integer, timestamptz, integer, text, text, text) to authenticated;
grant execute on function public.sign_prescription(uuid, text, text, timestamptz, jsonb, text) to authenticated;
grant execute on function public.record_lab_result(uuid, text, jsonb, text, text) to authenticated;
grant execute on function public.create_invoice(uuid, text, numeric, text) to authenticated;
