-- Hospital deployments require AAL2 for privileged administrator permissions.
-- The application gate lets administrators enroll or verify TOTP before the
-- workspace provider requests protected hospital data.
begin;

create or replace function private.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships membership
    join public.role_permissions permission
      on permission.role_code = membership.role_code
    where membership.user_id = auth.uid()
      and membership.active
      and permission.permission_code = permission_name
      and (
        membership.role_code not in ('super_admin', 'clinic_admin')
        or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      )
  )
$$;

comment on function private.has_permission(text) is
  'Checks active role permissions. Privileged administrator roles require AAL2.';

commit;
