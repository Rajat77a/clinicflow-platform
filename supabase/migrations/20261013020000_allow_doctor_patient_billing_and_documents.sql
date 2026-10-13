-- Give doctors read-only access to patient bills and uploaded documents.
-- Invoice and document visibility stay patient-scoped through private.can_access_patient.

begin;

insert into public.role_permissions (role_code, permission_code)
values
  ('doctor', 'billing.read'),
  ('doctor', 'documents.read')
on conflict do nothing;

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.read')
  and private.can_access_patient(patient_id)
);

drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items
for select to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.hospital_id = private.current_hospital_id()
      and private.has_permission('billing.read')
      and private.can_access_patient(i.patient_id)
  )
);

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
for select to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.hospital_id = private.current_hospital_id()
      and private.has_permission('billing.read')
      and private.can_access_patient(i.patient_id)
  )
);

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
for select to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('documents.read')
  and (patient_id is null or private.can_access_patient(patient_id))
);

drop policy if exists hospital_documents_select on storage.objects;
create policy hospital_documents_select on storage.objects
for select to authenticated
using (
  bucket_id = 'hospital-documents'
  and exists (
    select 1
    from public.documents document
    where document.storage_bucket = storage.objects.bucket_id
      and document.storage_path = storage.objects.name
      and document.hospital_id = private.current_hospital_id()
      and document.scan_status = 'clean'
      and private.has_permission('documents.read')
      and (
        document.patient_id is null
        or private.can_access_patient(document.patient_id)
      )
  )
);

notify pgrst, 'reload schema';

commit;
