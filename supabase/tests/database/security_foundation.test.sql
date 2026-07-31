begin;

create extension if not exists pgtap with schema extensions;
select plan(1);

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
declare
  missing_queues text[];
begin
  select array_agg(required_queue order by required_queue)
  into missing_queues
  from unnest(array[
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  ]) required_queue
  where not exists (
    select 1
    from pgmq.list_queues() existing
    where existing.queue_name = required_queue
  );

  if missing_queues is not null then
    raise exception 'Required system queues are missing: %', missing_queues;
  end if;

  if has_schema_privilege('authenticated', 'pgmq', 'USAGE')
    or has_schema_privilege('anon', 'pgmq', 'USAGE') then
    raise exception 'Browser roles can access raw queue payloads';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.enqueue_system_job(text, jsonb, integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.read_system_jobs(text, integer, integer)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated clients can enqueue or claim system jobs';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'hospital-document-quarantine'
      and public = false
      and file_size_limit = 26214400
      and allowed_mime_types @> array[
        'application/pdf',
        'image/jpeg',
        'image/png'
      ]::text[]
      and allowed_mime_types <@ array[
        'application/pdf',
        'image/jpeg',
        'image/png'
      ]::text[]
  ) then
    raise exception 'Private document quarantine bucket is missing or unsafe';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.register_document_quarantine(uuid, uuid, uuid, text, text, text, bigint, text, text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.record_document_scan_result(uuid, boolean, text, text, text, text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.record_document_scan_failure(uuid, text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated clients can bypass the document scanner boundary';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('authenticated', 'public.roles', 'INSERT')
    or has_table_privilege('authenticated', 'public.roles', 'UPDATE')
    or has_table_privilege('authenticated', 'public.roles', 'DELETE')
  then
    raise exception 'Authenticated clients can modify authorization roles';
  end if;

  if has_table_privilege('authenticated', 'public.role_permissions', 'INSERT')
    or has_table_privilege('authenticated', 'public.role_permissions', 'UPDATE')
    or has_table_privilege('authenticated', 'public.role_permissions', 'DELETE')
  then
    raise exception 'Authenticated clients can modify role permissions';
  end if;

  if has_table_privilege('authenticated', 'public.staff_memberships', 'INSERT')
    or has_table_privilege('authenticated', 'public.staff_memberships', 'UPDATE')
    or has_table_privilege('authenticated', 'public.staff_memberships', 'DELETE')
  then
    raise exception 'Authenticated clients can assign hospital roles directly';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE') then
    raise exception 'Profile email can be changed outside the authentication service';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
    or not has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE')
  then
    raise exception 'Users cannot maintain permitted profile fields';
  end if;
end
$$;

do $$
begin
  perform public.assert_staff_role_assignment('super_admin', 'clinic_admin');
  perform public.assert_staff_role_assignment('clinic_admin', 'doctor');

  begin
    perform public.assert_staff_role_assignment('clinic_admin', 'super_admin');
    raise exception 'Clinic administrator escalation was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.assert_staff_role_assignment('doctor', 'receptionist');
    raise exception 'Clinical staff role assignment was accepted';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'hospital-documents'
      and public = false
      and file_size_limit = 26214400
      and allowed_mime_types @> array[
        'application/pdf',
        'image/jpeg',
        'image/png'
      ]::text[]
      and allowed_mime_types <@ array[
        'application/pdf',
        'image/jpeg',
        'image/png'
      ]::text[]
  ) then
    raise exception 'Private hospital document bucket is missing or misconfigured';
  end if;
end
$$;

do $$
begin
  if has_table_privilege('authenticated', 'public.documents', 'INSERT')
    or has_table_privilege('authenticated', 'public.documents', 'UPDATE')
    or has_table_privilege('authenticated', 'public.documents', 'DELETE')
  then
    raise exception 'Browser clients can mutate trusted document metadata';
  end if;

  if exists (
    select 1
    from public.role_permissions
    where permission_code = 'documents.write'
  ) then
    raise exception 'A browser role can still upload hospital documents';
  end if;

  if exists (
    select 1
    from public.role_permissions
    where role_code = 'doctor'
      and permission_code = 'documents.read'
  ) then
    raise exception 'Doctors can access hospital-wide object storage without patient scoping';
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

do $$
declare
  directory_is_definer boolean;
begin
  select p.prosecdef
  into directory_is_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'search_patients'
    and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_limit integer, p_offset integer';

  if directory_is_definer is null then
    raise exception 'Paginated patient directory function is missing';
  end if;
  if directory_is_definer then
    raise exception 'Patient directory bypasses caller RLS';
  end if;
  if has_function_privilege(
    'anon',
    'public.search_patients(text, integer, integer)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous users can search the patient directory';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.search_patients(text, integer, integer)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated hospital roles cannot use the patient directory';
  end if;
end
$$;

do $$
declare
  missing_indexes text[];
begin
  select array_agg(index_name order by index_name)
  into missing_indexes
  from unnest(array[
    'public.prescriptions_hospital_created_idx',
    'public.invoices_hospital_created_idx',
    'public.lab_results_recorded_idx',
    'public.audit_events_action_search_idx'
  ]) index_name
  where to_regclass(index_name) is null;

  if missing_indexes is not null then
    raise exception 'Paginated clinical record indexes are missing: %', missing_indexes;
  end if;
end
$$;

select pass('ClinicFlow database security foundation is intact');
select * from finish();

rollback;
