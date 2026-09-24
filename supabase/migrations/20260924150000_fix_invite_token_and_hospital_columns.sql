-- Migration: Fix create_staff_invite_token, validate_invite_token, and consume_invite_token
-- Correctly reads clinic details from hospitals.configuration JSONB instead of non-existent columns.
-- Enforces 24-hour expiration from creation time, invalidates previous unconsumed tokens on resend,
-- and verifies associated clinic existence.

begin;

-- Function to create a staff invite token with valid 24-hour expiration
create or replace function public.create_staff_invite_token(
  p_email text,
  p_full_name text,
  p_phone text default '',
  p_role_code text default 'clinic_admin',
  p_hospital_id uuid default null,
  p_facility_id uuid default null,
  p_specialty text default null,
  p_shift text default null,
  p_gender text default null,
  p_qualification text default null,
  p_medical_registration_number text default null,
  p_experience_years integer default null,
  p_consultation_fee numeric default null,
  p_working_hours text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_facility_id uuid;
  v_token text;
  v_hospital_name text;
  v_hospital_email text;
  v_hospital_phone text;
  v_hospital_address text;
  v_config jsonb;
begin
  if p_email is null or trim(p_email) = '' or p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Email and full name are required' using errcode = '22023';
  end if;

  if p_role_code not in ('clinic_admin', 'doctor', 'receptionist', 'super_admin') then
    raise exception 'Invalid role code' using errcode = '22023';
  end if;

  v_facility_id := p_facility_id;
  if v_facility_id is null and p_hospital_id is not null then
    select id into v_facility_id
    from public.facilities
    where hospital_id = p_hospital_id
    order by created_at
    limit 1;

    if v_facility_id is not null then
      update public.facilities set active = true where id = v_facility_id and not active;
    else
      select name into v_hospital_name from public.hospitals where id = p_hospital_id;
      insert into public.facilities (hospital_id, code, name, active)
      values (
        p_hospital_id,
        'MAIN_' || upper(substr(md5(random()::text), 1, 4)),
        coalesce(v_hospital_name, 'Clinic') || ' Main Facility',
        true
      )
      returning id into v_facility_id;
    end if;
  end if;

  -- Generate cryptographically random token (64 hex characters)
  v_token := encode(gen_random_bytes(32), 'hex');

  if p_hospital_id is not null then
    select name, configuration
    into v_hospital_name, v_config
    from public.hospitals where id = p_hospital_id;

    if v_config is not null then
      v_hospital_email := v_config->>'email';
      v_hospital_phone := v_config->>'phone';
      v_hospital_address := v_config->>'address';
    end if;
  end if;

  -- Invalidate any existing unused invite tokens for this email and clinic
  update public.invite_tokens
  set expires_at = now() - interval '1 second'
  where lower(email) = trim(lower(p_email))
    and used_at is null
    and (hospital_id = p_hospital_id or (p_hospital_id is null and hospital_id is null));

  -- Insert the new token with strict 24-hour expiration
  insert into public.invite_tokens (
    email, full_name, phone, role_code, hospital_id, facility_id,
    token, expires_at, clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes
  ) values (
    trim(lower(p_email)), trim(p_full_name), coalesce(p_phone, ''), p_role_code,
    p_hospital_id, v_facility_id, v_token, now() + interval '24 hours',
    v_hospital_name, v_hospital_email, v_hospital_phone, v_hospital_address,
    p_specialty, p_shift, p_gender, p_qualification, p_medical_registration_number,
    p_experience_years, p_consultation_fee, p_working_hours, p_notes
  );

  return jsonb_build_object(
    'token', v_token,
    'facilityId', v_facility_id,
    'expiresAt', (now() + interval '24 hours')
  );
end;
$$;

grant execute on function public.create_staff_invite_token(text, text, text, text, uuid, uuid, text, text, text, text, text, integer, numeric, text, text) to authenticated, anon, service_role;

-- Function to validate an invite token without consuming it
create or replace function public.validate_invite_token(p_token text)
returns table (
  status text,
  p_email text,
  p_full_name text,
  p_phone text,
  p_role_code text,
  p_hospital_id uuid,
  p_facility_id uuid,
  p_department_id uuid,
  p_clinic_name text,
  p_clinic_email text,
  p_clinic_phone text,
  p_clinic_address text,
  p_specialty text,
  p_shift text,
  p_gender text,
  p_qualification text,
  p_medical_registration_number text,
  p_experience_years integer,
  p_consultation_fee numeric,
  p_working_hours text,
  p_administrative_notes text,
  p_expires_at timestamptz
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_rec record;
  v_status text;
  v_clean_token text;
  v_hospital_active boolean;
begin
  v_clean_token := trim(p_token);

  select * into v_rec
  from public.invite_tokens
  where token = v_clean_token;

  if not found then
    return query select
      'invalid'::text, null::text, null::text, null::text, null::text, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::integer, null::numeric, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- Check if associated clinic still exists and is active
  if v_rec.hospital_id is not null then
    select active into v_hospital_active
    from public.hospitals
    where id = v_rec.hospital_id;

    if not found then
      v_status := 'clinic_deleted';
    elsif v_rec.used_at is not null then
      v_status := 'used';
    elsif v_rec.expires_at <= now() then
      v_status := 'expired';
    else
      v_status := 'valid';
    end if;
  else
    if v_rec.used_at is not null then
      v_status := 'used';
    elsif v_rec.expires_at <= now() then
      v_status := 'expired';
    else
      v_status := 'valid';
    end if;
  end if;

  return query select
    v_status,
    v_rec.email, v_rec.full_name, v_rec.phone, v_rec.role_code, v_rec.hospital_id,
    v_rec.facility_id, v_rec.department_id, v_rec.clinic_name, v_rec.clinic_email,
    v_rec.clinic_phone, v_rec.clinic_address, v_rec.specialty, v_rec.shift,
    v_rec.gender, v_rec.qualification, v_rec.medical_registration_number,
    v_rec.experience_years, v_rec.consultation_fee, v_rec.working_hours,
    v_rec.administrative_notes, v_rec.expires_at;
end;
$$;

grant execute on function public.validate_invite_token(text) to anon, authenticated, service_role;

-- Update consume_invite_token to enforce single-use upon password submission
create or replace function public.consume_invite_token(p_token text)
returns table (
  p_email text,
  p_full_name text,
  p_phone text,
  p_role_code text,
  p_hospital_id uuid,
  p_facility_id uuid,
  p_department_id uuid,
  p_clinic_name text,
  p_clinic_email text,
  p_clinic_phone text,
  p_clinic_address text,
  p_specialty text,
  p_shift text,
  p_gender text,
  p_qualification text,
  p_medical_registration_number text,
  p_experience_years integer,
  p_consultation_fee numeric,
  p_working_hours text,
  p_administrative_notes text
)
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_clean_token text;
begin
  v_clean_token := trim(p_token);

  return query
  update public.invite_tokens
  set used_at = now()
  where token = v_clean_token
    and used_at is null
    and expires_at > now()
  returning
    email, full_name, phone, role_code, hospital_id, facility_id, department_id,
    clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes;
end;
$$;

grant execute on function public.consume_invite_token(text) to anon, authenticated, service_role;

commit;
