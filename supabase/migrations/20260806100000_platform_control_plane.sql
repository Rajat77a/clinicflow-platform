-- Secure platform control plane for clinic provisioning and subscriptions.

begin;

alter table public.hospitals drop column if exists singleton_key;
alter table public.hospitals add column if not exists active boolean not null default true;

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_admins (user_id)
select user_id
from public.staff_memberships
where role_code = 'super_admin' and active
on conflict (user_id) do nothing;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid() and active
  )
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_platform_admin() $$;

create table if not exists public.hospital_subscriptions (
  hospital_id uuid primary key references public.hospitals(id) on delete restrict,
  plan_name text not null default 'ClinicFlow' check (char_length(plan_name) between 2 and 80),
  price numeric(12,2) not null default 499 check (price >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'expired')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at >= starts_at)
);

create table if not exists public.hospital_subscription_events (
  id bigint generated always as identity primary key,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('created', 'extended', 'suspended', 'reactivated')),
  days integer,
  old_expires_at timestamptz,
  new_expires_at timestamptz,
  proof_ref text check (proof_ref is null or char_length(proof_ref) <= 200),
  occurred_at timestamptz not null default now()
);

insert into public.hospital_subscriptions (hospital_id, expires_at)
select id, now() + interval '30 days'
from public.hospitals
on conflict (hospital_id) do nothing;

drop trigger if exists platform_admins_touch on public.platform_admins;
create trigger platform_admins_touch before update on public.platform_admins
for each row execute function private.set_updated_at();
drop trigger if exists hospital_subscriptions_touch on public.hospital_subscriptions;
create trigger hospital_subscriptions_touch before update on public.hospital_subscriptions
for each row execute function private.set_updated_at();
drop trigger if exists hospital_subscription_events_append_only on public.hospital_subscription_events;
create trigger hospital_subscription_events_append_only
before update or delete on public.hospital_subscription_events
for each row execute function private.prevent_audit_mutation();

alter table public.platform_admins enable row level security;
alter table public.hospital_subscriptions enable row level security;
alter table public.hospital_subscription_events enable row level security;

drop policy if exists hospitals_select on public.hospitals;
create policy hospitals_select on public.hospitals
for select to authenticated
using (id = private.current_hospital_id() or private.is_platform_admin());

create policy platform_admins_select_own on public.platform_admins
for select to authenticated using (user_id = auth.uid());
create policy hospital_subscriptions_select on public.hospital_subscriptions
for select to authenticated
using (hospital_id = private.current_hospital_id() or private.is_platform_admin());
create policy hospital_subscription_events_select on public.hospital_subscription_events
for select to authenticated
using (hospital_id = private.current_hospital_id() or private.is_platform_admin());

revoke all on public.platform_admins, public.hospital_subscriptions,
  public.hospital_subscription_events from public, anon, authenticated;
grant select on public.platform_admins, public.hospital_subscriptions,
  public.hospital_subscription_events to authenticated;

create or replace function public.list_visible_clinics()
returns table (
  id uuid, name text, city text, doctors bigint, receptionists bigint, patients bigint,
  plan text, price numeric, status text, expires date, access text, is_current boolean,
  configuration jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, coalesce(h.configuration->>'city', 'Not set'),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'doctor' and m.active),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'receptionist' and m.active),
    (select count(*) from public.patients p where p.hospital_id = h.id),
    coalesce(s.plan_name, 'ClinicFlow'), coalesce(s.price, 499),
    case
      when not h.active or s.status = 'suspended' then 'Suspended'
      when s.expires_at < now() then 'Expired'
      when s.expires_at <= now() + interval '15 days' then 'Expiring'
      else 'Active'
    end,
    s.expires_at::date,
    case when h.active then 'Allowed' else 'Suspended' end,
    h.id = private.current_hospital_id(), h.configuration
  from public.hospitals h
  left join public.hospital_subscriptions s on s.hospital_id = h.id
  where private.is_platform_admin() or h.id = private.current_hospital_id()
  order by h.created_at;
