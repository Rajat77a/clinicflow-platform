-- Allow authenticated staff members (doctors, receptionists) to update their own staff membership record (e.g. specialty, shift, etc.)
drop policy if exists memberships_update on public.staff_memberships;
create policy memberships_update on public.staff_memberships
for update to authenticated
using (
  user_id = auth.uid()
  or private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
)
with check (
  user_id = auth.uid()
  or private.is_platform_admin()
  or (hospital_id = private.current_hospital_id() and private.has_permission('people.manage'))
);
