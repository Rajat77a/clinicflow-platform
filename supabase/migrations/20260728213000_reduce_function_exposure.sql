-- Remove RPC access that is not part of the supported portal contract.
-- The RLS event-trigger helper exists in the shared environment but is absent
-- from a clean migration replay, so revoke it only when present.

begin;

revoke all on function public.list_active_doctors()
from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute
      'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

comment on function public.list_active_doctors() is
  'Legacy RPC retained for migration compatibility; execution is intentionally disabled.';

commit;
