-- Local development data is intentionally minimal and contains no real patient data.
insert into public.hospitals (name, legal_name, slug, timezone, currency, locale)
values (
  'ClinicFlow Development Hospital',
  'ClinicFlow Development Hospital',
  'clinicflow-development',
  'Asia/Kolkata',
  'INR',
  'en-IN'
)
on conflict (slug) do nothing;

insert into public.facilities (hospital_id, code, name)
select id, 'MAIN', 'Main Facility'
from public.hospitals
on conflict (hospital_id, code) do nothing;
