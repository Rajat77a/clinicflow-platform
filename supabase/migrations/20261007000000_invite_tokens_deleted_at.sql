alter table public.invite_tokens add column if not exists deleted_at timestamptz;

create or replace function public.soft_delete_staff_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'private'
as $$
declare
  actor_hospital uuid;
  target_membership record;
  v_email text;
begin
  actor_hospital := private.current_hospital_id();
  
  -- Let super admins bypass hospital check
  if private.is_platform_admin() then
    -- Get user email to invalidate tokens
    select email into v_email
    from public.profiles
    where id = p_user_id;

    -- Invalidate any pending invite tokens
    if v_email is not null then
      update public.invite_tokens
      set expires_at = now() - interval '1 second',
          deleted_at = now()
      where lower(email) = v_email and used_at is null;
    else
      update public.invite_tokens
      set expires_at = now() - interval '1 second',
          deleted_at = now()
      where md5(token)::uuid = p_user_id and used_at is null;
    end if;

    -- Update all memberships for this user
    update public.staff_memberships
    set active = false,
        deleted_at = now(),
        updated_at = now()
    where user_id = p_user_id;

    -- Ban Supabase Auth user to disable login
    update auth.users
    set banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true}'::jsonb,
        updated_at = now()
    where id = p_user_id;

    return;
  end if;

  -- Verify actor has permission
  if not private.has_permission('people.manage') then
    raise exception 'Unauthorized to delete staff members';
  end if;

  -- Look for the specific membership to delete
  select * into target_membership
  from public.staff_memberships
  where user_id = p_user_id
    and hospital_id = actor_hospital;

  if not found then
    -- If not found in memberships, check if it's an invite token
    update public.invite_tokens
    set expires_at = now() - interval '1 second',
        deleted_at = now()
    where md5(token)::uuid = p_user_id and hospital_id = actor_hospital and used_at is null;
    
    if found then
        return;
    end if;
    
    raise exception 'Staff member not found in your clinic';
  end if;

  -- Cannot delete super admins unless you are one (handled above)
  if target_membership.role_code = 'super_admin' then
    raise exception 'Cannot soft-delete a super admin';
  end if;

  -- Soft delete the membership
  update public.staff_memberships
  set active = false,
      deleted_at = now(),
      updated_at = now()
  where user_id = target_membership.user_id
    and hospital_id = actor_hospital;

  -- Disable auth if they have no other active memberships
  if not exists (
    select 1
    from public.staff_memberships
    where user_id = target_membership.user_id
      and active = true
      and deleted_at is null
  ) and not exists (
    select 1
    from public.platform_admins
    where user_id = target_membership.user_id
      and active = true
  ) then
    update auth.users
    set banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true}'::jsonb,
        updated_at = now()
    where id = target_membership.user_id;
  end if;

end;
$$;

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
  deleted_at timestamptz,
  employee_number text
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
    end as status,
    membership.deleted_at,
    membership.employee_number
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

  UNION ALL

  select
    pa.user_id,
    null::uuid as hospital_id,
    'super_admin'::text as role_code,
    pa.active,
    null::text as specialty,
    null::text as shift,
    profile.display_name,
    profile.email,
    profile.phone,
    case when pa.active then 'Active' else 'Inactive' end as status,
    null::timestamptz as deleted_at,
    null::text as employee_number
  from public.platform_admins pa
  join public.profiles profile on profile.id = pa.user_id
  where private.is_platform_admin()
    and not exists (
      select 1 from public.staff_memberships sm where sm.user_id = pa.user_id and sm.role_code = 'super_admin'
    )

  UNION ALL

  select
    md5(invite.token)::uuid as user_id,
    invite.hospital_id,
    invite.role_code,
    true as active,
    invite.specialty,
    invite.shift,
    invite.full_name as display_name,
    invite.email,
    invite.phone,
    case
      when invite.deleted_at is not null then 'Inactive'
      when invite.expires_at <= now() then 'Expired'
      else 'Invited'
    end as status,
    invite.deleted_at as deleted_at,
    null::text as employee_number
  from public.invite_tokens invite
  where invite.used_at is null
  and (
    private.is_platform_admin()
    or (
      invite.hospital_id = private.current_hospital_id()
      and private.has_permission('people.read')
    )
  )

  UNION ALL

  select
    profile.id as user_id,
    null::uuid as hospital_id,
    'unassigned'::text as role_code,
    true as active,
    null::text as specialty,
    null::text as shift,
    profile.display_name,
    profile.email,
    profile.phone,
    'Active' as status,
    null::timestamptz as deleted_at,
    null::text as employee_number
  from public.profiles profile
  where private.is_platform_admin()
    and not exists (
      select 1 from public.staff_memberships sm where sm.user_id = profile.id
    )
    and not exists (
      select 1 from public.platform_admins pa where pa.user_id = profile.id
    )

  order by display_name;
$$;
