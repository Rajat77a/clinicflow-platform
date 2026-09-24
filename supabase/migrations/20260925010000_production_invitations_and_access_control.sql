-- Migration: Production Invitation Flow, User Deletion, and Hospital Access Control
-- 1. Adds status and deleted_at columns to staff_memberships.
-- 2. Updates create_staff_invite_token with 24-hour expiration and invalidates prior unused tokens.
-- 3. Updates validate_invite_token with comprehensive status returns ('valid', 'invalid', 'expired', 'used', 'clinic_deleted').
-- 4. Introduces activate_invited_user RPC to atomically create/update auth.users, profiles, and staff_memberships.
-- 5. Introduces soft_delete_staff_member, restore_staff_member, and permanently_delete_staff_user RPCs.
-- 6. Hardens RLS policies on staff_memberships, profiles, facilities, and invite_tokens for Super Admin global access and Clinical Admin single-hospital isolation.
-- 7. Updates list_current_staff and list_active_doctors_with_counts to support Super Admin global queries and filter inactive/deleted users.

begin;

-- Step 1: Ensure columns on staff_memberships and invite_tokens
alter table public.staff_memberships add column if not exists status text default 'Active';
alter table public.staff_memberships add column if not exists deleted_at timestamptz default null;
alter table public.invite_tokens alter column hospital_id drop not null;

-- Step 2: create_staff_invite_token RPC
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

-- Step 3: validate_invite_token RPC
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
  v_hospital_config jsonb;
begin
  v_clean_token := trim(p_token);

  select * into v_rec
  from public.invite_tokens
  where lower(trim(token)) = lower(v_clean_token);

  if not found then
    return query select
      'invalid'::text, null::text, null::text, null::text, null::text, null::uuid, null::uuid, null::uuid,
      null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::integer, null::numeric, null::text, null::text, null::timestamptz;
    return;
  end if;

  -- Check if associated clinic still exists and is active
  if v_rec.hospital_id is not null then
    select active, configuration into v_hospital_active, v_hospital_config
    from public.hospitals
    where id = v_rec.hospital_id;

    if not found or not v_hospital_active or (v_hospital_config is not null and v_hospital_config ? 'deleted_at') then
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

