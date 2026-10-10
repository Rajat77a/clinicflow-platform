-- Update list_visible_clinics to count roles from staff_roles instead of staff_memberships
-- This ensures that users with multiple roles are counted for each role they hold.

DROP FUNCTION IF EXISTS public.list_visible_clinics();

CREATE OR REPLACE FUNCTION public.list_visible_clinics()
RETURNS table (
  id uuid, short_id text, name text, city text, doctors bigint, receptionists bigint, clinical_admins bigint, patients bigint,
  plan text, price numeric, status text, expires date, access text, is_current boolean,
  configuration jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  select h.id, h.short_id, h.name, coalesce(h.configuration->>'city', 'Not set'),
    (select count(*) from public.staff_roles sr left join public.staff_memberships m on m.user_id = sr.user_id and m.hospital_id = sr.hospital_id where sr.hospital_id = h.id and sr.role_code = 'doctor' and m.active),
    (select count(*) from public.staff_roles sr left join public.staff_memberships m on m.user_id = sr.user_id and m.hospital_id = sr.hospital_id where sr.hospital_id = h.id and sr.role_code = 'receptionist' and m.active),
    (select count(*) from public.staff_roles sr left join public.staff_memberships m on m.user_id = sr.user_id and m.hospital_id = sr.hospital_id where sr.hospital_id = h.id and sr.role_code = 'clinic_admin' and m.active),
    (select count(*) from public.patients p where p.hospital_id = h.id),
    coalesce(s.plan_name, 'ClinicFlow'), coalesce(s.price, 499),
    case
      when not h.active or s.status = 'suspended' then 'Suspended'
      when s.expires_at < now() then 'Expired'
      when s.expires_at <= now() + interval '15 days' then 'Expiring'
      else 'Active'
    end,
    s.expires_at::date,
    case when h.active then 'Allowed' else 'Suspended' end,
    h.id = private.current_hospital_id(), h.configuration
  from public.hospitals h
  left join public.hospital_subscriptions s on s.hospital_id = h.id
  where private.is_platform_admin()
     or h.id = private.current_hospital_id()
$$;

GRANT EXECUTE ON FUNCTION public.list_visible_clinics() TO authenticated;
NOTIFY pgrst, 'reload schema';
