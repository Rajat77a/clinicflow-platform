const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/layout/app-shell.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('import { supabase } from "@/lib/supabase/client";', 'import { getSupabaseBrowserClient } from "@/lib/supabase/client";\nconst supabase = getSupabaseBrowserClient();');

fs.writeFileSync(filePath, content);
console.log("Fixed supabase import");
