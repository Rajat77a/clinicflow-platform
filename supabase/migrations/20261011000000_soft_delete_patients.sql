alter table public.patients add column if not exists deleted_at timestamptz default null;

create or replace function public.soft_delete_patient(p_patient_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.patients
  set deleted_at = now()
  where id = p_patient_id;
end;
$$;

create or replace function public.restore_patient(p_patient_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.patients
  set deleted_at = null
  where id = p_patient_id;
end;
$$;

create or replace function public.permanently_delete_patient(p_patient_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  delete from public.patients
  where id = p_patient_id and deleted_at is not null;
end;
$$;

create or replace function public.search_patients(
  p_query text default '',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  hospital_id uuid,
  medical_record_number text,
  first_name text,
  last_name text,
  date_of_birth date,
  sex text,
  phone text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  version integer,
  doctor_user_id uuid,
  doctor_name text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_patients as (
    select
      p.id,
      p.hospital_id,
      p.medical_record_number,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.sex,
      p.phone,
      p.status,
      p.created_at,
      coalesce(visits.last_visit_at, p.updated_at) as updated_at,
      p.version,
      assigned.staff_user_id as doctor_user_id,
      assigned.doctor_name
    from public.patients p
    left join lateral (
      select team.staff_user_id, profile.display_name as doctor_name
      from public.patient_care_teams team
      left join public.profiles profile on profile.id = team.staff_user_id
      where team.patient_id = p.id
        and team.active
        and team.relationship in ('primary_doctor', 'primary')
      order by team.assigned_at desc
      limit 1
    ) assigned on true
    left join lateral (
      select max(appointment.ends_at) as last_visit_at
      from public.appointments appointment
      where appointment.patient_id = p.id
        and appointment.hospital_id = p.hospital_id
        and appointment.status = 'completed'
    ) visits on true
    where p.deleted_at is null
      and (
        nullif(btrim(p_query), '') is null
        or concat_ws(
          ' ', p.id::text, p.medical_record_number, p.first_name, p.last_name, p.phone
        ) ilike '%' || btrim(p_query) || '%'
      )
  )
  select visible_patients.*, count(*) over () as total_count
  from visible_patients
  order by created_at desc, id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;
