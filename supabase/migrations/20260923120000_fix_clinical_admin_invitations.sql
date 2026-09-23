-- Migration: 24-hour invitation token validation and single-use consumption

begin;

-- Function to validate an invite token without consuming it (used when displaying the setup page)
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
set search_path = ''
as $$
declare
  v_rec record;
  v_status text;
begin
  select * into v_rec
  from public.invite_tokens
  where token = p_token;

  if not found then
    return query select
      'invalid'::text, null::text, null::text, null::text, null::text, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::integer, null::numeric, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_rec.used_at is not null then
    v_status := 'used';
  elsif v_rec.expires_at <= now() then
    v_status := 'expired';
  else
    v_status := 'valid';
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

-- Grant permissions for validate_invite_token
grant execute on function public.validate_invite_token(text) to anon, authenticated, service_role;

-- Update consume_invite_token to verify token is unused and unexpired before marking used
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

grant execute on function public.consume_invite_token(text) to anon, authenticated, service_role;

commit;
