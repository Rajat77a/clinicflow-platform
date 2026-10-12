-- Hide and remove expired invitations in the clinical admin portal
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
  where private.is_platform_admin()
    and not exists (
      select 1 from public.staff_roles sm where sm.user_id = pa.user_id and sm.role_code = 'super_admin'
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
      and (invite.expires_at > now() or invite.expires_at is null)
      and invite.deleted_at is null
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
      select 1 from public.staff_roles sm where sm.user_id = profile.id
    )
    and not exists (
      select 1 from public.platform_admins pa where pa.user_id = profile.id
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_current_staff() TO authenticated;

-- Update list_active_doctors_with_counts to exclude expired unconfirmed invites for clinical admins
CREATE OR REPLACE FUNCTION public.list_active_doctors_with_counts()
RETURNS table (
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  select
    sr.user_id,
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
  from public.staff_roles sr
  join public.staff_memberships membership on membership.user_id = sr.user_id
  join public.profiles profile on profile.id = sr.user_id
  left join auth.users invited_user on invited_user.id = sr.user_id
  left join public.patient_care_teams team on team.staff_user_id = sr.user_id
  where (
    private.is_platform_admin()
    or (
      sr.hospital_id = private.current_hospital_id()
      and private.has_permission('appointments.read')
    )
  )
  and sr.role_code = 'doctor'
  and membership.active
  and membership.deleted_at is null
  and (
    private.is_platform_admin()
    or invited_user.email_confirmed_at is not null
    or not exists (
      select 1 from public.invite_tokens it
      where lower(it.email) = lower(profile.email)
        and it.hospital_id = sr.hospital_id
        and it.expires_at <= now()
        and it.used_at is null
    )
  )
  group by sr.user_id, profile.id, invited_user.id, membership.specialty, membership.gender, membership.qualification, membership.medical_registration_number, membership.experience_years, membership.consultation_fee, membership.working_hours, membership.administrative_notes
  order by profile.display_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_active_doctors_with_counts() TO authenticated;
NOTIFY pgrst, 'reload schema';
