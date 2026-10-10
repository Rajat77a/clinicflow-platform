-- Fix active_doctor_assignment to check staff_roles so appointments can be booked for doctors logged in under different roles

CREATE OR REPLACE FUNCTION private.active_doctor_assignment(target_doctor_user_id uuid)
RETURNS table (
  assignment_facility_id uuid,
  assignment_department_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  select
    coalesce(m.facility_id, fallback_facility.id),
    m.department_id
  from public.staff_roles sr
  join public.staff_memberships m on m.user_id = sr.user_id
  left join lateral (
    select f.id
    from public.facilities f
    where f.hospital_id = private.current_hospital_id()
      and f.active
    order by f.created_at
    limit 1
  ) fallback_facility on true
  where private.has_permission('appointments.write')
    and sr.user_id = target_doctor_user_id
    and sr.hospital_id = private.current_hospital_id()
    and sr.role_code = 'doctor'
    and m.active
    and m.deleted_at is null
$$;

NOTIFY pgrst, 'reload schema';