$$;

create or replace function public.create_platform_clinic(
  p_name text, p_configuration jsonb default '{}'::jsonb, p_trial_days integer default 14
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clinic_id uuid;
  base_slug text;
  clinic_slug text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) not between 2 and 160
    or jsonb_typeof(coalesce(p_configuration, '{}'::jsonb)) <> 'object'
    or p_trial_days not between 1 and 365 then
    raise exception 'Invalid clinic details' using errcode = '22023';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'clinic'; end if;
  clinic_slug := base_slug;
  while exists (select 1 from public.hospitals where slug = clinic_slug) loop
    clinic_slug := base_slug || '-' || substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8);
  end loop;

  insert into public.hospitals (name, slug, configuration)
  values (trim(p_name), clinic_slug, coalesce(p_configuration, '{}'::jsonb))
  returning id into clinic_id;
  insert into public.facilities (hospital_id, code, name, phone, email, address)
  values (
    clinic_id, 'MAIN', trim(p_name) || ' Main Facility',
    nullif(trim(p_configuration->>'phone'), ''), nullif(trim(p_configuration->>'email'), ''),
    jsonb_build_object('line', coalesce(p_configuration->>'address', ''))
  );
  insert into public.hospital_subscriptions (hospital_id, expires_at, updated_by)
  values (clinic_id, now() + make_interval(days => p_trial_days), auth.uid());
  insert into public.hospital_subscription_events
    (hospital_id, actor_user_id, action, days, new_expires_at)
  values (clinic_id, auth.uid(), 'created', p_trial_days, now() + make_interval(days => p_trial_days));
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (clinic_id, auth.uid(), 'super_admin', 'clinic.created', 'hospital', clinic_id::text,
    jsonb_build_object('name', trim(p_name)));
  return clinic_id;
end;
$$;

