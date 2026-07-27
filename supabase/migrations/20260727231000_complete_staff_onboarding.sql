-- Complete staff onboarding in one authorized database transaction and persist
-- the practitioner fields collected by the application.

begin;

alter table public.staff_memberships
  add column gender text check (gender in ('female', 'male', 'other')),
  add column qualification text check (qualification is null or char_length(qualification) <= 200),
  add column medical_registration_number text
    check (medical_registration_number is null or char_length(medical_registration_number) between 3 and 80),
  add column experience_years integer check (experience_years is null or experience_years between 0 and 80),
  add column consultation_fee numeric(12,2)
    check (consultation_fee is null or consultation_fee between 0 and 10000000),
  add column working_hours text check (working_hours is null or char_length(working_hours) <= 200),
  add column administrative_notes text
    check (administrative_notes is null or char_length(administrative_notes) <= 2000);

create unique index staff_medical_registration_unique
on public.staff_memberships (hospital_id, lower(medical_registration_number))
where medical_registration_number is not null;

create or replace function public.provision_invited_staff(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_role_code text,
  p_facility_id uuid,
  p_department_id uuid,
  p_specialty text,
  p_shift text,
  p_gender text,
  p_qualification text,
  p_medical_registration_number text,
  p_experience_years integer,
  p_consultation_fee numeric,
  p_working_hours text,
  p_administrative_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_hospital uuid := private.current_hospital_id();
  actor_role text := private.current_role_code();
begin
  if auth.uid() is null or actor_hospital is null or not private.has_permission('people.manage') then
    raise exception 'Staff administration permission is required' using errcode = '42501';
  end if;

  perform public.assert_staff_role_assignment(actor_role, p_role_code);

  if nullif(trim(p_full_name), '') is null
    or char_length(trim(p_full_name)) > 160
    or nullif(trim(p_email), '') is null
    or p_role_code not in ('clinic_admin', 'doctor', 'receptionist')
  then
    raise exception 'Invalid staff identity or role' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from auth.users invited_user
    where invited_user.id = p_user_id
      and lower(invited_user.email) = lower(trim(p_email))
  ) then
    raise exception 'Invited authentication identity was not found' using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.facilities facility
    where facility.id = p_facility_id
      and facility.hospital_id = actor_hospital
      and facility.active
  ) then
    raise exception 'Invalid active facility' using errcode = '23503';
  end if;

  if p_department_id is not null and not exists (
    select 1
    from public.departments department
    where department.id = p_department_id
      and department.hospital_id = actor_hospital
      and department.facility_id = p_facility_id
      and department.active
  ) then
    raise exception 'Invalid active department' using errcode = '23503';
  end if;

  if p_role_code = 'doctor' and (
    nullif(trim(p_specialty), '') is null
    or nullif(trim(p_qualification), '') is null
    or nullif(trim(p_medical_registration_number), '') is null
    or p_experience_years is null
    or p_experience_years not between 0 and 80
    or p_consultation_fee is null
    or p_consultation_fee not between 0 and 10000000
  ) then
    raise exception 'Complete and valid doctor credentials are required' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = trim(p_full_name),
      email = lower(trim(p_email)),
      phone = nullif(trim(p_phone), '')
  where id = p_user_id;

  if not found then
    raise exception 'Invited staff profile was not created' using errcode = '23503';
  end if;

  insert into public.staff_memberships (
    user_id, hospital_id, role_code, facility_id, department_id, specialty, shift,
    gender, qualification, medical_registration_number, experience_years,
    consultation_fee, working_hours, administrative_notes
  )
  values (
    p_user_id, actor_hospital, p_role_code, p_facility_id, p_department_id,
    case when p_role_code = 'doctor' then trim(p_specialty) end,
    case when p_role_code = 'receptionist' then nullif(trim(p_shift), '') end,
    case when p_role_code = 'doctor' then nullif(trim(p_gender), '') end,
    case when p_role_code = 'doctor' then trim(p_qualification) end,
    case when p_role_code = 'doctor' then trim(p_medical_registration_number) end,
    case when p_role_code = 'doctor' then p_experience_years end,
    case when p_role_code = 'doctor' then p_consultation_fee end,
    case when p_role_code = 'doctor' then nullif(trim(p_working_hours), '') end,
    case when p_role_code = 'doctor' then nullif(trim(p_administrative_notes), '') end
  );
