-- ClinicFlow production foundation.
-- One deployment and database is dedicated to one hospital. hospital_id remains
-- on protected rows to enforce boundaries between facilities and prevent future
-- imports or configuration mistakes from crossing the installation boundary.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  name text not null check (char_length(name) between 2 and 160),
  legal_name text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en-IN',
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9_-]{2,24}$'),
  name text not null check (char_length(name) between 2 and 160),
  timezone text,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, code),
  unique (id, hospital_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  code text not null check (code ~ '^[A-Z0-9_-]{2,24}$'),
  name text not null check (char_length(name) between 2 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, code),
  unique (id, hospital_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New user' check (char_length(display_name) between 2 and 160),
  email text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{2,47}$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  clinical_scope text not null default 'none'
    check (clinical_scope in ('none', 'assigned', 'all')),
  system_role boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_.]{2,79}$'),
  description text not null
);

create table public.role_permissions (
  role_code text not null references public.roles(code) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table public.staff_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  facility_id uuid references public.facilities(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  role_code text not null references public.roles(code) on delete restrict,
  employee_number text,
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, employee_number),
  unique (user_id, hospital_id),
  foreign key (facility_id, hospital_id) references public.facilities(id, hospital_id) on delete restrict,
  foreign key (department_id, hospital_id) references public.departments(id, hospital_id) on delete restrict
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  medical_record_number text not null check (char_length(medical_record_number) between 3 and 64),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  date_of_birth date not null check (date_of_birth <= current_date),
  sex text check (sex in ('female', 'male', 'intersex', 'unknown', 'not_disclosed')),
  blood_group text,
  phone text,
  email text,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  emergency_contact jsonb not null default '{}'::jsonb check (jsonb_typeof(emergency_contact) = 'object'),
  allergies text[] not null default '{}',
  chronic_conditions text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'deceased', 'merged')),
  merged_into_patient_id uuid references public.patients(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, medical_record_number),
  unique (id, hospital_id),
  check (merged_into_patient_id is null or merged_into_patient_id <> id)
);

create table public.patient_care_teams (
  patient_id uuid not null references public.patients(id) on delete cascade,
  staff_user_id uuid not null references public.staff_memberships(user_id) on delete cascade,
  relationship text not null default 'care_team',
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  primary key (patient_id, staff_user_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  patient_id uuid not null,
  doctor_user_id uuid not null references public.staff_memberships(user_id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show')),
  reason text not null check (char_length(reason) between 2 and 500),
  administrative_notes text,
  cancellation_reason text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  foreign key (facility_id, hospital_id) references public.facilities(id, hospital_id) on delete restrict,
  foreign key (department_id, hospital_id) references public.departments(id, hospital_id) on delete restrict,
  foreign key (doctor_user_id, hospital_id) references public.staff_memberships(user_id, hospital_id) on delete restrict,
  check (ends_at > starts_at),
  check (
    (status = 'cancelled' and cancellation_reason is not null)
    or (status <> 'cancelled' and cancellation_reason is null)
  )
);

alter table public.appointments
  add constraint appointments_no_doctor_overlap
  exclude using gist (
    doctor_user_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('scheduled', 'confirmed', 'checked_in', 'in_progress'));

create table public.encounters (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  appointment_id uuid unique references public.appointments(id) on delete restrict,
  patient_id uuid not null,
  clinician_user_id uuid not null references public.staff_memberships(user_id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'completed', 'amended')),
  chief_complaint text,
  clinical_notes text,
  diagnoses text[] not null default '{}',
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  foreign key (clinician_user_id, hospital_id) references public.staff_memberships(user_id, hospital_id) on delete restrict
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  encounter_id uuid references public.encounters(id) on delete restrict,
  patient_id uuid not null,
  prescriber_user_id uuid not null references public.staff_memberships(user_id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'signed', 'cancelled')),
  instructions text,
  follow_up_at timestamptz,
  signed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  foreign key (prescriber_user_id, hospital_id) references public.staff_memberships(user_id, hospital_id) on delete restrict,
  check ((status = 'signed' and signed_at is not null) or status <> 'signed')
);

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  medicine_name text not null check (char_length(medicine_name) between 1 and 200),
  dosage text not null,
  frequency text not null,
  duration text not null,
  instructions text,
  created_at timestamptz not null default now()
);