create or replace function public.update_platform_clinic(
  p_hospital_id uuid, p_name text, p_configuration jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null or char_length(trim(p_name)) not between 2 and 160
    or jsonb_typeof(coalesce(p_configuration, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid clinic details' using errcode = '22023';
  end if;
  update public.hospitals
  set name = trim(p_name), configuration = configuration || coalesce(p_configuration, '{}'::jsonb)
  where id = p_hospital_id;
  if not found then raise exception 'Clinic not found' using errcode = 'P0002'; end if;
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  values (p_hospital_id, auth.uid(), 'super_admin', 'clinic.updated', 'hospital', p_hospital_id::text);
end;
$$;

create or replace function public.set_platform_clinic_access(p_hospital_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare event_action text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if p_hospital_id = private.current_hospital_id() and not p_active then
    raise exception 'The active control clinic cannot suspend itself' using errcode = '22023';
  end if;
  update public.hospitals set active = p_active where id = p_hospital_id;
  if not found then raise exception 'Clinic not found' using errcode = 'P0002'; end if;
  update public.hospital_subscriptions
  set status = case when p_active then 'active' else 'suspended' end, updated_by = auth.uid()
  where hospital_id = p_hospital_id;
  event_action := case when p_active then 'reactivated' else 'suspended' end;
  insert into public.hospital_subscription_events (hospital_id, actor_user_id, action)
  values (p_hospital_id, auth.uid(), event_action);
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  values (p_hospital_id, auth.uid(), 'super_admin', 'clinic.' || event_action, 'hospital', p_hospital_id::text);
end;
$$;

create or replace function public.extend_platform_subscription(
  p_hospital_id uuid, p_days integer, p_proof_ref text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare old_expiry timestamptz; new_expiry timestamptz;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if p_days not between 1 and 3650 or char_length(coalesce(p_proof_ref, '')) > 200 then
    raise exception 'Invalid subscription extension' using errcode = '22023';
  end if;
  select expires_at into old_expiry from public.hospital_subscriptions
  where hospital_id = p_hospital_id for update;
  if not found then raise exception 'Subscription not found' using errcode = 'P0002'; end if;
  new_expiry := greatest(old_expiry, now()) + make_interval(days => p_days);
  update public.hospital_subscriptions
  set expires_at = new_expiry, status = 'active', updated_by = auth.uid()
  where hospital_id = p_hospital_id;
  update public.hospitals set active = true where id = p_hospital_id;
  insert into public.hospital_subscription_events
    (hospital_id, actor_user_id, action, days, old_expires_at, new_expires_at, proof_ref)
  values (p_hospital_id, auth.uid(), 'extended', p_days, old_expiry, new_expiry, nullif(trim(p_proof_ref), ''));
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (p_hospital_id, auth.uid(), 'super_admin', 'subscription.extended', 'hospital_subscription',
    p_hospital_id::text, jsonb_build_object('days', p_days, 'new_expiry', new_expiry));
  return new_expiry;
end;
$$;

create or replace function public.provision_platform_invited_admin(
  p_user_id uuid, p_hospital_id uuid, p_email text, p_full_name text, p_phone text, p_facility_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform administrator permission is required' using errcode = '42501';
  end if;
  if nullif(trim(p_full_name), '') is null or nullif(trim(p_email), '') is null then
    raise exception 'Invalid administrator identity' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and lower(email) = lower(trim(p_email))) then
    raise exception 'Invited authentication identity was not found' using errcode = '23503';
  end if;
  if not exists (select 1 from public.facilities where id = p_facility_id and hospital_id = p_hospital_id and active) then
    raise exception 'Invalid active facility' using errcode = '23503';
  end if;
  update public.profiles set display_name = trim(p_full_name), email = lower(trim(p_email)),
    phone = nullif(trim(p_phone), '') where id = p_user_id;
  insert into public.staff_memberships (user_id, hospital_id, facility_id, role_code)
  values (p_user_id, p_hospital_id, p_facility_id, 'clinic_admin');
  insert into public.audit_events
    (hospital_id, actor_user_id, actor_role, action, entity_type, entity_id)
  values (p_hospital_id, auth.uid(), 'super_admin', 'clinic_admin.invited', 'staff_membership', p_user_id::text);
end;
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.list_visible_clinics() from public, anon;
revoke all on function public.create_platform_clinic(text, jsonb, integer) from public, anon;
revoke all on function public.update_platform_clinic(uuid, text, jsonb) from public, anon;
revoke all on function public.set_platform_clinic_access(uuid, boolean) from public, anon;
revoke all on function public.extend_platform_subscription(uuid, integer, text) from public, anon;
revoke all on function public.provision_platform_invited_admin(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.list_visible_clinics() to authenticated;
grant execute on function public.create_platform_clinic(text, jsonb, integer) to authenticated;
grant execute on function public.update_platform_clinic(uuid, text, jsonb) to authenticated;
grant execute on function public.set_platform_clinic_access(uuid, boolean) to authenticated;
grant execute on function public.extend_platform_subscription(uuid, integer, text) to authenticated;
grant execute on function public.provision_platform_invited_admin(uuid, uuid, text, text, text, uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-branding', 'clinic-branding', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists clinic_branding_platform_select on storage.objects;
create policy clinic_branding_platform_select on storage.objects
for select to authenticated
using (bucket_id = 'clinic-branding' and private.is_platform_admin());
drop policy if exists clinic_branding_platform_insert on storage.objects;
create policy clinic_branding_platform_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'clinic-branding'
  and private.is_platform_admin()
  and (storage.foldername(name))[1] in (select id::text from public.hospitals)
);
drop policy if exists clinic_branding_platform_update on storage.objects;
create policy clinic_branding_platform_update on storage.objects
for update to authenticated
using (bucket_id = 'clinic-branding' and private.is_platform_admin())
with check (bucket_id = 'clinic-branding' and private.is_platform_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hospital_subscriptions'
  ) then
    alter publication supabase_realtime add table public.hospital_subscriptions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hospital_subscription_events'
  ) then
    alter publication supabase_realtime add table public.hospital_subscription_events;
  end if;
end $$;

commit;
