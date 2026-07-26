-- Bounded patient directory reads. The function runs as the caller so patient
-- RLS remains the authorization boundary for every portal.
create or replace function public.search_patients(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  hospital_id uuid,
  medical_record_number text,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  phone text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  version integer,
  doctor_user_id uuid,
  doctor_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_patients as (
    select
      p.id,
      p.hospital_id,
      p.medical_record_number,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.sex,
      p.phone,
      p.status,
      p.created_at,
      p.updated_at,
      p.version,
      assigned.staff_user_id as doctor_user_id,
      assigned.doctor_name
    from public.patients p
    left join lateral (
      select
        team.staff_user_id,
        profile.display_name as doctor_name
      from public.patient_care_teams team
      join public.profiles profile on profile.id = team.staff_user_id
      where team.patient_id = p.id
        and team.active
        and team.relationship = 'primary'
      order by team.assigned_at desc
      limit 1
    ) assigned on true
    where
      nullif(btrim(p_query), '') is null
      or concat_ws(
        ' ',
        p.id::text,
        p.medical_record_number,
        p.first_name,
        p.last_name,
        p.phone
      ) ilike '%' || btrim(p_query) || '%'
  )
  select
    visible_patients.*,
    count(*) over () as total_count
  from visible_patients
  order by created_at desc, id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.search_patients(text, integer, integer)
from public, anon;
grant execute on function public.search_patients(text, integer, integer)
to authenticated;

comment on function public.search_patients(text, integer, integer) is
  'Returns one bounded page of RLS-visible patients with an exact filtered count.';

create or replace function public.list_active_doctors_with_counts()
returns table (
  user_id uuid,
  display_name text,
  specialty text,
  email text,
  phone text,
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
    profile.email,
    profile.phone,
    count(team.patient_id) filter (where team.active) as patient_count
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  left join public.patient_care_teams team
    on team.staff_user_id = membership.user_id
  where membership.hospital_id = private.current_hospital_id()
    and membership.role_code = 'doctor'
    and membership.active
    and private.has_permission('appointments.read')
  group by
    membership.user_id,
    profile.display_name,
    membership.specialty,
    profile.email,
    profile.phone
  order by profile.display_name;
$$;

revoke all on function public.list_active_doctors_with_counts()
from public, anon;
grant execute on function public.list_active_doctors_with_counts()
to authenticated;