create table public.lab_orders (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  patient_id uuid not null,
  encounter_id uuid references public.encounters(id) on delete restrict,
  ordered_by uuid not null references public.staff_memberships(user_id) on delete restrict,
  test_code text not null,
  test_name text not null,
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'stat')),
  status text not null default 'ordered'
    check (status in ('ordered', 'collected', 'processing', 'completed', 'cancelled')),
  clinical_notes text,
  ordered_at timestamptz not null default now(),
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  foreign key (ordered_by, hospital_id) references public.staff_memberships(user_id, hospital_id) on delete restrict
);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  lab_order_id uuid not null references public.lab_orders(id) on delete restrict,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  interpretation text,
  status text not null default 'preliminary' check (status in ('preliminary', 'final', 'corrected')),
  recorded_by uuid not null references public.staff_memberships(user_id) on delete restrict,
  verified_by uuid references public.staff_memberships(user_id) on delete restrict,
  recorded_at timestamptz not null default now(),
  verified_at timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  patient_id uuid not null,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) generated always as (subtotal + tax - discount) stored,
  issued_at timestamptz,
  due_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  unique (hospital_id, invoice_number),
  check (discount <= subtotal + tax)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  amount numeric(14,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  method text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  external_reference text,
  received_by uuid references public.profiles(id) on delete restrict,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (hospital_id, external_reference)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete restrict,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  storage_bucket text not null default 'hospital-documents',
  storage_path text not null,
  original_filename text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 104857600),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  category text not null,
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'rejected', 'failed')),
  created_at timestamptz not null default now(),
  foreign key (patient_id, hospital_id) references public.patients(id, hospital_id) on delete restrict,
  foreign key (uploaded_by, hospital_id) references public.staff_memberships(user_id, hospital_id) on delete restrict,
  unique (storage_bucket, storage_path)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  request_id uuid,
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'failure')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create table public.idempotency_keys (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null check (char_length(key) between 16 and 200),
  command text not null,
  response_code integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (hospital_id, actor_user_id, key),
  check (expires_at > created_at)
);

create index staff_memberships_hospital_idx on public.staff_memberships(hospital_id, active);
create index patients_hospital_name_idx on public.patients(hospital_id, last_name, first_name);
create index patients_hospital_phone_idx on public.patients(hospital_id, phone) where phone is not null;
create index care_team_staff_idx on public.patient_care_teams(staff_user_id, active);
create index appointments_hospital_start_idx on public.appointments(hospital_id, starts_at);
create index appointments_doctor_start_idx on public.appointments(doctor_user_id, starts_at);
create index appointments_patient_start_idx on public.appointments(patient_id, starts_at desc);
create index encounters_patient_idx on public.encounters(patient_id, created_at desc);
create index prescriptions_patient_idx on public.prescriptions(patient_id, created_at desc);
create index lab_orders_patient_idx on public.lab_orders(patient_id, ordered_at desc);
create index invoices_patient_idx on public.invoices(patient_id, created_at desc);
create index documents_patient_idx on public.documents(patient_id, created_at desc);
create index notifications_recipient_idx on public.notifications(recipient_user_id, read_at, created_at desc);
create index audit_events_hospital_time_idx on public.audit_events(hospital_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id);

