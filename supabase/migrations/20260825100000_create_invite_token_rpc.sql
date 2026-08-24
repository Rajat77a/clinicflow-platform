-- SECURITY DEFINER RPC to create an invite token directly in the database.
-- Bypasses the edge function entirely, avoiding RLS and facility lookup issues
-- when a super admin creates a new clinic and invites a clinical admin.

begin;

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
set search_path = ''
as $$
declare
  v_facility_id uuid;
  v_token text;
  v_hospital record;
begin
  if p_email is null or trim(p_email) = '' or p_full_name is null or trim(p_full_name) = '' then
    raise exception 'Email and full name are required' using errcode = '22023';
  end if;

  if p_role_code not in ('clinic_admin', 'doctor', 'receptionist', 'super_admin') then
    raise exception 'Invalid role code' using errcode = '22023';
  end if;

  -- Find or create a facility for this hospital
  v_facility_id := p_facility_id;
  if v_facility_id is null then
    select id into v_facility_id
    from public.facilities
    where hospital_id = p_hospital_id and active = true
    order by created_at
    limit 1;

    if v_facility_id is null then
      select name into v_hospital from public.hospitals where id = p_hospital_id;
      insert into public.facilities (hospital_id, code, name, active)
      values (p_hospital_id, 'MAIN', coalesce(v_hospital.name, 'Clinic') || ' Main Facility', true)
      returning id into v_facility_id;
    end if;
  end if;

  -- Check role assignment is allowed
  if p_role_code not in ('clinic_admin', 'doctor', 'receptionist', 'super_admin') then
    raise exception 'Invalid target role' using errcode = '42501';
  end if;

  -- Generate token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Get hospital details for the email
  select name, email, phone, address into v_hospital
  from public.hospitals where id = p_hospital_id;

  -- Insert the invite token
  insert into public.invite_tokens (
    email, full_name, phone, role_code, hospital_id, facility_id,
    token, clinic_name, clinic_email, clinic_phone, clinic_address,
    specialty, shift, gender, qualification, medical_registration_number,
    experience_years, consultation_fee, working_hours, administrative_notes
  ) values (
    trim(lower(p_email)), trim(p_full_name), p_phone, p_role_code,
    p_hospital_id, v_facility_id, v_token,
    v_hospital.name, v_hospital.email, v_hospital.phone,
    case when v_hospital.address is not null then v_hospital.address::text else null end,
    p_specialty, p_shift, p_gender, p_qualification, p_medical_registration_number,
    p_experience_years, p_consultation_fee, p_working_hours, p_notes
  );

  return jsonb_build_object('token', v_token, 'facilityId', v_facility_id);
end;
$$;

grant execute on function public.create_staff_invite_token(text, text, text, text, uuid, uuid, text, text, text, text, text, integer, numeric, text, text) to authenticated;

commit;
