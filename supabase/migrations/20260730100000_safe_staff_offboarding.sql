-- Revoke a staff member's hospital access without deleting clinical history.

begin;

create or replace function public.deactivate_staff_member(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_hospital uuid := private.current_hospital_id();
  actor_role text := private.current_role_code();
  target_membership public.staff_memberships%rowtype;
  normalized_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.uid() is null
    or actor_hospital is null
    or not private.has_permission('people.manage')
  then
    raise exception 'Staff administration permission is required' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot deactivate your own account' using errcode = '22023';
  end if;

  if char_length(normalized_reason) not between 8 and 500 then
    raise exception 'A deactivation reason between 8 and 500 characters is required'
      using errcode = '22023';
  end if;

  select membership.*
  into target_membership
  from public.staff_memberships membership
  where membership.user_id = p_user_id
    and membership.hospital_id = actor_hospital
  for update;

  if not found then
    raise exception 'Staff membership was not found in this hospital' using errcode = 'P0002';
  end if;

  perform public.assert_staff_role_assignment(actor_role, target_membership.role_code);

  if not target_membership.active then
    return;
  end if;

  update public.staff_memberships
  set active = false,
      updated_at = now()
  where user_id = target_membership.user_id
    and hospital_id = actor_hospital;

  update public.patient_care_teams team
  set active = false
  from public.patients patient
  where team.patient_id = patient.id
    and team.staff_user_id = target_membership.user_id
    and patient.hospital_id = actor_hospital
    and team.active;

  insert into public.audit_events (
    hospital_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    actor_hospital,
    auth.uid(),
    actor_role,
    'staff.deactivated',
    'staff_membership',
    target_membership.user_id::text,
    jsonb_build_object(
      'role', target_membership.role_code,
      'reason', normalized_reason
    )
  );
end;
$$;

revoke all on function public.deactivate_staff_member(uuid, text) from public, anon;
grant execute on function public.deactivate_staff_member(uuid, text) to authenticated;

comment on function public.deactivate_staff_member(uuid, text) is
  'Deactivates an authorized subordinate staff membership and care-team assignments while preserving history.';

commit;
