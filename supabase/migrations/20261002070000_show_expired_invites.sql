drop function if exists public.list_current_staff(integer, integer);
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
    invited_user.email,
    invited_user.phone,
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
  order by display_name;
$$;
NOTIFY pgrst, 'reload schema';
