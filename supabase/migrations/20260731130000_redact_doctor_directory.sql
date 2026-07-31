begin;

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
    case when private.has_permission('people.read') then profile.email end,
    case when private.has_permission('people.read') then profile.phone end,
    case when private.has_permission('people.read') then membership.gender end,
    case when private.has_permission('people.read') then membership.qualification end,
    case when private.has_permission('people.read') then membership.medical_registration_number end,
    case when private.has_permission('people.read') then membership.experience_years end,
    membership.consultation_fee,
    membership.working_hours,
    case when private.has_permission('people.read') then membership.administrative_notes end,
    case when private.has_permission('people.read') then profile.avatar_path end,
    case
      when invited_user.email_confirmed_at is null then 'Invited'
      else 'Active'
    end,
    case
      when private.has_permission('people.read')
        then count(team.patient_id) filter (where team.active)
      else 0
    end
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  join auth.users invited_user on invited_user.id = membership.user_id
  left join public.patient_care_teams team
    on team.staff_user_id = membership.user_id
  where membership.hospital_id = private.current_hospital_id()
    and membership.role_code = 'doctor'
    and membership.active
    and private.has_permission('appointments.read')
  group by membership.user_id, profile.id, invited_user.id
  order by profile.display_name;
$$;

revoke all on function public.list_active_doctors_with_counts() from public, anon;
grant execute on function public.list_active_doctors_with_counts() to authenticated;

comment on function public.list_active_doctors_with_counts() is
  'Returns the scheduling directory while redacting staff-only fields unless the caller can read people records.';

commit;