-- Step 4: Atomic Password Activation RPC
create or replace function public.activate_invited_user(
  p_token text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions', 'private'
as $$
declare
  v_rec record;
  v_user_id uuid;
  v_clean_token text;
  v_hospital_active boolean;
  v_hospital_config jsonb;
  v_existing_user_id uuid;
begin
  v_clean_token := trim(p_token);

  if v_clean_token is null or v_clean_token = '' then
    return jsonb_build_object('success', false, 'error', 'No invitation token was provided');
  end if;

  if p_password is null or char_length(p_password) < 8 then
    return jsonb_build_object('success', false, 'error', 'Password must be at least 8 characters');
  end if;

  -- 1. Validate token
  select * into v_rec
  from public.invite_tokens
  where lower(trim(token)) = lower(v_clean_token)
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'This invitation link is invalid');
  end if;

  -- 2. Confirm unused
  if v_rec.used_at is not null then
    return jsonb_build_object('success', false, 'error', 'This invitation link has already been used');
  end if;

  -- 3. Confirm unexpired
  if v_rec.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'This invitation link has expired');
  end if;

  -- 4. Confirm clinic exists and is active
  if v_rec.hospital_id is not null then
    select active, configuration into v_hospital_active, v_hospital_config
    from public.hospitals
    where id = v_rec.hospital_id;

    if not found or not v_hospital_active or (v_hospital_config is not null and v_hospital_config ? 'deleted_at') then
      return jsonb_build_object('success', false, 'error', 'This clinic invitation is no longer active');
    end if;
  end if;

  -- 5. Create or update auth.users
  select id into v_existing_user_id
  from auth.users
  where lower(email) = lower(trim(v_rec.email));

  if v_existing_user_id is not null then
    v_user_id := v_existing_user_id;
    update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_rec.full_name, 'phone', v_rec.phone),
        updated_at = now(),
        banned_until = null
    where id = v_user_id;
  else
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(trim(v_rec.email)),
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_rec.full_name, 'phone', v_rec.phone),
      now(),
      now()
    );
  end if;

  -- 6. Insert identity for email if auth.identities exists
  begin
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text,
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
      'email',
      now(), now(), now()
    )
    on conflict (provider_id, provider) do update set
      identity_data = jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
      updated_at = now();
  exception when others then
    begin
      insert into auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
        'email',
        now(), now(), now()
      )
      on conflict do nothing;
    exception when others then
      null;
    end;
  end;

  -- 7. Create or update public.profiles
  insert into public.profiles (id, display_name, email, phone)
  values (v_user_id, trim(v_rec.full_name), lower(trim(v_rec.email)), v_rec.phone)
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();

  -- 8. Create or update public.staff_memberships
  if v_rec.hospital_id is not null then
    insert into public.staff_memberships (
      user_id, hospital_id, facility_id, department_id,
      role_code, active, specialty, shift, gender, qualification,
      medical_registration_number, experience_years, consultation_fee,
      working_hours, administrative_notes, status
    ) values (
      v_user_id, v_rec.hospital_id, v_rec.facility_id, v_rec.department_id,
      v_rec.role_code, true, v_rec.specialty, v_rec.shift, v_rec.gender, v_rec.qualification,
      v_rec.medical_registration_number, v_rec.experience_years, v_rec.consultation_fee,
      v_rec.working_hours, v_rec.administrative_notes, 'Active'
    )
    on conflict (user_id) do update set
      hospital_id = excluded.hospital_id,
      facility_id = coalesce(excluded.facility_id, public.staff_memberships.facility_id),
      department_id = coalesce(excluded.department_id, public.staff_memberships.department_id),
      role_code = excluded.role_code,
      active = true,
      status = 'Active',
      deleted_at = null,
      specialty = coalesce(excluded.specialty, public.staff_memberships.specialty),
      shift = coalesce(excluded.shift, public.staff_memberships.shift),
      gender = coalesce(excluded.gender, public.staff_memberships.gender),
      qualification = coalesce(excluded.qualification, public.staff_memberships.qualification),
      medical_registration_number = coalesce(excluded.medical_registration_number, public.staff_memberships.medical_registration_number),
      experience_years = coalesce(excluded.experience_years, public.staff_memberships.experience_years),
      consultation_fee = coalesce(excluded.consultation_fee, public.staff_memberships.consultation_fee),
      working_hours = coalesce(excluded.working_hours, public.staff_memberships.working_hours),
      administrative_notes = coalesce(excluded.administrative_notes, public.staff_memberships.administrative_notes),
      updated_at = now();
  end if;

  -- 9. If super_admin, also ensure platform_admins record exists
  if v_rec.role_code = 'super_admin' then
    insert into public.platform_admins (user_id, active)
    values (v_user_id, true)
    on conflict (user_id) do update set active = true, updated_at = now();
  end if;

  -- 10. Mark token as used
  update public.invite_tokens
  set used_at = now()
  where token = v_clean_token;

  return jsonb_build_object(
    'success', true,
    'userId', v_user_id,
    'email', lower(trim(v_rec.email)),
    'roleCode', v_rec.role_code,
    'hospitalId', v_rec.hospital_id
  );
end;
$$;

grant execute on function public.activate_invited_user(text, text) to anon, authenticated, service_role;

-- Step 5: Soft Delete Staff Member RPC
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
  elsif v_hospital_id is not null and v_hospital_id = private.current_hospital_id() and private.has_permission('people.manage') then
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

-- Step 6: Restore Staff Member RPC
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
  elsif v_hospital_id is not null and v_hospital_id = private.current_hospital_id() and private.has_permission('people.manage') then
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

-- Step 7: Permanently Delete Staff User RPC
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
  elsif v_hospital_id is not null and v_hospital_id = private.current_hospital_id() and private.has_permission('people.manage') then
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

  -- Attempt hard deletion of staff membership and auth user if no foreign key constraints block it
  begin
    delete from public.staff_memberships where user_id = p_user_id;
  exception when others then
    -- Retain inactive membership record if referenced by existing audit or clinical rows
    null;
  end;

  begin
    delete from auth.users where id = p_user_id;
  exception when others then
    -- Scrambled password and permanent ban guarantee login cannot succeed
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

grant execute on function public.permanently_delete_staff_user(uuid) to authenticated, service_role;

-- Step 8: Update list_current_staff to support Super Admin global queries and filter inactive/deleted users
drop function if exists public.list_current_staff();