insert into public.permissions (code, description) values
  ('settings.manage', 'Manage hospital installation settings'),
  ('facilities.manage', 'Manage facilities and departments'),
  ('people.read', 'View staff and roles'),
  ('people.manage', 'Create and manage staff and role assignments'),
  ('patients.read', 'View authorized patient records'),
  ('patients.write', 'Create and update authorized patient records'),
  ('appointments.read', 'View authorized appointments'),
  ('appointments.write', 'Create and update authorized appointments'),
  ('encounters.read', 'View authorized encounters'),
  ('encounters.write', 'Create and update authorized encounters'),
  ('prescriptions.read', 'View authorized prescriptions'),
  ('prescriptions.write', 'Create and sign authorized prescriptions'),
  ('labs.read', 'View authorized lab orders and results'),
  ('labs.write', 'Create and update authorized lab orders and results'),
  ('billing.read', 'View authorized invoices and payments'),
  ('billing.write', 'Create and update authorized invoices and payments'),
  ('documents.read', 'View authorized documents'),
  ('documents.write', 'Upload and manage authorized documents'),
  ('reports.read', 'View operational reports'),
  ('audit.read', 'View hospital audit events'),
  ('exports.create', 'Create authorized data exports');

insert into public.roles (code, name, description, clinical_scope, system_role) values
  ('super_admin', 'System administrator', 'Installation and staff administration without default clinical access', 'none', true),
  ('clinic_admin', 'Hospital administrator', 'Hospital operations administrator', 'all', true),
  ('doctor', 'Doctor', 'Clinician restricted to assigned patients and own queue', 'assigned', true),
  ('receptionist', 'Receptionist', 'Front desk, registration, scheduling and billing', 'all', true);

insert into public.role_permissions (role_code, permission_code)
select 'super_admin', code from public.permissions
where code in ('settings.manage', 'facilities.manage', 'people.read', 'people.manage', 'reports.read', 'audit.read');

insert into public.role_permissions (role_code, permission_code)
select 'clinic_admin', code from public.permissions
where code in (
  'settings.manage', 'facilities.manage', 'people.read', 'people.manage',
  'patients.read', 'patients.write', 'appointments.read', 'appointments.write',
  'encounters.read', 'prescriptions.read', 'labs.read', 'labs.write', 'billing.read', 'billing.write',
  'documents.read', 'documents.write', 'reports.read', 'audit.read', 'exports.create'
);

insert into public.role_permissions (role_code, permission_code)
select 'doctor', code from public.permissions
where code in (
  'patients.read', 'appointments.read', 'appointments.write', 'encounters.read',
  'encounters.write', 'prescriptions.read', 'prescriptions.write', 'labs.read',
  'labs.write', 'documents.read'
);

insert into public.role_permissions (role_code, permission_code)
select 'receptionist', code from public.permissions
where code in (
  'patients.read', 'patients.write', 'appointments.read', 'appointments.write',
  'billing.read', 'billing.write', 'documents.read', 'documents.write',
  'exports.create'
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger hospitals_touch before update on public.hospitals
for each row execute function private.set_updated_at();
create trigger facilities_touch before update on public.facilities
for each row execute function private.set_updated_at();
create trigger departments_touch before update on public.departments
for each row execute function private.set_updated_at();
create trigger profiles_touch before update on public.profiles
for each row execute function private.set_updated_at();
create trigger staff_memberships_touch before update on public.staff_memberships
for each row execute function private.set_updated_at();
create trigger patients_version before update on public.patients
for each row execute function private.bump_version();
create trigger appointments_version before update on public.appointments
for each row execute function private.bump_version();
create trigger encounters_version before update on public.encounters
for each row execute function private.bump_version();
create trigger prescriptions_version before update on public.prescriptions
for each row execute function private.bump_version();
create trigger lab_orders_version before update on public.lab_orders
for each row execute function private.bump_version();
create trigger lab_results_version before update on public.lab_results
for each row execute function private.bump_version();
create trigger invoices_version before update on public.invoices
for each row execute function private.bump_version();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'New user'), '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.current_hospital_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select hospital_id
  from public.staff_memberships
  where user_id = auth.uid() and active
  limit 1
$$;

create or replace function private.current_role_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role_code
  from public.staff_memberships
  where user_id = auth.uid() and active
  limit 1
$$;

create or replace function private.current_clinical_scope()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.clinical_scope
  from public.staff_memberships m
  join public.roles r on r.code = m.role_code
  where m.user_id = auth.uid() and m.active
  limit 1
