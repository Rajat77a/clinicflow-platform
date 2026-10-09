-- 1. Create a table to track all roles a user has been granted
CREATE TABLE IF NOT EXISTS public.staff_roles (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.roles(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, hospital_id, role_code)
);

-- 2. Backfill existing roles from staff_memberships
INSERT INTO public.staff_roles (user_id, hospital_id, role_code)
SELECT user_id, hospital_id, role_code FROM public.staff_memberships
ON CONFLICT DO NOTHING;

-- 3. Enable RLS on staff_roles
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own roles"
  ON public.staff_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Create an RPC to let users switch their active role
CREATE OR REPLACE FUNCTION public.switch_active_role(p_role_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_has_role boolean;
  v_hospital_id uuid;
BEGIN
  -- Check if they actually have this role
  SELECT EXISTS(
    SELECT 1 FROM public.staff_roles 
    WHERE user_id = auth.uid() AND role_code = p_role_code
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to switch to this role.');
  END IF;

  -- Get the hospital_id for this role
  SELECT hospital_id INTO v_hospital_id FROM public.staff_roles 
  WHERE user_id = auth.uid() AND role_code = p_role_code
  LIMIT 1;

  -- Update their active role in staff_memberships
  UPDATE public.staff_memberships
  SET role_code = p_role_code, hospital_id = v_hospital_id
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object('success', true, 'role_code', p_role_code);
END;
$$;
NOTIFY pgrst, 'reload schema';

-- 5. Update activate_invited_user to ALSO insert into staff_roles
CREATE OR REPLACE FUNCTION public.activate_invited_user(
  p_token text,
  p_password text
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
BEGIN
  v_clean_token := trim(p_token);

  if v_clean_token is null or v_clean_token = '' then
    return jsonb_build_object('success', false, 'error', 'No invitation token was provided');
  end if;

  if p_password is not null and char_length(p_password) < 8 then
    return jsonb_build_object('success', false, 'error', 'Password must be at least 8 characters');
  end if;

  select * into v_rec
  from public.invite_tokens
  where lower(trim(token)) = lower(v_clean_token)
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'This invitation link is invalid');
  end if;

  if v_rec.used_at is not null then
    return jsonb_build_object('success', false, 'error', 'This invitation link has already been used');
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

  select id into v_existing_user_id
  from auth.users
  where lower(email) = lower(trim(v_rec.email));

  if v_existing_user_id is not null then
    v_user_id := v_existing_user_id;
    update auth.users
    set 
        encrypted_password = case 
            when p_password is not null then extensions.crypt(p_password, extensions.gen_salt('bf'))
            else encrypted_password
        end,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', v_rec.full_name, 'phone', v_rec.phone),
        updated_at = now(),
        banned_until = null
    where id = v_user_id;
  else
    if p_password is null then
        return jsonb_build_object('success', false, 'error', 'Password is required for new users');
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
      now(),
      now()
    );
  end if;

  begin
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text,
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
      'email',
      now(), now(), now()
    )
    on conflict (provider_id, provider) do update set
      identity_data = jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
      updated_at = now();
  exception when others then
    begin
      insert into auth.identities (
        id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id::text,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(v_rec.email))),
        'email',
        now(), now(), now()
      )
      on conflict do nothing;
    exception when others then
      null;
    end;
  end;

  insert into public.profiles (id, display_name, email, phone)
  values (v_user_id, trim(v_rec.full_name), lower(trim(v_rec.email)), v_rec.phone)
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email,
    phone = excluded.phone,
    updated_at = now();

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

    -- ALSO insert into staff_roles so they have a permanent record of this role
    insert into public.staff_roles (user_id, hospital_id, role_code)
    values (v_user_id, v_rec.hospital_id, v_rec.role_code)
    on conflict do nothing;
  end if;

  if v_rec.role_code = 'super_admin' then
    insert into public.platform_admins (user_id, active)
    values (v_user_id, true)
    on conflict (user_id) do update set active = true, updated_at = now();
  end if;

  update public.invite_tokens
  set used_at = now()
  where token = v_clean_token;

  return jsonb_build_object(
    'success', true,
    'userId', v_user_id,
    'email', lower(trim(v_rec.email)),
    'roleCode', v_rec.role_code,
    'hospitalId', v_rec.hospital_id
  );
end;
$$;
