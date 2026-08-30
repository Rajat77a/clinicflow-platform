create or replace function public.create_staff_invite_token(
  p_email text,
  p_full_name text
)
returns text
language sql
as $$
  select 'hello'::text;
$$;
