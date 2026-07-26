create extension if not exists pg_trgm with schema extensions;

create index if not exists prescriptions_hospital_created_idx
  on public.prescriptions (hospital_id, created_at desc);

create index if not exists invoices_hospital_created_idx
  on public.invoices (hospital_id, created_at desc);

create index if not exists lab_results_recorded_idx
  on public.lab_results (recorded_at desc, lab_order_id);

create index if not exists audit_events_action_search_idx
  on public.audit_events
  using gin (action extensions.gin_trgm_ops);

comment on index public.prescriptions_hospital_created_idx is
  'Supports bounded hospital prescription directories ordered newest first.';
comment on index public.invoices_hospital_created_idx is
  'Supports bounded hospital invoice directories ordered newest first.';
comment on index public.lab_results_recorded_idx is
  'Supports bounded lab-result timelines ordered newest first.';
comment on index public.audit_events_action_search_idx is
  'Supports scoped audit action searches without full-table scans.';
