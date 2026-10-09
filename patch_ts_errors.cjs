const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/layout/app-shell.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('import { supabase } from "@/lib/supabase";', 'import { supabase } from "@/lib/supabase/client";');
content = content.replace('.then(({ data }) => {', '.then(({ data }: { data: any }) => {');
content = content.replace('.map(d => d.role_code)', '.map((d: any) => d.role_code)');
content = content.replace('setAvailableRoles(roles)', 'setAvailableRoles(roles as string[])');

fs.writeFileSync(filePath, content);

// Fix setup.tsx
const setupPath = path.join(__dirname, 'src/routes/setup.tsx');
let setupContent = fs.readFileSync(setupPath, 'utf8');
setupContent = setupContent.replace('.then(({ data, error }) => {', '.then(({ data, error }: { data: any, error: any }) => {');
fs.writeFileSync(setupPath, setupContent);

console.log("Fixed TS errors");
