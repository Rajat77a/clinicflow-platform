-- Allow negative days adjustment in extend_platform_subscription
create or replace function public.extend_platform_subscription(
  p_hospital_id uuid, p_days integer, p_proof_ref text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare old_expiry timestamptz; new_expiry timestamptz;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if p_days not between -3650 and 3650 or p_days = 0 or char_length(coalesce(p_proof_ref, '')) > 200 then
    raise exception 'Invalid subscription extension' using errcode = '22023';
  end if;
  select expires_at into old_expiry from public.hospital_subscriptions
  where hospital_id = p_hospital_id for update;
  if not found then raise exception 'Subscription not found' using errcode = 'P0002'; end if;
  if p_days > 0 then
    new_expiry := greatest(old_expiry, now()) + make_interval(days => p_days);
  else
    new_expiry := old_expiry + make_interval(days => p_days);
  end if;
  update public.hospital_subscriptions
  set expires_at = new_expiry, status = case when new_expiry > now() then 'active' else 'expired' end, updated_by = auth.uid()
  where hospital_id = p_hospital_id;
  update public.hospitals set active = (new_expiry > now()) where id = p_hospital_id;
  insert into public.hospital_subscription_events
    (hospital_id, actor_user_id, action, days, old_expires_at, new_expires_at, proof_ref)
  values (p_hospital_id, auth.uid(), case when p_days > 0 then 'extended' else 'reduced' end, p_days, old_expiry, new_expiry, nullif(trim(p_proof_ref), ''));
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (p_hospital_id, auth.uid(), 'super_admin', case when p_days > 0 then 'subscription.extended' else 'subscription.reduced' end, 'hospital_subscription',
    p_hospital_id::text, jsonb_build_object('days', p_days, 'new_expiry', new_expiry));
  return new_expiry;
end;
$$;
