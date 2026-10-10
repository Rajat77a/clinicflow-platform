-- 1. Create a better RPC to let users switch their active role with clinic support
CREATE OR REPLACE FUNCTION public.switch_active_role(p_role_code text, p_hospital_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_has_role boolean;
BEGIN
  -- Check if they actually have this role at this clinic
  SELECT EXISTS(
    SELECT 1 FROM public.staff_roles 
    WHERE user_id = auth.uid() AND role_code = p_role_code AND hospital_id = p_hospital_id
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to switch to this role at this clinic.');
  END IF;

  -- Update their active role in staff_memberships
  UPDATE public.staff_memberships
  SET role_code = p_role_code, hospital_id = p_hospital_id
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'role_code', p_role_code, 'hospital_id', p_hospital_id);
END;
$$;
NOTIFY pgrst, 'reload schema';
