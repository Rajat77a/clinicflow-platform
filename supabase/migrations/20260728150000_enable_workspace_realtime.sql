-- Publish hospital-scoped records used by the live workspace subscription.
-- Existing RLS policies continue to decide which rows each connected user receives.
do $$
declare
  table_name text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    return;
  end if;

  foreach table_name in array array[
    'hospitals',
    'staff_memberships',
    'patients',
    'appointments',
    'prescriptions',
    'lab_orders',
    'invoices',
    'audit_events'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;
