create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_method text,
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
  invoice_record public.invoices%rowtype;
  payment_id uuid;
begin
  prior := private.claim_command(p_idempotency_key, 'record-invoice-payment');
  if prior is not null then
    return (prior ->> 'id')::uuid;
  end if;

  if nullif(trim(p_method), '') is null or length(trim(p_method)) > 80 then
    raise exception 'A valid payment method is required'
      using errcode = '22023';
  end if;

  select *
  into invoice_record
  from public.invoices
  where id = p_invoice_id
    and hospital_id = hospital
  for update;

  if not found then
    raise exception 'Invoice not found'
      using errcode = 'P0002';
  end if;
  if invoice_record.status in ('paid', 'void') then
    raise exception 'A paid or void invoice cannot accept payment'
      using errcode = '23514';
  end if;

  insert into public.payments (
    hospital_id,
    invoice_id,
    amount,
    currency,
    method,
    status,
    received_by,
    received_at
  )
  values (
    hospital,
    invoice_record.id,
    invoice_record.total,
    invoice_record.currency,
    trim(p_method),
    'confirmed',
    auth.uid(),
    now()
  )
  returning id into payment_id;

  update public.invoices
  set status = 'paid',
      version = version + 1
  where id = invoice_record.id;

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', payment_id)
  );
  return payment_id;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, text, text) to authenticated;
