-- Fix list_active_doctors_with_counts to query staff_roles so that doctors who are currently logged in as a different role are still shown in the doctors list.

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
  group by sr.user_id, profile.id, invited_user.id, membership.specialty, membership.gender, membership.qualification, membership.medical_registration_number, membership.experience_years, membership.consultation_fee, membership.working_hours, membership.administrative_notes
  order by profile.display_name;
$$;

REVOKE ALL ON FUNCTION public.list_active_doctors_with_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_active_doctors_with_counts() TO authenticated;
NOTIFY pgrst, 'reload schema';
