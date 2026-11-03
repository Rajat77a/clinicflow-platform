-- Grant doctor role permission to create and manage bills/invoices.
-- Update RLS policies on invoices, invoice_items, and payments so users with billing.write
-- can create and manage bills regardless of clinical scope (assigned vs all).

begin;

-- 1. Grant billing.write permission to doctor role
insert into public.role_permissions (role_code, permission_code)
values ('doctor', 'billing.write')
on conflict do nothing;

-- 2. Update invoices_insert policy to allow doctors/staff with billing.write
drop policy if exists invoices_insert on public.invoices;
create policy invoices_insert on public.invoices
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
  and created_by = auth.uid()
);

-- 3. Update invoices_update policy
drop policy if exists invoices_update on public.invoices;
create policy invoices_update on public.invoices
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
)
with check (hospital_id = private.current_hospital_id());

-- 4. Update invoice_items_insert policy
drop policy if exists invoice_items_insert on public.invoice_items;
create policy invoice_items_insert on public.invoice_items
for insert to authenticated
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and i.hospital_id = private.current_hospital_id()
      and (i.status = 'draft' or i.status = 'issued')
      and private.has_permission('billing.write')
  )
);

-- 5. Update invoice_items_update policy
drop policy if exists invoice_items_update on public.invoice_items;
create policy invoice_items_update on public.invoice_items
for update to authenticated
using (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and (i.status = 'draft' or i.status = 'issued')
      and private.has_permission('billing.write')
  )
)
with check (
  exists (
    select 1 from public.invoices i
    where i.id = invoice_id
      and (i.status = 'draft' or i.status = 'issued')
      and private.has_permission('billing.write')
  )
);

-- 6. Update payments_insert policy
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
for insert to authenticated
with check (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
);

-- 7. Update payments_update policy
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
for update to authenticated
using (
  hospital_id = private.current_hospital_id()
  and private.has_permission('billing.write')
)
with check (hospital_id = private.current_hospital_id());

notify pgrst, 'reload schema';

commit;
