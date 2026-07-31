-- Untrusted files enter an isolated bucket and cannot be read by browser roles.
-- A scanner worker must copy clean bytes to hospital-documents before marking
-- the metadata clean. File UI remains production-disabled until that worker is
-- configured and acceptance-tested.
begin;

update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'hospital-documents';

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hospital-document-quarantine',
  'hospital-document-quarantine',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.documents
  add column if not exists intake_idempotency_key text,
  add column if not exists quarantined_at timestamptz,
  add column if not exists scanned_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists scan_provider text,
  add column if not exists scan_detail_code text;

create unique index if not exists documents_intake_idempotency_idx
on public.documents(hospital_id, uploaded_by, intake_idempotency_key)
where intake_idempotency_key is not null;

create index if not exists documents_scan_queue_idx
on public.documents(scan_status, quarantined_at)
where scan_status in ('pending', 'failed');

create or replace function public.register_document_quarantine(
  p_hospital_id uuid,
  p_patient_id uuid,
  p_uploaded_by uuid,
  p_storage_path text,
  p_original_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_category text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_content_type not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Unsupported document type' using errcode = '22023';
  end if;
  if p_byte_size < 1 or p_byte_size > 26214400 then
    raise exception 'Document size is outside the allowed range' using errcode = '22023';
  end if;
  if char_length(p_original_filename) not between 1 and 180
    or p_original_filename ~ '[/\\]'
    or p_original_filename ~ '[[:cntrl:]]' then
    raise exception 'Invalid document filename' using errcode = '22023';
  end if;
  if char_length(p_category) not between 2 and 80 then
    raise exception 'Invalid document category' using errcode = '22023';
  end if;
  if char_length(p_idempotency_key) not between 16 and 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if char_length(p_storage_path) not between 3 and 500
    or p_storage_path ~ '\\'
    or p_storage_path ~ '[[:cntrl:]]'
    or split_part(p_storage_path, '/', 1) <> p_hospital_id::text
    or p_storage_path ~ '(^|/)\.\.?(/|$)' then
    raise exception 'Invalid quarantine path' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.staff_memberships membership
    where membership.user_id = p_uploaded_by
      and membership.hospital_id = p_hospital_id
      and membership.active
  ) then
    raise exception 'Active hospital membership required' using errcode = '42501';
  end if;
  if p_patient_id is not null and not exists (
    select 1
    from public.patients patient
    where patient.id = p_patient_id
      and patient.hospital_id = p_hospital_id
  ) then
    raise exception 'Patient record not found' using errcode = 'P0002';
  end if;

  insert into public.documents (
    hospital_id,
    patient_id,
    uploaded_by,
    storage_bucket,
    storage_path,
    original_filename,
    content_type,
    byte_size,
    category,
    scan_status,
    intake_idempotency_key,
    quarantined_at
  )
  values (
    p_hospital_id,
    p_patient_id,
    p_uploaded_by,
    'hospital-document-quarantine',
    p_storage_path,
    p_original_filename,
    p_content_type,
    p_byte_size,
    p_category,
    'pending',
    p_idempotency_key,
    now()
  )
  on conflict (hospital_id, uploaded_by, intake_idempotency_key)
  where intake_idempotency_key is not null
  do nothing
  returning id into document_id;

  if document_id is null then
    select document.id
    into strict document_id
    from public.documents document
    where document.hospital_id = p_hospital_id
      and document.uploaded_by = p_uploaded_by
      and document.intake_idempotency_key = p_idempotency_key;
    return document_id;
  end if;

  insert into public.audit_events (
    hospital_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_hospital_id,
    p_uploaded_by,
    'document.quarantined',
    'document',
    document_id::text,
    jsonb_build_object(
      'content_type', p_content_type,
      'byte_size', p_byte_size,
      'category', p_category
    )
  );

  perform public.enqueue_system_job(
    'document_scanning',
    jsonb_build_object(
      'document_id', document_id,
      'hospital_id', p_hospital_id
    ),
    0
  );

  return document_id;
end;
$$;

create or replace function public.record_document_scan_result(
  p_document_id uuid,
  p_clean boolean,
  p_sha256 text,
  p_scan_provider text,
  p_scan_detail_code text,
  p_released_path text default null
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
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid document hash' using errcode = '22023';
  end if;
  if char_length(p_scan_provider) not between 2 and 80
    or char_length(p_scan_detail_code) not between 2 and 120 then
    raise exception 'Invalid scanner result' using errcode = '22023';
  end if;

  select *
  into document
  from public.documents
  where id = p_document_id
  for update;

  if document.id is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if document.scan_status not in ('pending', 'failed') then
    raise exception 'Document scan is already final' using errcode = '23505';
  end if;
  if p_clean and (
    p_released_path is null
    or char_length(p_released_path) not between 3 and 500
    or p_released_path ~ '\\'
    or p_released_path ~ '[[:cntrl:]]'
    or split_part(p_released_path, '/', 1) <> document.hospital_id::text
    or p_released_path ~ '(^|/)\.\.?(/|$)'
  ) then
    raise exception 'Invalid released document path' using errcode = '22023';
  end if;

  update public.documents
  set scan_status = case when p_clean then 'clean' else 'rejected' end,
      storage_bucket = case
        when p_clean then 'hospital-documents'
        else storage_bucket
      end,
      storage_path = case
        when p_clean then p_released_path
        else storage_path
      end,
      sha256 = p_sha256,
      scan_provider = p_scan_provider,
      scan_detail_code = p_scan_detail_code,
      scanned_at = now(),
      released_at = case when p_clean then now() else null end
  where id = p_document_id;

  insert into public.audit_events (
    hospital_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    document.hospital_id,
    case when p_clean then 'document.released' else 'document.rejected' end,
    'document',
    document.id::text,
    jsonb_build_object(
      'scan_provider', p_scan_provider,
      'scan_detail_code', p_scan_detail_code
    )
  );
end;
$$;

revoke all on function public.register_document_quarantine(
  uuid, uuid, uuid, text, text, text, bigint, text, text
) from public, anon, authenticated;
revoke all on function public.record_document_scan_result(
  uuid, boolean, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.register_document_quarantine(
  uuid, uuid, uuid, text, text, text, bigint, text, text
) to service_role;
grant execute on function public.record_document_scan_result(
  uuid, boolean, text, text, text, text
) to service_role;

comment on function public.register_document_quarantine(
  uuid, uuid, uuid, text, text, text, bigint, text, text
) is 'Registers private untrusted bytes and queues scanning; service role only.';
comment on function public.record_document_scan_result(
  uuid, boolean, text, text, text, text
) is 'Records a sanitized scanner outcome after the worker moves clean bytes.';

commit;
