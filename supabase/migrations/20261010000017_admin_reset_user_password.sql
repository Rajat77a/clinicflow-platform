-- Migration: Super admin direct password reset for all user roles
-- Allows super_admin to set/reset a user's password directly from the users viewing page
-- The user can immediately log in with the new password.

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_email text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'auth'
AS $$
DECLARE
  v_user_id uuid;
  v_actor_is_super boolean := false;
  v_clean_email text;
BEGIN
  -- 1. Security Check: Only Super Admin can perform this operation
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid() AND active = true
    ) OR EXISTS (
      SELECT 1 FROM public.staff_memberships WHERE user_id = auth.uid() AND role_code = 'super_admin' AND active = true
    ) INTO v_actor_is_super;
  END IF;

  IF NOT v_actor_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only super admin can reset passwords');
  END IF;

  -- 2. Validate input
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email is required');
  END IF;

  IF p_new_password IS NULL OR char_length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 8 characters long');
  END IF;

  v_clean_email := lower(trim(p_email));

  -- 3. Find target user in auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email;

  IF v_user_id IS NOT NULL THEN
    -- Update existing auth user password and unban / confirm email
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now(),
        banned_until = null,
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'banned' - 'deleted' - 'permanently_deleted',
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, '')
    WHERE id = v_user_id;

    -- Ensure active status in staff_memberships if present
    UPDATE public.staff_memberships
    SET active = true,
        status = 'Active',
        deleted_at = null,
        updated_at = now()
    WHERE user_id = v_user_id AND (active = false OR status = 'Inactive');

  ELSE
    -- User might be an invited user who hasn't activated yet or exists only in profiles / invite_tokens
    -- Create auth.users record so they can immediately log in
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_clean_email,
      extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', split_part(v_clean_email, '@', 1)),
      now(), now(),
      '', '', '', ''
    );

    -- Ensure profiles row exists
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (v_user_id, split_part(v_clean_email, '@', 1), v_clean_email)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email;

    -- Check if there was an invite_token for this email to link their assigned role / hospital
    DECLARE
      v_token_rec record;
    BEGIN
      SELECT * INTO v_token_rec
      FROM public.invite_tokens
      WHERE lower(email) = v_clean_email
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_token_rec.id IS NOT NULL THEN
        IF v_token_rec.hospital_id IS NOT NULL THEN
          INSERT INTO public.staff_memberships (
            user_id, hospital_id, facility_id, department_id,
            role_code, active, specialty, shift, gender, qualification,
            medical_registration_number, experience_years, consultation_fee,
            working_hours, administrative_notes, status
          ) VALUES (
            v_user_id, v_token_rec.hospital_id, v_token_rec.facility_id, v_token_rec.department_id,
            v_token_rec.role_code, true, nullif(trim(v_token_rec.specialty), ''), nullif(trim(v_token_rec.shift), ''),
            nullif(trim(v_token_rec.gender), ''), nullif(trim(v_token_rec.qualification), ''),
            nullif(trim(v_token_rec.medical_registration_number), ''), v_token_rec.experience_years, v_token_rec.consultation_fee,
            v_token_rec.working_hours, v_token_rec.administrative_notes, 'Active'
          )
          ON CONFLICT (user_id) DO UPDATE SET
            active = true,
            status = 'Active',
            role_code = EXCLUDED.role_code,
            hospital_id = EXCLUDED.hospital_id,
            updated_at = now();

          INSERT INTO public.staff_roles (user_id, hospital_id, role_code)
          VALUES (v_user_id, v_token_rec.hospital_id, v_token_rec.role_code)
          ON CONFLICT DO NOTHING;
        END IF;

        IF v_token_rec.role_code = 'super_admin' THEN
          INSERT INTO public.platform_admins (user_id, active)
          VALUES (v_user_id, true)
          ON CONFLICT (user_id) DO UPDATE SET active = true, updated_at = now();
        END IF;

        UPDATE public.invite_tokens
        SET used_at = now()
        WHERE id = v_token_rec.id;
      END IF;
    END;

  END IF;

  -- 4. Invalidate any pending invite tokens as password has now been explicitly set
  UPDATE public.invite_tokens
  SET used_at = now()
  WHERE lower(email) = v_clean_email AND used_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'userId', v_user_id,
    'email', v_clean_email,
    'message', 'Password updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
