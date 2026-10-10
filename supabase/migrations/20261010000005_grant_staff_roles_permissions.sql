-- Grant permissions to authenticated users for staff_roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;

-- Ensure switch_active_role can be executed
GRANT EXECUTE ON FUNCTION public.switch_active_role(text, uuid) TO authenticated;

-- Notify postgrest to reload the schema cache
NOTIFY pgrst, 'reload schema';
