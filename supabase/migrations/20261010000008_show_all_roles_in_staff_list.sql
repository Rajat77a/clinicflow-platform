-- Update list_current_staff to return all roles a user holds from staff_roles, instead of just the active one from staff_memberships.

DROP FUNCTION IF EXISTS public.list_current_staff();

CREATE OR REPLACE FUNCTION public.list_current_staff()
RETURNS table (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  select
    sr.user_id,
    sr.hospital_id,
    sr.role_code,
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
  from public.staff_roles sr
  join public.profiles profile on profile.id = sr.user_id
  -- We left join staff_memberships to get the status, specialty, etc. Since staff_memberships is 1-to-1 with (user, hospital), this is safe.
  left join public.staff_memberships membership on membership.user_id = sr.user_id and membership.hospital_id = sr.hospital_id
  left join auth.users invited_user on invited_user.id = sr.user_id
  where (
    private.is_platform_admin()
    or (
      sr.hospital_id = private.current_hospital_id()
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
$$;

GRANT EXECUTE ON FUNCTION public.list_current_staff() TO authenticated;
NOTIFY pgrst, 'reload schema';
