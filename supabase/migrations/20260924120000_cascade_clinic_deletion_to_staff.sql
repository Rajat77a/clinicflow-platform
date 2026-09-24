-- Migration: Cascade clinic soft-delete and restoration to staff memberships
begin;

-- Function to soft delete a platform clinic and deactivate all associated staff
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

  -- Deactivate all users / staff assigned to this clinic
  update public.staff_memberships
  set status = 'Inactive'
  where hospital_id = p_hospital_id;

  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  select p_hospital_id, id, 'super_admin', 'clinic.soft_deleted', 'hospital', p_hospital_id::text
  from public.profiles where id = auth.uid();
end;
$$;

-- Function to restore a soft-deleted platform clinic and reactivate associated staff
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

  -- Reactivate staff assigned to this clinic
  update public.staff_memberships
  set status = 'Active'
  where hospital_id = p_hospital_id and status = 'Inactive';

  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  select p_hospital_id, id, 'super_admin', 'clinic.restored', 'hospital', p_hospital_id::text
  from public.profiles where id = auth.uid();
end;
$$;

commit;