create or replace function public.list_current_staff()
returns table (
  user_id uuid,
  hospital_id uuid,
  role_code text,
  active boolean,
  specialty text,
  shift text,
  display_name text,
  email text,
  phone text,
  status text,
  deleted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    membership.hospital_id,
    membership.role_code,
    membership.active,
    membership.specialty,
    membership.shift,
    profile.display_name,
    profile.email,
    profile.phone,
    case
      when not membership.active or membership.deleted_at is not null then 'Inactive'
      when invited_user.email_confirmed_at is null then 'Invited'
      else 'Active'
    end,
    membership.deleted_at
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  left join auth.users invited_user on invited_user.id = membership.user_id
  where (
    private.is_platform_admin()
    or (
      membership.hospital_id = private.current_hospital_id()
      and private.has_permission('people.read')
    )
  )
  order by profile.display_name;
$$;

revoke all on function public.list_current_staff() from public, anon;
grant execute on function public.list_current_staff() to authenticated;

-- Step 9: Update list_active_doctors_with_counts to support Super Admin and filter deleted doctors
drop function if exists public.list_active_doctors_with_counts();

create or replace function public.list_active_doctors_with_counts()
returns table (
  user_id uuid,
  display_name text,
  specialty text,
  email text,
  phone text,
  gender text,
  qualification text,
  medical_registration_number text,
  experience_years integer,
  consultation_fee numeric,
  working_hours text,
  administrative_notes text,
  avatar_path text,
  status text,
  patient_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    profile.display_name,
    membership.specialty,
    case when private.has_permission('people.read') or private.is_platform_admin() then profile.email end,
    case when private.has_permission('people.read') or private.is_platform_admin() then profile.phone end,
    case when private.has_permission('people.read') or private.is_platform_admin() then membership.gender end,
    case when private.has_permission('people.read') or private.is_platform_admin() then membership.qualification end,
    case when private.has_permission('people.read') or private.is_platform_admin() then membership.medical_registration_number end,
    case when private.has_permission('people.read') or private.is_platform_admin() then membership.experience_years end,
    membership.consultation_fee,
    membership.working_hours,
    case when private.has_permission('people.read') or private.is_platform_admin() then membership.administrative_notes end,
    case when private.has_permission('people.read') or private.is_platform_admin() then profile.avatar_path end,
    case
      when invited_user.email_confirmed_at is null then 'Invited'
      else 'Active'
    end,
    case
      when private.has_permission('people.read') or private.is_platform_admin()
        then count(team.patient_id) filter (where team.active)
      else 0
    end
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  left join auth.users invited_user on invited_user.id = membership.user_id
  left join public.patient_care_teams team
    on team.staff_user_id = membership.user_id
  where (
    private.is_platform_admin()
    or (
      membership.hospital_id = private.current_hospital_id()
      and private.has_permission('appointments.read')
    )
  )
    and membership.role_code = 'doctor'
    and membership.active
    and membership.deleted_at is null
  group by membership.user_id, profile.id, invited_user.id
  order by profile.display_name;
$$;

revoke all on function public.list_active_doctors_with_counts() from public, anon;
grant execute on function public.list_active_doctors_with_counts() to authenticated;

-- staff_memberships: Super Admin global access, Clinical Admin single-hospital access
drop policy if exists memberships_select on public.staff_memberships;
create policy memberships_select on public.staff_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.read'))
  or private.is_platform_admin()
);

drop policy if exists memberships_insert on public.staff_memberships;
create policy memberships_insert on public.staff_memberships
for insert to authenticated
with check (
  private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
);

drop policy if exists memberships_update on public.staff_memberships;
create policy memberships_update on public.staff_memberships
for update to authenticated
using (
  private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
)
with check (
  private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
);

drop policy if exists memberships_delete on public.staff_memberships;
create policy memberships_delete on public.staff_memberships
for delete to authenticated
using (
  (private.is_platform_admin() and user_id <> auth.uid())
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage') and user_id <> auth.uid())
);

-- profiles: Super Admin global select, Clinical Admin single-hospital select
drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or (
    private.has_permission('people.read')
    and exists (
      select 1 from public.staff_memberships sm
      where sm.user_id = profiles.id
        and sm.hospital_id = private.current_hospital_id()
    )
  )
  or private.is_platform_admin()
);

-- facilities: Super Admin global select, Clinical Admin single-hospital select
drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  or private.is_platform_admin()
);

-- invite_tokens: Harden security so tokens table is never exposed to public or anon
drop policy if exists "Service role manages invite tokens" on public.invite_tokens;
drop policy if exists invite_tokens_admin_select on public.invite_tokens;
drop policy if exists invite_tokens_service_role on public.invite_tokens;

create policy invite_tokens_admin_select on public.invite_tokens
for select to authenticated
using (
  private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
);

create policy invite_tokens_service_role on public.invite_tokens
for all to service_role
using (true)
with check (true);

revoke all on public.invite_tokens from public, anon;
grant select, insert, update on public.invite_tokens to authenticated, service_role;

commit;
