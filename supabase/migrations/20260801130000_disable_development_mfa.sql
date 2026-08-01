-- Temporarily restore password-only administrator access during development.
-- TOTP factors and reusable MFA code are preserved for the hospital release.
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
  )
$$;

comment on function private.has_permission(text) is
  'Checks active hospital role permissions. Mandatory MFA is temporarily disabled during development.';

commit;
