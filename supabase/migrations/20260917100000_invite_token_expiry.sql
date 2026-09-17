-- Add 24-hour expiry to invite tokens.
-- Tokens expire 24 hours after creation unless consumed.

begin;

-- Add expires_at column with a default of 24 hours from creation
ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

-- Update existing tokens that have no expiry to expire 24 hours from now
UPDATE public.invite_tokens
SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL;

-- Update consume_invite_token to check expiry
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
set search_path = ''
as $$
begin
  return query
  update public.invite_tokens
  set used_at = now()
  where token = p_token
    and used_at is null
    and expires_at > now()
  returning
    email, full_name, phone, role_code, hospital_id, facility_id, department_id,
    clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes;
end;
$$;

-- Update create_staff_invite_token to set expires_at
create or replace function public.create_staff_invite_token(
  p_email text,
  p_full_name text,
  p_phone text default '',
  p_role_code text,
  p_hospital_id uuid,
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
  v_hospital_address jsonb;
begin
  if p_email is null or trim(p_email) = '' or p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Email and full name are required' using errcode = '22023';
  end if;

  if p_role_code not in ('clinic_admin', 'doctor', 'receptionist', 'super_admin') then
    raise exception 'Invalid role code' using errcode = '22023';
  end if;

  v_facility_id := p_facility_id;
  if v_facility_id is null then
    select id into v_facility_id
    from public.facilities
    where hospital_id = p_hospital_id and active = true
    order by created_at
    limit 1;

    if v_facility_id is null then
      select name into v_hospital_name from public.hospitals where id = p_hospital_id;
      insert into public.facilities (hospital_id, code, name, active)
      values (p_hospital_id, 'MAIN', coalesce(v_hospital_name, 'Clinic') || ' Main Facility', true)
      returning id into v_facility_id;
    end if;
  end if;

  v_token := private.generate_invite_token();

  select name, email, phone, address
  into v_hospital_name, v_hospital_email, v_hospital_phone, v_hospital_address
  from public.hospitals where id = p_hospital_id;

  insert into public.invite_tokens (
    email, full_name, phone, role_code, hospital_id, facility_id,
    token, expires_at, clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes
  ) values (
    trim(lower(p_email)), trim(p_full_name), p_phone, p_role_code,
    p_hospital_id, v_facility_id, v_token, now() + interval '24 hours',
    v_hospital_name, v_hospital_email, v_hospital_phone,
    case when v_hospital_address is not null then v_hospital_address::text else null end,
    p_specialty, p_shift, p_gender, p_qualification, p_medical_registration_number,
    p_experience_years, p_consultation_fee, p_working_hours, p_notes
  );

  return jsonb_build_object('token', v_token, 'facilityId', v_facility_id);
end;
$$;

commit;