$$;

create or replace function private.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_memberships m
    join public.role_permissions rp on rp.role_code = m.role_code
    where m.user_id = auth.uid()
      and m.active
      and rp.permission_code = permission_name
  )
$$;

create or replace function private.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_permission('patients.read')
    and exists (
      select 1
      from public.patients p
      where p.id = target_patient_id
        and p.hospital_id = private.current_hospital_id()
        and (
          private.current_clinical_scope() = 'all'
          or (
            private.current_clinical_scope() = 'assigned'
            and exists (
              select 1
              from public.patient_care_teams pct
              where pct.patient_id = p.id
                and pct.staff_user_id = auth.uid()
                and pct.active
            )
          )
        )
    )
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_hospital_id() to authenticated;
grant execute on function private.current_role_code() to authenticated;
grant execute on function private.current_clinical_scope() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.can_access_patient(uuid) to authenticated;

create or replace function private.assign_appointment_doctor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.patient_care_teams (patient_id, staff_user_id, relationship, assigned_by)
  values (new.patient_id, new.doctor_user_id, 'appointment', auth.uid())
  on conflict (patient_id, staff_user_id)
  do update set active = true, relationship = excluded.relationship;
  return new;
end;
$$;

create trigger appointment_assigns_doctor
after insert or update of doctor_user_id on public.appointments
for each row execute function private.assign_appointment_doctor();

create or replace function private.protect_signed_prescription()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'signed' then
    raise exception 'signed prescriptions are immutable';
  end if;
  return new;
end;
$$;

create trigger prescription_immutable_after_signing
before update or delete on public.prescriptions
for each row execute function private.protect_signed_prescription();

create or replace function private.protect_signed_prescription_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status text;
  target_prescription_id uuid;
begin
  if tg_op = 'DELETE' then
    target_prescription_id = old.prescription_id;
  else
    target_prescription_id = new.prescription_id;
  end if;
  select status into parent_status
  from public.prescriptions
  where id = target_prescription_id;
  if parent_status = 'signed' then
    raise exception 'items on signed prescriptions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prescription_items_immutable_after_signing
before insert or update or delete on public.prescription_items
for each row execute function private.protect_signed_prescription_item();

create or replace function private.capture_row_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target_hospital uuid;
  target_id text;
begin
  row_data = case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  target_hospital = coalesce(
    nullif(row_data ->> 'hospital_id', '')::uuid,
    private.current_hospital_id()
  );
  target_id = row_data ->> 'id';

  if target_hospital is not null then
    insert into public.audit_events (
      hospital_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata
    )
    values (
      target_hospital,
      auth.uid(),
      private.current_role_code(),
      lower(tg_op),
      tg_table_name,
      target_id,
      jsonb_build_object('source', 'database_trigger')
    );
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger patients_audit after insert or update or delete on public.patients
for each row execute function private.capture_row_audit();
create trigger appointments_audit after insert or update or delete on public.appointments
for each row execute function private.capture_row_audit();
create trigger encounters_audit after insert or update or delete on public.encounters
for each row execute function private.capture_row_audit();
create trigger prescriptions_audit after insert or update or delete on public.prescriptions
for each row execute function private.capture_row_audit();
create trigger lab_orders_audit after insert or update or delete on public.lab_orders
for each row execute function private.capture_row_audit();
create trigger invoices_audit after insert or update or delete on public.invoices
for each row execute function private.capture_row_audit();
create trigger payments_audit after insert or update or delete on public.payments
for each row execute function private.capture_row_audit();
create trigger documents_audit after insert or update or delete on public.documents
for each row execute function private.capture_row_audit();
create trigger staff_memberships_audit after insert or update or delete on public.staff_memberships
for each row execute function private.capture_row_audit();

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit events are append-only';
  return null;
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.prevent_audit_mutation();

