-- Restore AAL2 enforcement for both privileged administrator roles. This is a
-- forward-only correction for installations that applied the preceding migration.
create or replace function private.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    join public.role_permissions rp on rp.role_code = m.role_code
    where m.user_id = auth.uid()
      and m.active
      and rp.permission_code = permission_name
      and (
        m.role_code not in ('super_admin', 'clinic_admin')
        or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      )
  )
$$;

comment on function private.has_permission(text) is
  'Checks active role permissions. Super Admin and Clinic Admin require AAL2.';
