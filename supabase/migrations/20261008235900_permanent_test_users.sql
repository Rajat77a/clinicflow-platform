-- 1. Create a hospital for testing
insert into public.hospitals (id, name, legal_name, slug, timezone, currency, locale)
values (
  '00000000-0000-0000-0000-000000000001',
  'ClinicFlow Test Hospital',
  'ClinicFlow Test Hospital',
  'clinicflow-test-hospital',
  'Asia/Kolkata',
  'INR',
  'en-IN'
)
on conflict (slug) do nothing;

insert into public.facilities (id, hospital_id, code, name)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'TEST_MAIN',
  'Main Test Facility'
)
on conflict (hospital_id, code) do nothing;

-- 2. Create the users in auth.users
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values 
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clinic.admin@clinicflow.test', crypt('Cf!Admin#2026R7x', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Clinic Admin"}', now(), now(), '', '', '', ''),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'doctor@clinicflow.test', crypt('Cf!Doctor#2026M9q', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Doctor"}', now(), now(), '', '', '', ''),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reception@clinicflow.test', crypt('Cf!Front#2026K4v', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Test Receptionist"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- 3. Create profiles
insert into public.profiles (id, email, full_name, phone)
values
  ('11111111-1111-1111-1111-111111111111', 'clinic.admin@clinicflow.test', 'Test Clinic Admin', '+1234567890'),
  ('22222222-2222-2222-2222-222222222222', 'doctor@clinicflow.test', 'Test Doctor', '+1234567891'),
  ('33333333-3333-3333-3333-333333333333', 'reception@clinicflow.test', 'Test Receptionist', '+1234567892')
on conflict (id) do nothing;

-- 4. Create staff memberships
insert into public.staff_memberships (user_id, hospital_id, facility_id, role_code, active, status)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'clinic_admin', true, 'Active'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'doctor', true, 'Active'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'receptionist', true, 'Active')
on conflict (user_id) do nothing;

-- 5. Modify deletion RPCs to protect these users
create or replace function public.soft_delete_staff_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_hospital_id uuid;
  v_email text;
  v_actor_role text := 'clinic_admin';
begin
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account' using errcode = '22023';
  end if;

  select lower(email) into v_email
  from public.profiles
  where id = p_user_id;

  if v_email in ('clinic.admin@clinicflow.test', 'doctor@clinicflow.test', 'reception@clinicflow.test') or v_email like '%super_admin%' then
    raise exception 'Cannot delete permanent test accounts' using errcode = '22023';
  end if;

  select hospital_id into v_hospital_id
  from public.staff_memberships
  where user_id = p_user_id;

  if private.is_platform_admin() then
    v_actor_role := 'super_admin';
  elsif (v_hospital_id is null or v_hospital_id = private.current_hospital_id()) and private.has_permission('people.manage') then
    v_actor_role := 'clinic_admin';
  else
    raise exception 'Access denied: insufficient permissions to manage staff' using errcode = '42501';
  end if;

  -- Deactivate membership and mark soft-deleted
  update public.staff_memberships
  set active = false,
      status = 'Inactive',
      deleted_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  -- Deactivate patient care team assignments
  update public.patient_care_teams
  set active = false
  where staff_user_id = p_user_id;

  -- Invalidate any pending invite tokens
  if v_email is not null then
    update public.invite_tokens
    set expires_at = now() - interval '1 second'
    where lower(email) = v_email and used_at is null;
  end if;

  -- Ban Supabase Auth user to disable login
  update auth.users
  set banned_until = '3000-01-01 00:00:00+00'::timestamptz,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true}'::jsonb,
      updated_at = now()
  where id = p_user_id;

  -- Insert audit event
  if v_hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.soft_deleted', 'staff_membership', p_user_id::text
    );
  end if;
end;
$$;

create or replace function public.permanently_delete_staff_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_hospital_id uuid;
  v_email text;
  v_actor_role text := 'clinic_admin';
begin
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account' using errcode = '22023';
  end if;

  select lower(email) into v_email
  from public.profiles
  where id = p_user_id;

  if v_email in ('clinic.admin@clinicflow.test', 'doctor@clinicflow.test', 'reception@clinicflow.test') or v_email like '%super_admin%' then
    raise exception 'Cannot delete permanent test accounts' using errcode = '22023';
  end if;

  select hospital_id into v_hospital_id
  from public.staff_memberships
  where user_id = p_user_id;

  if private.is_platform_admin() then
    v_actor_role := 'super_admin';
  elsif (v_hospital_id is null or v_hospital_id = private.current_hospital_id()) and private.has_permission('people.manage') then
    v_actor_role := 'clinic_admin';
  else
    raise exception 'Access denied: insufficient permissions to manage staff' using errcode = '42501';
  end if;

  -- Deactivate patient care team assignments
  update public.patient_care_teams
  set active = false
  where staff_user_id = p_user_id;

  -- Invalidate and remove invite tokens
  if v_email is not null then
    delete from public.invite_tokens where lower(email) = v_email;
  end if;

  -- Deactivate and mark membership inactive
  update public.staff_memberships
  set active = false,
      status = 'Inactive',
      deleted_at = now(),
      updated_at = now()
  where user_id = p_user_id;

  -- Ban Supabase Auth user and scramble credentials to permanently block login
  update auth.users
  set banned_until = '3000-01-01 00:00:00+00'::timestamptz,
      encrypted_password = 'DELETED_' || encode(extensions.gen_random_bytes(32), 'hex'),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true, "permanently_deleted": true}'::jsonb,
      updated_at = now()
  where id = p_user_id;

  begin
    delete from public.staff_memberships where user_id = p_user_id;
  exception when others then
    -- It's fine if foreign keys block full row deletion, the ban is what matters
    null;
  end;

  -- Insert audit event
  if v_hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.permanently_deleted', 'staff_membership', p_user_id::text
    );
  end if;
end;
$$;
