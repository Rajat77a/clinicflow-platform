-- Ensure every role assignment is automatically tracked in staff_roles
CREATE OR REPLACE FUNCTION public.sync_staff_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.staff_roles (user_id, hospital_id, role_code)
    VALUES (NEW.user_id, NEW.hospital_id, NEW.role_code)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff_roles ON public.staff_memberships;
CREATE TRIGGER trg_sync_staff_roles
AFTER INSERT OR UPDATE OF role_code, hospital_id ON public.staff_memberships
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_roles();

-- Manually catch up any roles that were missed since the last backfill
INSERT INTO public.staff_roles (user_id, hospital_id, role_code)
SELECT user_id, hospital_id, role_code FROM public.staff_memberships
ON CONFLICT DO NOTHING;
