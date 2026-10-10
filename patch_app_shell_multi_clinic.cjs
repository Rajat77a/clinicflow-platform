const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/layout/app-shell.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update the interface and logic for available roles
const appShellRegex = /const \[availableRoles, setAvailableRoles\] = useState<string\[\]>\(\[\]\);([\s\S]*?)const switchRole = async \(newRole: string\) => {([\s\S]*?)alert\("Failed to switch role: " \+ \(error\?\.message \|\| data\?\.error \|\| "Unknown error"\)\);\s+\}\s+\};/;

const newAppShellCode = `
  const [availableRoles, setAvailableRoles] = useState<{role_code: string, hospital_id: string, hospital_name?: string}[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('staff_roles')
        .select('role_code, hospital_id, hospitals(name)')
        .eq('user_id', user.userId)
        .then(({ data }: { data: any }) => {
          if (data) {
            const roles = data.map((d: any) => ({
              role_code: d.role_code,
              hospital_id: d.hospital_id,
              hospital_name: d.hospitals?.name
            }));
            
            // Ensure current role is in list even if not in DB yet (edge cases)
            if (!roles.some((r: any) => r.role_code === user.role && r.hospital_id === user.clinicId)) {
              roles.push({
                role_code: user.role,
                hospital_id: user.clinicId || '',
                hospital_name: user.clinic
              });
            }
            setAvailableRoles(roles);
          }
      });
    }
  }, [user]);

  const switchRole = async (newRole: string, newHospitalId: string) => {
    if (newRole === user?.role && newHospitalId === user?.clinicId) return;
    setSwitching(true);
    const { data, error } = await supabase.rpc('switch_active_role', { p_role_code: newRole, p_hospital_id: newHospitalId });
    if (!error && data?.success) {
      window.location.reload();
    } else {
      setSwitching(false);
      alert("Failed to switch role: " + (error?.message || data?.error || "Unknown error"));
    }
  };
`;

content = content.replace(appShellRegex, newAppShellCode.trim());

// 2. Update the JSX for mapping over the roles
const jsxRegex = /\{availableRoles\.map\(role => \([\s\S]*?className="flex items-center justify-between"[\s\S]*?>[\s\S]*?<span>\{ROLE_LABELS\[role as Role\] \|\| role\}<\/span>[\s\S]*?\{role === user\.role && <div className="h-2 w-2 rounded-full bg-green-500" \/>\}[\s\S]*?<\/DropdownMenuItem>[\s\S]*?\)\)\}/;

const newJsx = `{availableRoles.map(role => (
                      <DropdownMenuItem 
                        key={\`\${role.role_code}-\${role.hospital_id}\`} 
                        disabled={switching}
                        onClick={() => switchRole(role.role_code, role.hospital_id)}
                        className="flex flex-col items-start gap-1 cursor-pointer"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium">{ROLE_LABELS[role.role_code as Role] || role.role_code}</span>
                          {role.role_code === user.role && role.hospital_id === user.clinicId && <div className="h-2 w-2 rounded-full bg-green-500" />}
                        </div>
                        {role.hospital_name && <span className="text-[10px] text-muted-foreground">{role.hospital_name}</span>}
                      </DropdownMenuItem>
                    ))}`;

content = content.replace(jsxRegex, newJsx);

fs.writeFileSync(filePath, content);
console.log("Patched app-shell.tsx to handle multi-clinic roles successfully!");
