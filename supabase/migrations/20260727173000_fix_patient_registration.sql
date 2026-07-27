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

create or replace function private.active_doctor_assignment(target_doctor_user_id uuid)
returns table (
  assignment_facility_id uuid,
  assignment_department_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(m.facility_id, fallback_facility.id),
    m.department_id
  from public.staff_memberships m
  left join lateral (
    select f.id
    from public.facilities f
    where f.hospital_id = private.current_hospital_id()
      and f.active
    order by f.created_at
    limit 1
  ) fallback_facility on true
  where private.has_permission('appointments.write')
    and m.user_id = target_doctor_user_id
    and m.hospital_id = private.current_hospital_id()
    and m.role_code = 'doctor'
    and m.active
  limit 1
$$;

revoke all on function private.active_doctor_assignment(uuid) from public, anon;
grant execute on function private.active_doctor_assignment(uuid) to authenticated;

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

  select assignment_facility_id, assignment_department_id
  into facility, department
  from private.active_doctor_assignment(p_doctor_user_id);

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

revoke all on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text)
  from public, anon;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, integer, text, text, text)
  to authenticated;