alter table public.hospitals enable row level security;
alter table public.facilities enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.patients enable row level security;
alter table public.patient_care_teams enable row level security;
alter table public.appointments enable row level security;
alter table public.encounters enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.lab_orders enable row level security;
alter table public.lab_results enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
alter table public.idempotency_keys enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, update on public.hospitals to authenticated;
grant select, insert, update on public.facilities, public.departments to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.roles, public.role_permissions to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.staff_memberships to authenticated;
grant select, insert, update on public.patients to authenticated;
grant select, insert, update, delete on public.patient_care_teams to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert, update on public.encounters to authenticated;
grant select, insert, update on public.prescriptions, public.prescription_items to authenticated;
grant select, insert, update on public.lab_orders, public.lab_results to authenticated;
grant select, insert, update on public.invoices, public.invoice_items, public.payments to authenticated;
grant select, insert, update on public.documents to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_events to authenticated;
grant select, insert, update on public.idempotency_keys to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy hospitals_select on public.hospitals
for select to authenticated
using (id = private.current_hospital_id());
create policy hospitals_update on public.hospitals
for update to authenticated
using (id = private.current_hospital_id() and private.has_permission('settings.manage'))
with check (id = private.current_hospital_id() and private.has_permission('settings.manage'));

create policy facilities_select on public.facilities
for select to authenticated using (hospital_id = private.current_hospital_id());
create policy facilities_insert on public.facilities
for insert to authenticated
with check (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'));
create policy facilities_update on public.facilities
for update to authenticated
using (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'))
with check (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'));

create policy departments_select on public.departments
for select to authenticated using (hospital_id = private.current_hospital_id());
create policy departments_insert on public.departments
for insert to authenticated
with check (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'));
create policy departments_update on public.departments
for update to authenticated
using (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'))
with check (hospital_id = private.current_hospital_id() and private.has_permission('facilities.manage'));

create policy profiles_select_self_or_staff on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or (
    private.has_permission('people.read')
    and exists (
      select 1 from public.staff_memberships sm
      where sm.user_id = profiles.id
        and sm.hospital_id = private.current_hospital_id()
    )
  )
);
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy roles_select on public.roles
for select to authenticated using (private.current_hospital_id() is not null);
create policy roles_manage_insert on public.roles
for insert to authenticated with check (private.has_permission('people.manage') and not system_role);
create policy roles_manage_update on public.roles
for update to authenticated
using (private.has_permission('people.manage') and not system_role)
with check (private.has_permission('people.manage') and not system_role);
create policy roles_manage_delete on public.roles
for delete to authenticated using (private.has_permission('people.manage') and not system_role);

create policy permissions_select on public.permissions
for select to authenticated using (private.current_hospital_id() is not null);
create policy role_permissions_select on public.role_permissions
for select to authenticated using (private.current_hospital_id() is not null);
create policy role_permissions_manage_insert on public.role_permissions
for insert to authenticated
with check (
  private.has_permission('people.manage')
  and not exists (select 1 from public.roles r where r.code = role_code and r.system_role)
);
create policy role_permissions_manage_delete on public.role_permissions
for delete to authenticated
using (
  private.has_permission('people.manage')
  and not exists (select 1 from public.roles r where r.code = role_code and r.system_role)
);

create policy memberships_select on public.staff_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.read'))
);
create policy memberships_insert on public.staff_memberships
for insert to authenticated
with check (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'));
create policy memberships_update on public.staff_memberships
for update to authenticated
using (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
with check (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'));
create policy memberships_delete on public.staff_memberships
for delete to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('people.manage')
  and user_id <> auth.uid()
);

create policy patients_select on public.patients
for select to authenticated using (private.can_access_patient(id));
create policy patients_insert on public.patients
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('patients.write')
  and created_by = auth.uid()
);
create policy patients_update on public.patients
for update to authenticated
using (private.can_access_patient(id) and private.has_permission('patients.write'))
with check (hospital_id = private.current_hospital_id());

create policy care_teams_select on public.patient_care_teams
for select to authenticated
using (
  staff_user_id = auth.uid()
  or (
    private.current_clinical_scope() = 'all'
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.hospital_id = private.current_hospital_id()
    )
  )
);
create policy care_teams_manage_insert on public.patient_care_teams
for insert to authenticated
with check (
  private.current_clinical_scope() = 'all'
  and private.has_permission('appointments.write')
);
create policy care_teams_manage_update on public.patient_care_teams
for update to authenticated
using (private.current_clinical_scope() = 'all' and private.has_permission('appointments.write'))
with check (private.current_clinical_scope() = 'all' and private.has_permission('appointments.write'));
create policy care_teams_manage_delete on public.patient_care_teams
for delete to authenticated
using (private.current_clinical_scope() = 'all' and private.has_permission('appointments.write'));

create policy appointments_select on public.appointments
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('appointments.read')
  and (
    private.current_clinical_scope() = 'all'
    or doctor_user_id = auth.uid()
  )
);
create policy appointments_insert on public.appointments
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('appointments.write')
  and created_by = auth.uid()
  and (
    private.current_clinical_scope() = 'all'
    or doctor_user_id = auth.uid()
  )
);
create policy appointments_update on public.appointments
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('appointments.write')
  and (private.current_clinical_scope() = 'all' or doctor_user_id = auth.uid())
)
with check (
  hospital_id = private.current_hospital_id()
  and (private.current_clinical_scope() = 'all' or doctor_user_id = auth.uid())
);

