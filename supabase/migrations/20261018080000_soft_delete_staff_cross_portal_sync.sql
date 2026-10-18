-- Synchronize invite_tokens deleted_at and staff_memberships on soft delete and restore across all portals

CREATE OR REPLACE FUNCTION public.soft_delete_staff_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_hospital_id uuid;
  v_email text;
  v_actor_role text := 'clinic_admin';
BEGIN
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account' USING errcode = '22023';
  END IF;

  SELECT lower(email) INTO v_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_email IN ('clinic.admin@clinicflow.test', 'doctor@clinicflow.test', 'reception@clinicflow.test') OR v_email LIKE '%super_admin%' THEN
    RAISE EXCEPTION 'Cannot delete permanent test accounts' USING errcode = '22023';
  END IF;

  SELECT hospital_id INTO v_hospital_id
  FROM public.staff_memberships
  WHERE user_id = p_user_id;

  IF private.is_platform_admin() THEN
    v_actor_role := 'super_admin';
  ELSIF (v_hospital_id IS NULL OR v_hospital_id = private.current_hospital_id()) AND private.has_permission('people.manage') THEN
    v_actor_role := 'clinic_admin';
  ELSE
    RAISE EXCEPTION 'Access denied: insufficient permissions to manage staff' USING errcode = '42501';
  END IF;

  -- Deactivate membership and mark soft-deleted
  UPDATE public.staff_memberships
  SET active = false,
      status = 'Inactive',
      deleted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Deactivate patient care team assignments
  UPDATE public.patient_care_teams
  SET active = false
  WHERE staff_user_id = p_user_id;

  -- Invalidate and mark soft-deleted any pending invite tokens
  IF v_email IS NOT NULL THEN
    UPDATE public.invite_tokens
    SET expires_at = now() - interval '1 second',
        deleted_at = now()
    WHERE lower(email) = v_email AND used_at IS NULL;
  ELSE
    UPDATE public.invite_tokens
    SET expires_at = now() - interval '1 second',
        deleted_at = now()
    WHERE md5(token)::uuid = p_user_id AND used_at IS NULL;
  END IF;

  -- Ban Supabase Auth user to disable login
  UPDATE auth.users
  SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"banned": true, "deleted": true}'::jsonb,
      updated_at = now()
  WHERE id = p_user_id;

  -- Insert audit event
  IF v_hospital_id IS NOT NULL THEN
    INSERT INTO public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) VALUES (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.soft_deleted', 'staff_membership', p_user_id::text
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_staff_member(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_hospital_id uuid;
  v_email text;
  v_actor_role text := 'clinic_admin';
BEGIN
  SELECT lower(email) INTO v_email
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT hospital_id INTO v_hospital_id
  FROM public.staff_memberships
  WHERE user_id = p_user_id;

  IF private.is_platform_admin() THEN
    v_actor_role := 'super_admin';
  ELSIF (v_hospital_id IS NULL OR v_hospital_id = private.current_hospital_id()) AND private.has_permission('people.manage') THEN
    v_actor_role := 'clinic_admin';
  ELSE
    RAISE EXCEPTION 'Access denied: insufficient permissions to manage staff' USING errcode = '42501';
  END IF;

  -- Reactivate membership
  UPDATE public.staff_memberships
  SET active = true,
      status = 'Active',
      deleted_at = null,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Restore invite tokens
  IF v_email IS NOT NULL THEN
    UPDATE public.invite_tokens
    SET deleted_at = null
    WHERE lower(email) = v_email;
  ELSE
    UPDATE public.invite_tokens
    SET deleted_at = null
    WHERE md5(token)::uuid = p_user_id;
  END IF;

  -- Unban Supabase Auth user
  UPDATE auth.users
  SET banned_until = null,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'banned' - 'deleted',
      updated_at = now()
  WHERE id = p_user_id;

  -- Insert audit event
  IF v_hospital_id IS NOT NULL THEN
    INSERT INTO public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) VALUES (
      v_hospital_id, auth.uid(), v_actor_role, 'staff.restored', 'staff_membership', p_user_id::text
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_staff_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_staff_member(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
