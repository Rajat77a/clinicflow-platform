begin;

do $$
declare
  unprotected_tables text[];
begin
  select array_agg(c.relname order by c.relname)
  into unprotected_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'hospitals', 'facilities', 'departments', 'profiles', 'roles',
      'permissions', 'role_permissions', 'staff_memberships', 'patients',
      'patient_care_teams', 'appointments', 'encounters', 'prescriptions',
      'prescription_items', 'lab_orders', 'lab_results', 'invoices',
      'invoice_items', 'payments', 'documents', 'notifications',
      'audit_events', 'idempotency_keys'
    )
    and not c.relrowsecurity;

  if unprotected_tables is not null then
    raise exception 'RLS is disabled for: %', unprotected_tables;
  end if;
end
$$;

do $$
declare
  exposed_tables text[];
begin
  select array_agg(tablename order by tablename)
  into exposed_tables
  from pg_tables
  where schemaname = 'public'
    and has_table_privilege('anon', format('%I.%I', schemaname, tablename), 'SELECT,INSERT,UPDATE,DELETE');

  if exposed_tables is not null then
    raise exception 'Anonymous table privileges found for: %', exposed_tables;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from public.role_permissions
    where role_code = 'receptionist'
      and permission_code in ('prescriptions.read', 'prescriptions.write', 'labs.read', 'labs.write')
  ) then
    raise exception 'Reception role has clinical prescribing or lab permissions';
  end if;

  if not exists (
    select 1 from public.role_permissions
    where role_code = 'doctor' and permission_code = 'prescriptions.write'
  ) then
    raise exception 'Doctor role cannot write prescriptions';
  end if;

  if not exists (
    select 1 from public.role_permissions
    where role_code = 'clinic_admin' and permission_code = 'prescriptions.read'
  ) then
    raise exception 'Hospital administrator cannot review prescriptions';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'hospital-documents'
      and public = false
      and file_size_limit = 104857600
  ) then
    raise exception 'Private hospital document bucket is missing or misconfigured';
  end if;
end
$$;

do $$
declare
  unsafe_functions text[];
begin
  select array_agg(p.proname order by p.proname)
  into unsafe_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in (
      'current_hospital_id', 'current_role_code', 'current_clinical_scope',
      'has_permission', 'can_access_patient', 'handle_new_auth_user',
      'assign_appointment_doctor'
    )
    and (
      not p.prosecdef
      or not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) setting
        where setting like 'search_path=%'
      )
    );

  if unsafe_functions is not null then
    raise exception 'Privileged functions lack SECURITY DEFINER or an empty search_path: %', unsafe_functions;
  end if;
end
$$;

rollback;
