-- Run this script in the Supabase SQL Editor to create or update all invitation, user deletion, and trash RPCs.
-- This sets up table columns, indexes, and security-definer RPCs directly in the database.

-- 1. Ensure columns exist on staff_memberships and invite_tokens
alter table public.invite_tokens alter column hospital_id drop not null;
alter table public.staff_memberships add column if not exists status text default 'Active';
alter table public.staff_memberships add column if not exists deleted_at timestamptz default null;

-- 2. Staff Invitation Creation RPC
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

-- 3. Soft Delete Staff Member RPC
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

  select lower(email) into v_email
  from public.profiles
  where id = p_user_id;

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

grant execute on function public.soft_delete_staff_member(uuid) to authenticated, service_role;

-- 4. Restore Staff Member RPC
create or replace function public.restore_staff_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  v_hospital_id uuid;
  v_actor_role text := 'clinic_admin';
begin
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

  -- Reactivate membership
  update public.staff_memberships
  set active = true,
      status = 'Active',
      deleted_at = null,
      updated_at = now()
  where user_id = p_user_id;

  -- Unban Supabase Auth user
  update auth.users
  set banned_until = null,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'banned' - 'deleted',
      updated_at = now()
  where id = p_user_id;

  -- Insert audit event
  if v_hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.restored', 'staff_membership', p_user_id::text
    );
  end if;
end;
$$;

grant execute on function public.restore_staff_member(uuid) to authenticated, service_role;

-- 5. Permanently Delete Staff User RPC
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

  select lower(email) into v_email
  from public.profiles
  where id = p_user_id;

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
      encrypted_password = 'DELETED_' || encode(gen_random_bytes(32), 'hex'),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true, "permanently_deleted": true}'::jsonb,
      updated_at = now()
  where id = p_user_id;

  begin
    delete from public.staff_memberships where user_id = p_user_id;
  exception when others then
    null;
  end;

  begin
    delete from auth.users where id = p_user_id;
  exception when others then
    null;
  end;

  if v_hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.permanently_deleted', 'staff_membership', p_user_id::text
    );
  end if;
end;
$$;

grant execute on function public.permanently_delete_staff_user(uuid) to authenticated, service_role;
