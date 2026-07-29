-- Durable system jobs remain inside Postgres so the free development stack
-- does not depend on another queue provider. Queue payloads are never exposed
-- through the browser Data API.
begin;

create extension if not exists pgmq;

revoke all on schema pgmq from public, anon, authenticated;

do $$
declare
  target_queue text;
begin
  foreach target_queue in array array[
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  ]
  loop
    if not exists (
      select 1
      from pgmq.list_queues() existing
      where existing.queue_name = target_queue
    ) then
      perform pgmq.create(target_queue);
    end if;
  end loop;
end
$$;

create or replace function public.enqueue_system_job(
  p_queue_name text,
  p_message jsonb,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id bigint;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_queue_name not in (
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  ) then
    raise exception 'Unsupported system queue' using errcode = '22023';
  end if;
  if jsonb_typeof(p_message) <> 'object' or pg_column_size(p_message) > 32768 then
    raise exception 'Invalid system job payload' using errcode = '22023';
  end if;
  if p_delay_seconds < 0 or p_delay_seconds > 86400 then
    raise exception 'Invalid system job delay' using errcode = '22023';
  end if;

  select pgmq.send(p_queue_name, p_message, p_delay_seconds)
  into job_id;
  return job_id;
end;
$$;

create or replace function public.read_system_jobs(
  p_queue_name text,
  p_visibility_timeout integer default 60,
  p_quantity integer default 10
)
returns table (
  msg_id bigint,
  read_count bigint,
  enqueued_at timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_queue_name not in (
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  ) then
    raise exception 'Unsupported system queue' using errcode = '22023';
  end if;
  if p_visibility_timeout < 10 or p_visibility_timeout > 3600 then
    raise exception 'Invalid visibility timeout' using errcode = '22023';
  end if;
  if p_quantity < 1 or p_quantity > 50 then
    raise exception 'Invalid job quantity' using errcode = '22023';
  end if;

  return query
  select job.msg_id, job.read_ct, job.enqueued_at, job.message
  from pgmq.read(p_queue_name, p_visibility_timeout, p_quantity) job;
end;
$$;

create or replace function public.archive_system_job(
  p_queue_name text,
  p_message_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_queue_name not in (
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  ) then
    raise exception 'Unsupported system queue' using errcode = '22023';
  end if;

  select pgmq.archive(p_queue_name, p_message_id)
  into archived;
  return coalesce(archived, false);
end;
$$;

create or replace function public.queue_operational_metrics()
returns table (
  queue_name text,
  queue_length bigint,
  oldest_message_age_seconds integer,
  total_messages bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and not private.has_permission('audit.read') then
    raise exception 'Audit permission required' using errcode = '42501';
  end if;

  return query
  select
    metrics.queue_name,
    metrics.queue_length,
    metrics.oldest_msg_age_sec,
    metrics.total_messages
  from pgmq.metrics_all() metrics
  where metrics.queue_name in (
    'document_scanning',
    'notification_delivery',
    'security_alerts'
  )
  order by metrics.queue_name;
end;
$$;

revoke all on function public.enqueue_system_job(text, jsonb, integer)
from public, anon, authenticated;
revoke all on function public.read_system_jobs(text, integer, integer)
from public, anon, authenticated;
revoke all on function public.archive_system_job(text, bigint)
from public, anon, authenticated;
revoke all on function public.queue_operational_metrics()
from public, anon;

grant execute on function public.enqueue_system_job(text, jsonb, integer)
to service_role;
grant execute on function public.read_system_jobs(text, integer, integer)
to service_role;
grant execute on function public.archive_system_job(text, bigint)
to service_role;
grant execute on function public.queue_operational_metrics()
to authenticated, service_role;

comment on function public.enqueue_system_job(text, jsonb, integer) is
  'Service-role-only enqueue boundary for allowlisted ClinicFlow system queues.';
comment on function public.read_system_jobs(text, integer, integer) is
  'Service-role-only worker claim boundary with a visibility timeout.';
comment on function public.archive_system_job(text, bigint) is
  'Service-role-only acknowledgement boundary for completed jobs.';
comment on function public.queue_operational_metrics() is
  'Payload-free queue health metrics for authorized operations staff.';

commit;