create policy encounters_select on public.encounters
for select to authenticated
using (private.has_permission('encounters.read') and private.can_access_patient(patient_id));
create policy encounters_insert on public.encounters
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('encounters.write')
  and clinician_user_id = auth.uid()
  and private.can_access_patient(patient_id)
);
create policy encounters_update on public.encounters
for update to authenticated
using (
  private.has_permission('encounters.write')
  and clinician_user_id = auth.uid()
  and private.can_access_patient(patient_id)
)
with check (hospital_id = private.current_hospital_id() and clinician_user_id = auth.uid());

create policy prescriptions_select on public.prescriptions
for select to authenticated
using (private.has_permission('prescriptions.read') and private.can_access_patient(patient_id));
create policy prescriptions_insert on public.prescriptions
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('prescriptions.write')
  and prescriber_user_id = auth.uid()
  and private.can_access_patient(patient_id)
);
create policy prescriptions_update on public.prescriptions
for update to authenticated
using (
  private.has_permission('prescriptions.write')
  and prescriber_user_id = auth.uid()
  and private.can_access_patient(patient_id)
)
with check (hospital_id = private.current_hospital_id() and prescriber_user_id = auth.uid());

create policy prescription_items_select on public.prescription_items
for select to authenticated
using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and private.has_permission('prescriptions.read')
      and private.can_access_patient(p.patient_id)
  )
);
create policy prescription_items_insert on public.prescription_items
for insert to authenticated
with check (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.prescriber_user_id = auth.uid()
      and p.status = 'draft'
      and private.has_permission('prescriptions.write')
  )
);
create policy prescription_items_update on public.prescription_items
for update to authenticated
using (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.prescriber_user_id = auth.uid()
      and p.status = 'draft'
      and private.has_permission('prescriptions.write')
  )
)
with check (
  exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id
      and p.prescriber_user_id = auth.uid()
      and p.status = 'draft'
      and private.has_permission('prescriptions.write')
  )
);

create policy lab_orders_select on public.lab_orders
for select to authenticated
using (private.has_permission('labs.read') and private.can_access_patient(patient_id));
create policy lab_orders_insert on public.lab_orders
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('labs.write')
  and private.can_access_patient(patient_id)
);
create policy lab_orders_update on public.lab_orders
for update to authenticated
using (private.has_permission('labs.write') and private.can_access_patient(patient_id))
with check (hospital_id = private.current_hospital_id());

