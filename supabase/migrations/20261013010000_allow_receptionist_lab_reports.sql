-- Grant lab reporting permissions (labs.write and labs.read) to receptionist
-- Clinical admin already has labs.write and labs.read

INSERT INTO public.role_permissions (role_code, permission_code)
VALUES 
  ('receptionist', 'labs.write'),
  ('receptionist', 'labs.read')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
