create or replace function public.activate_invited_user(
  p_token text,
  p_password text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'extensions', 'private'
as $$
declare
  v_rec record;
  v_user_id uuid;
  v_clean_token text;
  v_hospital_active boolean;
  v_hospital_config jsonb;
  v_existing_user_id uuid;
begin
  v_clean_token := trim(p_token);

  if v_clean_token is null or v_clean_token = '' then
    return jsonb_build_object('success', false, 'error', 'No invitation token was provided');
  end if;

  select * into v_rec
  from public.invite_tokens
  where token = v_clean_token;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid invitation token');
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
      created_at, updated_at
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
      now(), now()
    );
  end if;

  -- 6. Upsert public.profiles
  insert into public.profiles (id, display_name, email, phone)
  values (
    v_user_id,
    v_rec.full_name,
    lower(trim(v_rec.email)),
    v_rec.phone
  )
  on conflict (id) do update set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    phone = coalesce(public.profiles.phone, excluded.phone);

  -- 7. Insert staff membership
  insert into public.staff_memberships (
    user_id, hospital_id, role_code, facility_id, specialty, shift
  ) values (
    v_user_id, v_rec.hospital_id, v_rec.role_code, v_rec.facility_id, v_rec.specialty, v_rec.shift
  );

  -- 8. Mark token as used
  update public.invite_tokens
  set used_at = now()
  where id = v_rec.id;

  return jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'role', v_rec.role_code,
    'hospital_id', v_rec.hospital_id
  );
end;
$$;
NOTIFY pgrst, 'reload schema';
