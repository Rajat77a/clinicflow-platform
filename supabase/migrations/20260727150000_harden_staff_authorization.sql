-- Staff identities and system authorization are managed through audited server-side
-- workflows. Browser clients may read these records but cannot assign roles directly.

revoke insert, update, delete on public.roles from authenticated;
revoke insert, update, delete on public.role_permissions from authenticated;
revoke insert, update, delete on public.staff_memberships from authenticated;

drop policy if exists roles_manage_insert on public.roles;
drop policy if exists roles_manage_update on public.roles;
drop policy if exists roles_manage_delete on public.roles;
drop policy if exists role_permissions_manage_insert on public.role_permissions;
drop policy if exists role_permissions_manage_delete on public.role_permissions;
drop policy if exists memberships_insert on public.staff_memberships;
drop policy if exists memberships_update on public.staff_memberships;
drop policy if exists memberships_delete on public.staff_memberships;

revoke update on public.profiles from authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

comment on table public.roles is
  'Authorization roles are deployment-controlled. Change them only through reviewed migrations.';
comment on table public.role_permissions is
  'Permission assignments are deployment-controlled. Change them only through reviewed migrations.';
comment on table public.staff_memberships is
  'Hospital memberships are managed by trusted server-side staff administration workflows.';

create or replace function public.assert_staff_role_assignment(
  p_actor_role text,
  p_target_role text
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_actor_role = 'super_admin' and p_target_role in ('clinic_admin', 'doctor', 'receptionist') then
    return;
  end if;
  if p_actor_role = 'clinic_admin' and p_target_role in ('doctor', 'receptionist') then
    return;
  end if;

  raise exception 'The requested staff role assignment is not permitted'
    using errcode = '42501';
end;
$$;

revoke all on function public.assert_staff_role_assignment(text, text) from public, anon, authenticated;
grant execute on function public.assert_staff_role_assignment(text, text) to service_role;
