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
as $$
  select jsonb_build_object('token', encode(gen_random_bytes(32), 'hex'), 'facilityId', p_facility_id);
$$;
