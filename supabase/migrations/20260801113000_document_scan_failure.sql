-- A scanner worker needs an audited terminal state when bounded retries are
-- exhausted. Browser roles cannot invoke this service boundary.
begin;

create or replace function public.record_document_scan_failure(
  p_document_id uuid,
  p_detail_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  document public.documents%rowtype;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_detail_code is null
    or char_length(p_detail_code) not between 2 and 120
    or p_detail_code !~ '^[a-z0-9._-]+$' then
    raise exception 'Invalid scanner failure code' using errcode = '22023';
  end if;

  select * into document
  from public.documents
  where id = p_document_id
  for update;

  if document.id is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if document.scan_status not in ('pending', 'failed') then
    raise exception 'Document scan is already final' using errcode = '23505';
  end if;

  update public.documents
  set scan_status = 'failed',
      scan_provider = 'clamav',
      scan_detail_code = p_detail_code,
      scanned_at = now()
  where id = p_document_id;

  insert into public.audit_events (
    hospital_id, action, entity_type, entity_id, metadata
  ) values (
    document.hospital_id,
    'document.scan_failed',
    'document',
    document.id::text,
    jsonb_build_object('detail_code', p_detail_code)
  );
end;
$$;

revoke all on function public.record_document_scan_failure(uuid, text)
from public, anon, authenticated;
grant execute on function public.record_document_scan_failure(uuid, text)
to service_role;

comment on function public.record_document_scan_failure(uuid, text) is
  'Records an audited terminal scanner failure without exposing document bytes.';

commit;
