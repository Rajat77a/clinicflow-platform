-- The directory's existing updated_at projection is retained for API compatibility,
-- but its value now represents the latest completed visit when one exists.
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
    where nullif(btrim(p_query), '') is null
      or concat_ws(
        ' ', p.id::text, p.medical_record_number, p.first_name, p.last_name, p.phone
      ) ilike '%' || btrim(p_query) || '%'
  )
  select visible_patients.*, count(*) over () as total_count
  from visible_patients
  order by created_at desc, id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.search_patients(text, integer, integer) from public, anon;
grant execute on function public.search_patients(text, integer, integer) to authenticated;

comment on function public.search_patients(text, integer, integer) is
  'Returns one RLS-visible patient page with the latest completed appointment reflected as the last visit.';

-- Keep every status exposed by the appointment editor compatible with the
-- cancellation invariant on the appointments table.
create or replace function public.update_appointment(
  p_appointment_id uuid,
  p_expected_version integer,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_status text,
  p_reason text,
  p_administrative_notes text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
begin
  if p_duration_minutes not between 5 and 480
    or p_status not in (
      'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'
    )
  then
    raise exception 'Invalid appointment duration or status' using errcode = '22023';
  end if;

  update public.appointments
  set starts_at = p_starts_at,
      ends_at = p_starts_at + make_interval(mins => p_duration_minutes),
      status = p_status,
      reason = trim(p_reason),
      administrative_notes = nullif(trim(p_administrative_notes), ''),
      cancellation_reason = case
        when p_status = 'cancelled'
          then coalesce(nullif(trim(p_administrative_notes), ''), 'Cancelled by hospital staff')
        else null
      end
  where id = p_appointment_id
    and version = p_expected_version
  returning version into next_version;

  if next_version is null then
    raise exception 'Appointment changed since it was loaded' using errcode = '40001';
  end if;
  return next_version;
end;
$$;

revoke all on function public.update_appointment(uuid, integer, timestamptz, integer, text, text, text)
  from public, anon;
grant execute on function public.update_appointment(uuid, integer, timestamptz, integer, text, text, text)
  to authenticated;
