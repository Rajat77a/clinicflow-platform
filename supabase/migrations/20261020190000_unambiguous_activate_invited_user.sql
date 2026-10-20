-- Clean up overloaded activate_invited_user signatures to eliminate candidate ambiguity
DROP FUNCTION IF EXISTS public.activate_invited_user(text, text);
DROP FUNCTION IF EXISTS public.activate_invited_user(text, text, text);

-- Recreate the authoritative unified function with 3 parameters (p_token, p_password, p_full_name)
CREATE OR REPLACE FUNCTION public.activate_invited_user(
  p_token text,
  p_password text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'private'
AS $$
DECLARE
  v_rec record;
  v_user_id uuid;
  v_clean_token text;
  v_hospital_active boolean;
  v_hospital_config jsonb;
  v_existing_user_id uuid;
  v_new_full_name text;
BEGIN
  -- 1. Validate token
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('success', false, 'error', 'Invalid token');
  end if;

  v_clean_token := trim(p_token);

  select * into v_rec
  from public.invite_tokens
  where token = v_clean_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invitation not found or invalid');
  end if;

  if v_rec.used_at is not null then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been used');
  end if;

  if v_rec.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'This invitation link has expired');
  end if;

  if v_rec.hospital_id is not null then
    select active, configuration into v_hospital_active, v_hospital_config
    from public.hospitals
    where id = v_rec.hospital_id;

    if not found or not v_hospital_active or (v_hospital_config is not null and v_hospital_config ? 'deleted_at') then
      return jsonb_build_object('success', false, 'error', 'This clinic invitation is no longer active');
    end if;
  end if;

  -- 2. Create or update auth.users
  select id into v_existing_user_id
  from auth.users
  where lower(email) = lower(trim(v_rec.email));

  if v_existing_user_id is not null then
    -- EXISTING USER
    v_user_id := v_existing_user_id;

    if p_password is not null then
      if char_length(p_password) < 8 then
        return jsonb_build_object('success', false, 'error', 'Password must be at least 8 characters');
      end if;

      update auth.users
      set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
          raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', coalesce(nullif(trim(p_full_name), ''), v_rec.full_name), 'phone', v_rec.phone),
          updated_at = now(),
          banned_until = null
      where id = v_user_id;
    else
      -- If password is null, just unban them and ensure email is confirmed
      update auth.users
      set email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now(),
          banned_until = null
      where id = v_user_id;
    end if;

  else
    -- NEW USER
    if p_password is null or char_length(p_password) < 8 then
      return jsonb_build_object('success', false, 'error', 'Password must be at least 8 characters');
    end if;

    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(trim(v_rec.email)),
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', coalesce(nullif(trim(p_full_name), ''), v_rec.full_name), 'phone', v_rec.phone),
      now(), now(),
      '', '', '', ''
    );
  end if;

  -- 3. Upsert public.profiles
  v_new_full_name := coalesce(nullif(trim(p_full_name), ''), v_rec.full_name);
  if v_new_full_name is null or v_new_full_name = '' then
    v_new_full_name := split_part(v_rec.email, '@', 1);
  end if;

  insert into public.profiles (id, display_name, email, phone)
  values (v_user_id, v_new_full_name, lower(trim(v_rec.email)), v_rec.phone)
  on conflict (id) do update set
    display_name = coalesce(nullif(trim(p_full_name), ''), excluded.display_name),
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone);

  -- 4. Upsert public.staff_memberships
  if v_rec.hospital_id is not null then
    insert into public.staff_memberships (
      user_id, hospital_id, facility_id, department_id,
      role_code, active, specialty, shift, gender, qualification,
      medical_registration_number, experience_years, consultation_fee,
      working_hours, administrative_notes, status
    ) values (
      v_user_id, v_rec.hospital_id, v_rec.facility_id, v_rec.department_id,
      v_rec.role_code, true, nullif(trim(v_rec.specialty), ''), nullif(trim(v_rec.shift), ''),
      nullif(trim(v_rec.gender), ''), nullif(trim(v_rec.qualification), ''),
      nullif(trim(v_rec.medical_registration_number), ''), v_rec.experience_years, v_rec.consultation_fee,
      v_rec.working_hours, v_rec.administrative_notes, 'Active'
    )
    on conflict (user_id) do update set
      hospital_id = excluded.hospital_id,
      facility_id = case when excluded.hospital_id != public.staff_memberships.hospital_id then excluded.facility_id else coalesce(excluded.facility_id, public.staff_memberships.facility_id) end,
      department_id = case when excluded.hospital_id != public.staff_memberships.hospital_id then excluded.department_id else coalesce(excluded.department_id, public.staff_memberships.department_id) end,
      role_code = excluded.role_code,
      active = true,
      status = 'Active',
      deleted_at = null,
      specialty = coalesce(nullif(trim(excluded.specialty), ''), public.staff_memberships.specialty),
      shift = coalesce(nullif(trim(excluded.shift), ''), public.staff_memberships.shift),
      gender = coalesce(nullif(trim(excluded.gender), ''), public.staff_memberships.gender),
      qualification = coalesce(nullif(trim(excluded.qualification), ''), public.staff_memberships.qualification),
      medical_registration_number = coalesce(nullif(trim(excluded.medical_registration_number), ''), public.staff_memberships.medical_registration_number),
      experience_years = coalesce(excluded.experience_years, public.staff_memberships.experience_years),
      consultation_fee = coalesce(excluded.consultation_fee, public.staff_memberships.consultation_fee),
      working_hours = coalesce(excluded.working_hours, public.staff_memberships.working_hours),
      administrative_notes = coalesce(excluded.administrative_notes, public.staff_memberships.administrative_notes),
      updated_at = now();

    -- Also insert into staff_roles so they have a permanent record of this role
    insert into public.staff_roles (user_id, hospital_id, role_code)
    values (v_user_id, v_rec.hospital_id, v_rec.role_code)
    on conflict do nothing;
  end if;

  if v_rec.role_code = 'super_admin' then
    insert into public.platform_admins (user_id, active)
    values (v_user_id, true)
    on conflict (user_id) do update set active = true, updated_at = now();
  end if;

  -- 5. Mark token as used
  update public.invite_tokens
  set used_at = now()
  where token = v_clean_token;

  -- 6. Log audit event if clinic-specific
  if v_rec.hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_rec.hospital_id, v_user_id, v_rec.role_code, 'staff.activated', 'staff_membership', v_user_id::text
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'userId', v_user_id,
    'user_id', v_user_id,
    'email', lower(trim(v_rec.email)),
    'roleCode', v_rec.role_code,
    'role', coalesce(v_rec.role_code, 'platform_admin'),
    'hospitalId', v_rec.hospital_id,
    'message', 'Account activated successfully'
  );
EXCEPTION WHEN OTHERS THEN
  return jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_invited_user(text, text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
