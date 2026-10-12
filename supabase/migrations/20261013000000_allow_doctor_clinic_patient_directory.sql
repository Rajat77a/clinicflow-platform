-- Allow authenticated staff with patients.read permission to view patient records
-- within their hospital tenant, so that doctors and staff can search and view
-- all registered patients in the clinic patient directory ("All Patients").

create or replace function private.can_access_patient(target_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_permission('patients.read')
    and exists (
      select 1
      from public.patients p
      where p.id = target_patient_id
        and p.hospital_id = private.current_hospital_id()
    )
$$;

grant execute on function private.can_access_patient(uuid) to authenticated;

notify pgrst, 'reload schema';
