-- Persist the itemized invoice that the billing screen presents to staff.
-- The legacy single-line RPC stays available during rolling deployments.

begin;

alter table public.invoice_items
  add column if not exists category text not null default 'Other'
  check (category in ('Consultation', 'Procedure', 'Medicine', 'Lab', 'Other'));

alter table public.invoice_items
  add column if not exists position integer not null default 1
  check (position > 0);

create or replace function public.create_itemized_invoice(
  p_patient_id uuid,
  p_items jsonb,
  p_discount numeric,
  p_tax_rate numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior jsonb;
  hospital uuid := private.current_hospital_id();
  invoice_id uuid;
  invoice_number text;
  calculated_subtotal numeric;
  calculated_tax numeric;
  item_count integer;
begin
  prior := private.claim_command(p_idempotency_key, 'create-itemized-invoice');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invoice items must be an array' using errcode = '22023';
  end if;

  select count(*), round(coalesce(sum(item.qty * item.unit), 0), 2)
  into item_count, calculated_subtotal
  from jsonb_to_recordset(p_items) as item(
    category text,
    name text,
    qty numeric,
    unit numeric
  );

  if item_count < 1 or item_count > 100
    or exists (
      select 1
      from jsonb_to_recordset(p_items) as item(
        category text,
        name text,
        qty numeric,
        unit numeric
      )
      where item.category is null
        or item.category not in ('Consultation', 'Procedure', 'Medicine', 'Lab', 'Other')
        or nullif(trim(item.name), '') is null
        or char_length(trim(item.name)) > 500
        or item.qty <= 0
        or item.qty > 10000
        or item.unit < 0
        or item.unit > 1000000000
        or item.qty is null
        or item.unit is null
    )
  then
    raise exception 'Invoice contains invalid line items' using errcode = '22023';
  end if;

  if calculated_subtotal <= 0
    or calculated_subtotal > 999999999999.99
    or coalesce(p_discount, 0) < 0
    or coalesce(p_discount, 0) > calculated_subtotal
    or coalesce(p_tax_rate, 0) < 0
    or coalesce(p_tax_rate, 0) > 100
  then
    raise exception 'Invoice totals are invalid' using errcode = '22023';
  end if;

  calculated_tax := round(
    (calculated_subtotal - coalesce(p_discount, 0)) * coalesce(p_tax_rate, 0) / 100,
    2
  );
  if calculated_subtotal + calculated_tax - coalesce(p_discount, 0) > 999999999999.99 then
    raise exception 'Invoice total exceeds the allowed amount' using errcode = '22003';
  end if;
  invoice_number := format(
    'INV-%s-%s',
    to_char(current_date, 'YYYYMMDD'),
    upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8))
  );

  insert into public.invoices (
    hospital_id,
    patient_id,
    invoice_number,
    status,
    subtotal,
    tax,
    discount,
    issued_at,
    due_at,
    created_by
  )
  values (
    hospital,
    p_patient_id,
    invoice_number,
    'draft',
    calculated_subtotal,
    calculated_tax,
    coalesce(p_discount, 0),
    now(),
    now() + interval '30 days',
    auth.uid()
  )
  returning id into invoice_id;

  insert into public.invoice_items (
    invoice_id,
    category,
    description,
    quantity,
    unit_price,
    position
  )
  select
    invoice_id,
    item.value ->> 'category',
    trim(item.value ->> 'name'),
    (item.value ->> 'qty')::numeric,
    (item.value ->> 'unit')::numeric,
    item.ordinality::integer
  from jsonb_array_elements(p_items) with ordinality as item(value, ordinality);

  update public.invoices
  set status = 'issued'
  where id = invoice_id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', invoice_id)
  );
  return invoice_id;
end;
$$;

revoke all on function public.create_itemized_invoice(uuid, jsonb, numeric, numeric, text)
  from public, anon;
grant execute on function public.create_itemized_invoice(uuid, jsonb, numeric, numeric, text)
  to authenticated;

commit;