create policy lab_results_select on public.lab_results
for select to authenticated
using (
  exists (
    select 1 from public.lab_orders lo
    where lo.id = lab_order_id
      and private.has_permission('labs.read')
      and private.can_access_patient(lo.patient_id)
  )
);
create policy lab_results_insert on public.lab_results
for insert to authenticated
with check (
  recorded_by = auth.uid()
  and private.has_permission('labs.write')
  and exists (
    select 1 from public.lab_orders lo
    where lo.id = lab_order_id and private.can_access_patient(lo.patient_id)
  )
);
create policy lab_results_update on public.lab_results
for update to authenticated
using (
  private.has_permission('labs.write')
  and exists (
    select 1 from public.lab_orders lo
    where lo.id = lab_order_id and private.can_access_patient(lo.patient_id)
  )
)
with check (
  private.has_permission('labs.write')
  and exists (
    select 1 from public.lab_orders lo
    where lo.id = lab_order_id and private.can_access_patient(lo.patient_id)
  )
);

create policy invoices_select on public.invoices
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.read')
  and private.current_clinical_scope() = 'all'
);
create policy invoices_insert on public.invoices
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
  and created_by = auth.uid()
  and private.current_clinical_scope() = 'all'
);
create policy invoices_update on public.invoices
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
  and private.current_clinical_scope() = 'all'
)
with check (hospital_id = private.current_hospital_id());

create policy invoice_items_select on public.invoice_items
for select to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.hospital_id = private.current_hospital_id()
      and private.has_permission('billing.read')
      and private.current_clinical_scope() = 'all'
  )
);
create policy invoice_items_insert on public.invoice_items
for insert to authenticated
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.hospital_id = private.current_hospital_id()
      and i.status = 'draft'
      and private.has_permission('billing.write')
      and private.current_clinical_scope() = 'all'
  )
);
create policy invoice_items_update on public.invoice_items
for update to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.status = 'draft'
      and private.has_permission('billing.write')
      and private.current_clinical_scope() = 'all'
  )
)
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.status = 'draft'
      and private.has_permission('billing.write')
      and private.current_clinical_scope() = 'all'
  )
);

create policy payments_select on public.payments
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.read')
  and private.current_clinical_scope() = 'all'
);
create policy payments_insert on public.payments
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
  and private.current_clinical_scope() = 'all'
);
create policy payments_update on public.payments
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
  and private.current_clinical_scope() = 'all'
)
with check (hospital_id = private.current_hospital_id());

create policy documents_select on public.documents
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('documents.read')
  and (patient_id is null or private.can_access_patient(patient_id))
);
create policy documents_insert on public.documents
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and uploaded_by = auth.uid()
  and private.has_permission('documents.write')
  and (patient_id is null or private.can_access_patient(patient_id))
);
create policy documents_update on public.documents
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('documents.write')
  and (patient_id is null or private.can_access_patient(patient_id))
)
with check (hospital_id = private.current_hospital_id());

create policy notifications_select on public.notifications
for select to authenticated using (recipient_user_id = auth.uid());
create policy notifications_update on public.notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid() and hospital_id = private.current_hospital_id());

create policy audit_events_select on public.audit_events
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('audit.read')
);

create policy idempotency_select on public.idempotency_keys
for select to authenticated
using (hospital_id = private.current_hospital_id() and actor_user_id = auth.uid());
create policy idempotency_insert on public.idempotency_keys
for insert to authenticated
with check (hospital_id = private.current_hospital_id() and actor_user_id = auth.uid());
create policy idempotency_update on public.idempotency_keys
for update to authenticated
using (hospital_id = private.current_hospital_id() and actor_user_id = auth.uid())
with check (hospital_id = private.current_hospital_id() and actor_user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hospital-documents',
  'hospital-documents',
  false,
  104857600,
  array['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy hospital_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'hospital-documents'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('documents.read')
);
create policy hospital_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'hospital-documents'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('documents.write')
);
create policy hospital_documents_update on storage.objects
for update to authenticated
using (
  bucket_id = 'hospital-documents'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('documents.write')
)
with check (
  bucket_id = 'hospital-documents'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
);

comment on table public.audit_events is
  'Append-only security and operational events. Never store patient names, clinical notes, tokens, or file URLs in metadata.';
comment on table public.documents is
  'Private object metadata only. File bytes live in private object storage, never in Postgres rows.';
