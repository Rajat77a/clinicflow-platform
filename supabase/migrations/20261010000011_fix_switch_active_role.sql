-- Fix switch_active_role to handle super_admin and insert if no row exists in staff_memberships

CREATE OR REPLACE FUNCTION public.switch_active_role(p_role_code text, p_hospital_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_has_role boolean;
  v_rows_affected integer;
BEGIN
  -- Check if they actually have this role at this clinic
  IF p_role_code = 'super_admin' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND active = true
    ) INTO v_has_role;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.staff_roles 
      WHERE user_id = auth.uid() AND role_code = p_role_code AND (hospital_id = p_hospital_id OR p_hospital_id IS NULL)
    ) INTO v_has_role;
  END IF;

  IF NOT v_has_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to switch to this role.');
  END IF;

  -- Update their active role in staff_memberships
  UPDATE public.staff_memberships
  SET role_code = p_role_code, hospital_id = p_hospital_id
  WHERE user_id = auth.uid();

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  -- If no row was updated, it means they didn't have a membership row yet
  IF v_rows_affected = 0 THEN
    INSERT INTO public.staff_memberships (user_id, role_code, hospital_id, active, status)
    VALUES (auth.uid(), p_role_code, p_hospital_id, true, 'Active');
  END IF;

  RETURN jsonb_build_object('success', true, 'role_code', p_role_code, 'hospital_id', p_hospital_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
