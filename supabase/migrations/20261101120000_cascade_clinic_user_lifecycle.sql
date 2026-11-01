-- Migration: Cascade Clinic Deletion & Restoration to Associated Users and Prevent Unassigned Users
-- Ensures that when a clinic's access is suspended/deleted, all associated staff memberships and active care teams
-- are deactivated/cascaded. When restored/reactivated, all associated staff memberships are restored.
-- Also removes any orphaned staff memberships with missing clinic associations.

begin;

-- Clean up any orphaned staff memberships that lack a valid clinic/hospital
delete from public.staff_memberships
where hospital_id is null
   or hospital_id not in (select id from public.hospitals);

-- Ensure staff_memberships hospital_id is strictly non-nullable
alter table public.staff_memberships
  alter column hospital_id set not null;

-- Update set_platform_clinic_access to cascade deletion (deactivation) and restoration to associated users
create or replace function public.set_platform_clinic_access(p_hospital_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;

  if p_hospital_id = private.current_hospital_id() and not p_active then
    raise exception 'The active control clinic cannot suspend itself' using errcode = '22023';
  end if;

  -- Update hospital access
  update public.hospitals set active = p_active where id = p_hospital_id;
  if not found then
    raise exception 'Clinic not found' using errcode = 'P0002';
  end if;

  -- Cascade access to all staff memberships of this clinic
  update public.staff_memberships
  set active = p_active,
      updated_at = now()
  where hospital_id = p_hospital_id;

  -- If clinic is deleted/suspended, deactivate active care team assignments for its patients
  if not p_active then
    update public.patient_care_teams team
    set active = false
    from public.patients patient
    where team.patient_id = patient.id
      and patient.hospital_id = p_hospital_id
      and team.active;
  else
    -- When restored, restore primary doctor care team assignments
    update public.patient_care_teams team
    set active = true
    from public.patients patient
    where team.patient_id = patient.id
      and patient.hospital_id = p_hospital_id
      and team.relationship in ('primary_doctor', 'primary');
  end if;

  -- Update hospital subscription status
  update public.hospital_subscriptions
  set status = case when p_active then 'active' else 'suspended' end,
      updated_by = auth.uid()
  where hospital_id = p_hospital_id;

  event_action := case when p_active then 'reactivated' else 'suspended' end;

  insert into public.hospital_subscription_events (hospital_id, actor_user_id, action)
  values (p_hospital_id, auth.uid(), event_action);

  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  values (
    p_hospital_id,
    auth.uid(),
    'super_admin',
    'clinic.' || event_action,
    'hospital',
    p_hospital_id::text
  );
end;
$$;

revoke all on function public.set_platform_clinic_access(uuid, boolean) from public, anon;
grant execute on function public.set_platform_clinic_access(uuid, boolean) to authenticated;

commit;
