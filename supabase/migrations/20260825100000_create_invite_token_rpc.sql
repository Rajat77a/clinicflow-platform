create or replace function public.create_staff_invite_token(
  p_email text,
  p_full_name text,
  p_phone text default '',
  p_role_code text,
  p_hospital_id uuid,
  p_facility_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with resolved_facility as (
    select id from public.facilities
    where hospital_id = p_hospital_id and active = true
    order by created_at limit 1
  ),
  new_facility as (
    insert into public.facilities (hospital_id, code, name, active)
    select p_hospital_id, 'MAIN',
      coalesce((select name from public.hospitals where id = p_hospital_id), 'Clinic') || ' Main Facility',
      true
    where not exists (select 1 from resolved_facility)
    returning id
  ),
  facility as (
    select id from resolved_facility
    union all
    select id from new_facility
  ),
  hospital as (
    select name, email, phone, address from public.hospitals where id = p_hospital_id
  ),
  tok as (
    insert into public.invite_tokens (
      email, full_name, phone, role_code, hospital_id, facility_id,
      token, clinic_name, clinic_email, clinic_phone, clinic_address
    )
    select
      trim(lower(p_email)), trim(p_full_name), p_phone, p_role_code,
      p_hospital_id, (select id from facility limit 1),
      encode(gen_random_bytes(32), 'hex'),
      h.name, h.email, h.phone,
      case when h.address is not null then h.address::text else null end
    from hospital h
    returning token, facility_id
  )
  select jsonb_build_object('token', t.token, 'facilityId', t.facility_id) from tok t;
$$;
