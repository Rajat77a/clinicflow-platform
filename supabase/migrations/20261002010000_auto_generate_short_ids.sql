-- Function to auto-generate employee numbers based on role and hospital
create or replace function public.auto_generate_staff_id()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
  v_last_number integer;
begin
  -- Only generate if not provided
  if new.employee_number is null or new.employee_number = '' then
    -- Determine prefix based on role
    v_prefix := case new.role_code
      when 'super_admin' then 'SA'
      when 'clinic_admin' then 'CA'
      when 'doctor' then 'DR'
      when 'receptionist' then 'RC'
      else 'ST' -- fallback for staff
    end;

    -- Get the highest number for this prefix in this hospital
    select coalesce(max(nullif(regexp_replace(employee_number, '^' || v_prefix || '-', ''), '')::integer), 100)
    into v_last_number
    from public.staff_memberships
    where hospital_id = new.hospital_id
      and employee_number like v_prefix || '-%'
      and employee_number ~ ('^' || v_prefix || '-[0-9]+$');

    -- Increment and format
    new.employee_number := v_prefix || '-' || (v_last_number + 1)::text;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_auto_generate_staff_id on public.staff_memberships;
create trigger trigger_auto_generate_staff_id
before insert on public.staff_memberships
for each row
execute function public.auto_generate_staff_id();

-- Patient short IDs 
create or replace function public.auto_generate_patient_id()
returns trigger
language plpgsql
as $$
declare
  v_last_number integer;
begin
  if new.patient_id is null or new.patient_id = '' then
    select coalesce(max(nullif(regexp_replace(patient_id, '^PT-', ''), '')::integer), 100)
    into v_last_number
    from public.patients
    where hospital_id = new.hospital_id
      and patient_id like 'PT-%'
      and patient_id ~ '^PT-[0-9]+$';

    new.patient_id := 'PT-' || (v_last_number + 1)::text;
  end if;

  return new;
end;
$$;

-- We need to check if patients table exists and has patient_id
-- (Assuming it does based on the prompt, but if not this might error. We will apply it if possible.)
do $$
begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'patients') then
    if exists (select from information_schema.columns where table_schema = 'public' and table_name = 'patients' and column_name = 'patient_id') then
      drop trigger if exists trigger_auto_generate_patient_id on public.patients;
      create trigger trigger_auto_generate_patient_id
      before insert on public.patients
      for each row
      execute function public.auto_generate_patient_id();
    end if;
  end if;
end;
$$;
