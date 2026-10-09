create or replace function public.check_user_exists(p_email text)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $$
declare
  v_exists boolean;
begin
  select exists(select 1 from auth.users where lower(email) = lower(trim(p_email))) into v_exists;
  return v_exists;
end;
$$;
NOTIFY pgrst, 'reload schema';
