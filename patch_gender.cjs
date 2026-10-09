const fs = require("fs");
let code = fs.readFileSync("supabase/migrations/20261010000000_safe_activate_invite.sql", "utf8");
code = code.replace(
    "v_rec.role_code, true, v_rec.specialty, v_rec.shift, v_rec.gender, v_rec.qualification,",
    "v_rec.role_code, true, v_rec.specialty, v_rec.shift, nullif(trim(v_rec.gender), ''), v_rec.qualification,"
);
code = code.replace(
    "gender = coalesce(excluded.gender, public.staff_memberships.gender),",
    "gender = coalesce(nullif(trim(excluded.gender), ''), public.staff_memberships.gender),"
);
fs.writeFileSync("supabase/migrations/20261010000000_safe_activate_invite.sql", code);
console.log("Patched gender successfully");
