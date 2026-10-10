-- Fix Supabase auth.users NULL token error which causes "Database error querying schema" on login

-- 1. Fix the RPC to insert empty strings instead of NULLs for token columns
CREATE OR REPLACE FUNCTION public.activate_invited_user(
  p_token text,
  p_password text DEFAULT NULL,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_rec record;
  v_user_id uuid;
  v_existing_user_id uuid;
  v_new_full_name text;
BEGIN
  -- 1. Validate token
  if p_token is null or trim(p_token) = '' then
    return jsonb_build_object('success', false, 'error', 'Invalid token');
  end if;

  select * into v_rec
  from public.invite_tokens
  where token = p_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invitation not found or invalid');
  end if;

  if v_rec.used_at is not null then
    return jsonb_build_object('success', false, 'error', 'This invitation has already been used');
  end if;

  if v_rec.expires_at < now() then
    return jsonb_build_object('success', false, 'error', 'This invitation has expired');
  end if;

  -- 5. Create or update auth.users
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
      jsonb_build_object('full_name', v_rec.full_name, 'phone', v_rec.phone),
      now(), now(),
      '', '', '', ''
    );
  end if;

  -- 6. Upsert public.profiles
  v_new_full_name := coalesce(trim(p_full_name), v_rec.full_name);
  if v_new_full_name is null or v_new_full_name = '' then
    v_new_full_name := split_part(v_rec.email, '@', 1);
  end if;

  insert into public.profiles (id, display_name, email, phone)
  values (v_user_id, v_new_full_name, lower(trim(v_rec.email)), v_rec.phone)
  on conflict (id) do update set
    display_name = coalesce(trim(p_full_name), excluded.display_name),
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone);

  -- 7. Upsert public.staff_memberships
  if v_rec.hospital_id is not null then
    insert into public.staff_memberships (
      user_id, hospital_id, facility_id, department_id, role_code, active, status
    ) values (
      v_user_id, v_rec.hospital_id, v_rec.facility_id, v_rec.department_id, v_rec.role_code, true, 'Active'
    )
    on conflict (user_id) do update set
      hospital_id = excluded.hospital_id,
      facility_id = excluded.facility_id,
      department_id = excluded.department_id,
      role_code = excluded.role_code,
      active = true,
      status = 'Active',
      deleted_at = null,
      updated_at = now();
      
    -- Also insert into staff_roles so they have a permanent record of this role
    insert into public.staff_roles (user_id, hospital_id, role_code)
    values (v_user_id, v_rec.hospital_id, v_rec.role_code)
    on conflict do nothing;
  end if;

  -- 8. Mark token as used
  update public.invite_tokens
  set used_at = now()
  where token = p_token;

  -- 9. Log audit event if clinic-specific
  if v_rec.hospital_id is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id
    ) values (
      v_rec.hospital_id, v_user_id, v_rec.role_code, 'staff.activated', 'staff_membership', v_user_id::text
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', coalesce(v_rec.role_code, 'platform_admin'),
    'message', 'Account activated successfully'
  );
EXCEPTION WHEN OTHERS THEN
  return jsonb_build_object('success', false, 'error', sqlerrm);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_invited_user(text, text, text) TO anon, authenticated;

-- 2. Bulk fix all corrupted auth.users records created by the old RPC
UPDATE auth.users
SET confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = ''
WHERE confirmation_token IS NULL OR recovery_token IS NULL OR email_change_token_new IS NULL OR email_change IS NULL;
