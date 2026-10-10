-- Grant prescriptions.read to receptionist

INSERT INTO public.role_permissions (role_code, permission_code)
VALUES ('receptionist', 'prescriptions.read')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
