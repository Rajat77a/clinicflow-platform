-- Give doctors read-only access to patient bills and uploaded document metadata.
-- Invoice visibility stays patient-scoped through private.can_access_patient.

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

commit;
