-- File handling remains disabled until a trusted upload, malware scanning, and
-- patient-scoped download service is deployed. Existing storage RLS policies
-- depend on these permission codes, so removing them also blocks direct object
-- uploads through the public API.

begin;

delete from public.role_permissions
where permission_code = 'documents.write';

delete from public.role_permissions
where role_code = 'doctor'
  and permission_code = 'documents.read';

revoke insert, update, delete on public.documents from authenticated;

drop policy if exists documents_insert on public.documents;
drop policy if exists documents_update on public.documents;

comment on table public.documents is
  'Read-only metadata while file handling is disabled. Re-enable writes only through a trusted scanning service.';

commit;
