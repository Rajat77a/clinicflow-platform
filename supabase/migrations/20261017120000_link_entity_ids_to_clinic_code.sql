-- Migration to connect all entity numbers (Patients, Invoices, Staff) to their clinic code (e.g. CL-101)

-- 1. Update auto_generate_staff_id to prefix employee_number with clinic short_id
create or replace function public.auto_generate_staff_id()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
  v_clinic_code text;
  v_last_number integer;
begin
  -- Only generate if not provided
  if new.employee_number is null or new.employee_number = '' then
    -- Determine role prefix
    v_prefix := case new.role_code
      when 'super_admin' then 'SA'
      when 'clinic_admin' then 'CA'
      when 'doctor' then 'DR'
      when 'receptionist' then 'RC'
      else 'ST'
    end;

    -- Look up hospital short_id (e.g. CL-101)
    select coalesce(short_id, 'CL-101')
    into v_clinic_code
    from public.hospitals
    where id = new.hospital_id;

    if v_clinic_code is null or v_clinic_code = '' then
      v_clinic_code := 'CL-101';
    end if;

    -- Get highest number for this prefix in this hospital
    select coalesce(max(nullif(regexp_replace(employee_number, '^.*-' || v_prefix || '-', ''), '')::integer), 100)
    into v_last_number
    from public.staff_memberships
    where hospital_id = new.hospital_id
      and employee_number ~ ('-' || v_prefix || '-[0-9]+$');

    -- Increment and format as e.g. CL-101-DR-101
    new.employee_number := v_clinic_code || '-' || v_prefix || '-' || (v_last_number + 1)::text;
  end if;

  return new;
end;
$$;

-- 2. Update auto_generate_patient_id trigger to prefix with clinic code
create or replace function public.auto_generate_patient_id()
returns trigger
language plpgsql
as $$
declare
  v_clinic_code text;
  v_last_number integer;
begin
  if new.patient_id is null or new.patient_id = '' then
    select coalesce(short_id, 'CL-101')
    into v_clinic_code
    from public.hospitals
    where id = new.hospital_id;

    if v_clinic_code is null or v_clinic_code = '' then
      v_clinic_code := 'CL-101';
    end if;

    select coalesce(max(nullif(regexp_replace(patient_id, '^.*-PT-', ''), '')::integer), 100)
    into v_last_number
    from public.patients
    where hospital_id = new.hospital_id
      and patient_id ~ '-PT-[0-9]+$';

    new.patient_id := v_clinic_code || '-PT-' || (v_last_number + 1)::text;
  end if;

  return new;
end;
$$;

-- 3. Update create_itemized_invoice to prefix invoice_number with clinic code
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
  v_clinic_code text;
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
      where nullif(trim(item.category), '') is null
        or nullif(trim(item.name), '') is null
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

  -- Look up hospital short_id for clean unified invoice prefix
  select coalesce(short_id, 'CL-101')
  into v_clinic_code
  from public.hospitals
  where id = hospital;

  if v_clinic_code is null or v_clinic_code = '' then
    v_clinic_code := 'CL-101';
  end if;

  invoice_number := format(
    '%s-INV-%s-%s',
    v_clinic_code,
    to_char(current_date, 'YYYYMMDD'),
    upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 6))
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
    'issued',
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
    trim(item.category),
    trim(item.name),
    item.qty,
    item.unit,
    item.position - 1
  from jsonb_to_recordset(p_items) with ordinality as item(
    category text,
    name text,
    qty numeric,
    unit numeric,
    position int
  );

  perform private.finish_command(
    p_idempotency_key,
    jsonb_build_object('id', invoice_id)
  );

  return invoice_id;
end;
$$;
