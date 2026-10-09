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
      else 'Active'
    end as status,
    membership.deleted_at,
    membership.employee_number
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
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
      when invite.expires_at <= now() then 'Expired'
      else 'Invited'
    end as status,
    null::timestamptz as deleted_at,
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
NOTIFY pgrst, 'reload schema';
