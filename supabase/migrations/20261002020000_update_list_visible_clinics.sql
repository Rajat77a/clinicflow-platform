create or replace function public.list_visible_clinics()
returns table (
  id uuid, name text, city text, doctors bigint, receptionists bigint, clinical_admins bigint, patients bigint,
  plan text, price numeric, status text, expires date, access text, is_current boolean,
  configuration jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, coalesce(h.configuration->>'city', 'Not set'),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'doctor' and m.active),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'receptionist' and m.active),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'clinic_admin' and m.active),
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
  where private.is_platform_admin() or h.id = private.current_hospital_id()
  order by h.created_at;
$$;
