-- Privileged hospital roles must present an AAL2 JWT before any permission
-- protected data operation can succeed.
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

create or replace function public.record_security_event(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.staff_memberships%rowtype;
begin
  if p_action not in ('mfa.enrolled', 'mfa.verified', 'password.changed') then
    raise exception 'Unsupported security event';
  end if;
  select *
  into actor
  from public.staff_memberships
  where user_id = auth.uid() and active
  limit 1;

  if actor.user_id is null then
    raise exception 'Active hospital membership required';
  end if;
  if p_action in ('mfa.enrolled', 'mfa.verified')
    and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'AAL2 session required';
  end if;

  insert into public.audit_events (
    hospital_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id
  )
  values (
    actor.hospital_id,
    auth.uid(),
    actor.role_code,
    p_action,
    'security',
    auth.uid()::text
  );
end;
$$;

revoke all on function public.record_security_event(text) from public, anon;
grant execute on function public.record_security_event(text) to authenticated;

comment on function public.record_security_event(text) is
  'Writes a validated, append-only account security event for the current hospital member.';
