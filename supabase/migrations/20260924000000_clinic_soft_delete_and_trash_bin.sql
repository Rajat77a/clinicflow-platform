-- Migration: Clinic soft delete, restore, and permanent delete functions

begin;

-- Function to soft delete a platform clinic
create or replace function public.soft_delete_platform_clinic(p_hospital_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;

  update public.hospitals
  set active = false,
      configuration = coalesce(configuration, '{}'::jsonb) || jsonb_build_object('deleted_at', now()::text)
  where id = p_hospital_id;

  if not found then
    raise exception 'Clinic not found' using errcode = 'P0002';
  end if;

  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  select p_hospital_id, id, 'super_admin', 'clinic.soft_deleted', 'hospital', p_hospital_id::text
  from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.soft_delete_platform_clinic(uuid) to authenticated;

-- Function to restore a soft-deleted platform clinic
create or replace function public.restore_platform_clinic(p_hospital_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;

  update public.hospitals
  set active = true,
      configuration = coalesce(configuration, '{}'::jsonb) - 'deleted_at'
  where id = p_hospital_id;

  if not found then
    raise exception 'Clinic not found' using errcode = 'P0002';
  end if;

  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  select p_hospital_id, id, 'super_admin', 'clinic.restored', 'hospital', p_hospital_id::text
  from public.profiles where id = auth.uid();
end;
$$;

grant execute on function public.restore_platform_clinic(uuid) to authenticated;

-- Function to permanently delete a platform clinic and its related records
create or replace function public.permanently_delete_platform_clinic(p_hospital_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;

  -- Delete related records
  delete from public.invite_tokens where hospital_id = p_hospital_id;
  delete from public.hospital_subscription_events where hospital_id = p_hospital_id;
  delete from public.hospital_subscriptions where hospital_id = p_hospital_id;
  delete from public.facilities where hospital_id = p_hospital_id;
  delete from public.audit_events where hospital_id = p_hospital_id;
  delete from public.staff_memberships where hospital_id = p_hospital_id;
  delete from public.appointments where hospital_id = p_hospital_id;
  delete from public.prescriptions where hospital_id = p_hospital_id;
  delete from public.lab_orders where hospital_id = p_hospital_id;
  delete from public.invoices where hospital_id = p_hospital_id;
  delete from public.patients where hospital_id = p_hospital_id;
  
  -- Delete the clinic itself
  delete from public.hospitals where id = p_hospital_id;

  if not found then
    raise exception 'Clinic not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.permanently_delete_platform_clinic(uuid) to authenticated;

commit;
