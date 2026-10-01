alter table public.hospitals add column if not exists short_id text;

create or replace function public.auto_generate_hospital_id()
returns trigger
language plpgsql
as $$
declare
  v_last_number integer;
begin
  if new.short_id is null or new.short_id = '' then
    select coalesce(max(nullif(regexp_replace(short_id, '^CL-', ''), '')::integer), 100)
    into v_last_number
    from public.hospitals
    where short_id like 'CL-%'
      and short_id ~ '^CL-[0-9]+$';

    new.short_id := 'CL-' || (v_last_number + 1)::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_auto_generate_hospital_id on public.hospitals;
create trigger trigger_auto_generate_hospital_id
before insert on public.hospitals
for each row
execute function public.auto_generate_hospital_id();

do $$
declare
  h record;
begin
  for h in select id from public.hospitals where short_id is null or short_id = '' loop
    update public.hospitals set short_id = (
      select 'CL-' || (coalesce(max(nullif(regexp_replace(short_id, '^CL-', ''), '')::integer), 100) + 1)::text
      from public.hospitals
      where short_id like 'CL-%' and short_id ~ '^CL-[0-9]+$'
    ) where id = h.id;
  end loop;
end;
$$;

drop function if exists public.list_visible_clinics();

create or replace function public.list_visible_clinics()
returns table (
  id uuid, short_id text, name text, city text, doctors bigint, receptionists bigint, clinical_admins bigint, patients bigint,
  plan text, price numeric, status text, expires date, access text, is_current boolean,
  configuration jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.short_id, h.name, coalesce(h.configuration->>'city', 'Not set'),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'doctor' and m.active),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'receptionist' and m.active),
    (select count(*) from public.staff_memberships m where m.hospital_id = h.id and m.role_code = 'clinic_admin' and m.active),
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
  where private.is_platform_admin()
     or h.id = private.current_hospital_id()
  order by h.name;
$$;

revoke all on function public.list_visible_clinics() from public, anon;
grant execute on function public.list_visible_clinics() to authenticated;
