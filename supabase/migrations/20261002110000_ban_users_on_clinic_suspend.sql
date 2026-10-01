create or replace function public.set_platform_clinic_access(p_hospital_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_action text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if p_hospital_id = private.current_hospital_id() and not p_active then
    raise exception 'The active control clinic cannot suspend itself' using errcode = '22023';
  end if;
  update public.hospitals set active = p_active where id = p_hospital_id;
  if not found then raise exception 'Clinic not found' using errcode = 'P0002'; end if;
  update public.hospital_subscriptions
  set status = case when p_active then 'active' else 'suspended' end, updated_by = auth.uid()
  where hospital_id = p_hospital_id;

  -- Suspend/Unsuspend all staff members belonging to this clinic
  update auth.users
  set banned_until = case when p_active then null else '3000-01-01'::timestamptz end
  where id in (
    select user_id from public.staff_memberships where hospital_id = p_hospital_id
  );

  event_action := case when p_active then 'reactivated' else 'suspended' end;
  insert into public.hospital_subscription_events (hospital_id, actor_user_id, action)
  values (p_hospital_id, auth.uid(), event_action);
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  values (p_hospital_id, auth.uid(), 'super_admin', 'clinic.' || event_action, 'hospital', p_hospital_id::text);
end;
$$;
NOTIFY pgrst, 'reload schema';