end;
$$;

revoke all on function public.provision_invited_staff(
  uuid, text, text, text, text, uuid, uuid, text, text, text, text, text,
  integer, numeric, text, text
) from public, anon;
grant execute on function public.provision_invited_staff(
  uuid, text, text, text, text, uuid, uuid, text, text, text, text, text,
  integer, numeric, text, text
) to authenticated;

create or replace function public.list_current_staff()
returns table (
  user_id uuid,
  hospital_id uuid,
  role_code text,
  active boolean,
  specialty text,
  shift text,
  display_name text,
  email text,
  phone text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    membership.hospital_id,
    membership.role_code,
    membership.active,
    membership.specialty,
    membership.shift,
    profile.display_name,
    profile.email,
    profile.phone,
    case
      when not membership.active then 'Inactive'
      when invited_user.email_confirmed_at is null then 'Invited'
      else 'Active'
    end
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  join auth.users invited_user on invited_user.id = membership.user_id
  where membership.hospital_id = private.current_hospital_id()
    and private.has_permission('people.read')
  order by profile.display_name;
$$;

revoke all on function public.list_current_staff() from public, anon;
grant execute on function public.list_current_staff() to authenticated;

drop function if exists public.list_active_doctors_with_counts();
create function public.list_active_doctors_with_counts()
returns table (
  user_id uuid,
  display_name text,
  specialty text,
  email text,
  phone text,
  gender text,
  qualification text,
  medical_registration_number text,
  experience_years integer,
  consultation_fee numeric,
  working_hours text,
  administrative_notes text,
  avatar_path text,
  status text,
  patient_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    membership.user_id,
    profile.display_name,
    membership.specialty,
    profile.email,
    profile.phone,
    membership.gender,
    membership.qualification,
    membership.medical_registration_number,
    membership.experience_years,
    membership.consultation_fee,
    membership.working_hours,
    membership.administrative_notes,
    profile.avatar_path,
    case
      when invited_user.email_confirmed_at is null then 'Invited'
      else 'Active'
    end,
    count(team.patient_id) filter (where team.active) as patient_count
  from public.staff_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  join auth.users invited_user on invited_user.id = membership.user_id
  left join public.patient_care_teams team
    on team.staff_user_id = membership.user_id
  where membership.hospital_id = private.current_hospital_id()
    and membership.role_code = 'doctor'
    and membership.active
    and private.has_permission('appointments.read')
  group by membership.user_id, profile.id, invited_user.id
  order by profile.display_name;
$$;

revoke all on function public.list_active_doctors_with_counts() from public, anon;
grant execute on function public.list_active_doctors_with_counts() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-avatars', 'staff-avatars', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy staff_avatars_select on storage.objects
for select to authenticated
using (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('people.read')
);

create policy staff_avatars_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('people.manage')
);

create policy staff_avatars_update on storage.objects
for update to authenticated
using (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('people.manage')
)
with check (
  bucket_id = 'staff-avatars'
  and (storage.foldername(name))[1] = private.current_hospital_id()::text
  and private.has_permission('people.manage')
);

create or replace function public.set_staff_avatar_path(p_user_id uuid, p_avatar_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_hospital uuid := private.current_hospital_id();
begin
  if auth.uid() is null or actor_hospital is null or not private.has_permission('people.manage') then
    raise exception 'Staff administration permission is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.staff_memberships membership
    where membership.user_id = p_user_id and membership.hospital_id = actor_hospital
  ) or p_avatar_path not like actor_hospital::text || '/' || p_user_id::text || '/%'
  or not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'staff-avatars' and object.name = p_avatar_path
  ) then
    raise exception 'Invalid staff avatar' using errcode = '23503';
  end if;

  update public.profiles set avatar_path = p_avatar_path where id = p_user_id;
end;
$$;

revoke all on function public.set_staff_avatar_path(uuid, text) from public, anon;
grant execute on function public.set_staff_avatar_path(uuid, text) to authenticated;

commit;
