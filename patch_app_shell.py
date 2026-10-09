import fs
import re

file_path = "src/components/layout/app-shell.tsx"
content = fs.readFileSync(file_path, "utf8")

# 1. Add imports
if 'import { supabase }' not in content:
    content = content.replace('import { useAuth', 'import { supabase } from "@/lib/supabase";\nimport { useAuth')
if 'import { useEffect, useState }' not in content:
    content = content.replace('import { useState } from "react";', 'import { useState, useEffect } from "react";')
elif 'useState' in content and 'useEffect' not in content:
    content = content.replace('useState', 'useState, useEffect')

# 2. Add Role Switcher state inside AppShell
app_shell_code = """
  const { user, logout, isDemoMode } = useAuth();
  const { syncStatus } = useWorkspaceData();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // -- ROLE SWITCHER LOGIC --
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('staff_roles').select('role_code').eq('user_id', user.userId).then(({ data }) => {
        if (data) {
          const roles = Array.from(new Set(data.map(d => d.role_code)));
          if (!roles.includes(user.role)) roles.push(user.role);
          setAvailableRoles(roles);
        }
      });
    }
  }, [user]);

  const switchRole = async (newRole: string) => {
    if (newRole === user?.role) return;
    setSwitching(true);
    const { data, error } = await supabase.rpc('switch_active_role', { p_role_code: newRole });
    if (!error && data?.success) {
      window.location.reload();
    } else {
      setSwitching(false);
      alert("Failed to switch role: " + (error?.message || data?.error || "Unknown error"));
    }
  };
"""

content = re.sub(r'const { user, logout, isDemoMode } = useAuth\(\);\s+const { syncStatus } = useWorkspaceData\(\);\s+const navigate = useNavigate\(\);\s+const \[dark, setDark\] = useState\(false\);\s+const \[mobileOpen, setMobileOpen\] = useState\(false\);', app_shell_code.strip(), content)

# 3. Add Dropdown menu items for roles
dropdown_menu_items = """
                <DropdownMenuLabel>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                {availableRoles.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Switch Role</DropdownMenuLabel>
                    {availableRoles.map(role => (
                      <DropdownMenuItem 
                        key={role} 
                        disabled={switching}
                        onClick={() => switchRole(role)}
                        className="flex items-center justify-between"
                      >
                        <span>{ROLE_LABELS[role as Role] || role}</span>
                        {role === user.role && <div className="h-2 w-2 rounded-full bg-green-500" />}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                <DropdownMenuSeparator />
"""

content = re.sub(r'<DropdownMenuLabel>\s*<div className="font-semibold">\{user\.name\}</div>\s*<div className="text-xs font-normal text-muted-foreground">\{user\.email\}</div>\s*</DropdownMenuLabel>\s*<DropdownMenuSeparator />\s*<DropdownMenuSeparator />', dropdown_menu_items.strip(), content)

fs.writeFileSync(file_path, content)
print("Patched app-shell.tsx successfully!")
