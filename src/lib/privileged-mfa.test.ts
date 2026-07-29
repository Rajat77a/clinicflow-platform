import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentSource = await readFile(
  new URL("../components/auth/privileged-mfa-gate.tsx", import.meta.url),
  "utf8",
);
const rootSource = await readFile(new URL("../routes/__root.tsx", import.meta.url), "utf8");
const functionSource = await readFile(
  new URL("../../supabase/functions/invite-staff/index.ts", import.meta.url),
  "utf8",
);
const migrationSource = await readFile(
  new URL(
    "../../supabase/migrations/20260728180000_enforce_privileged_mfa.sql",
    import.meta.url,
  ),
  "utf8",
);
const superAdminMfaOverrideSource = await readFile(
  new URL(
    "../../supabase/migrations/20260729100000_remove_super_admin_mfa_requirement.sql",
    import.meta.url,
  ),
  "utf8",
);

test("clinic admin MFA blocks workspace loading until AAL2 verification", () => {
  assert.match(rootSource, /<PrivilegedMfaGate[\s\S]*<WorkspaceDataProvider>/);
  assert.match(rootSource, /key=\{user\?\.userId \?\? "anonymous"\}/);
  assert.match(componentSource, /user\?\.role === "clinic_admin"/);
  assert.doesNotMatch(componentSource, /user\?\.role === "super_admin"/);
  assert.match(componentSource, /currentLevel === "aal2"/);
  assert.match(componentSource, /challengeAndVerify/);
});

test("privileged users can enroll and verify a TOTP authenticator", () => {
  assert.match(componentSource, /factorType: "totp"/);
  assert.match(componentSource, /data\.totp\.qr_code/);
  assert.match(componentSource, /data\.totp\.secret/);
  assert.match(componentSource, /mfa\.enrolled/);
});

test("database permissions deny privileged AAL1 tokens", () => {
  assert.match(migrationSource, /m\.role_code not in \('super_admin', 'clinic_admin'\)/);
  assert.match(migrationSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(migrationSource, /= 'aal2'/);
  assert.match(superAdminMfaOverrideSource, /m\.role_code <> 'clinic_admin'/);
  assert.doesNotMatch(superAdminMfaOverrideSource, /super_admin.+aal2/s);
});

test("clinic admin staff invitation verifies AAL before service-role work", () => {
  const aalCheck = functionSource.indexOf("getAuthenticatorAssuranceLevel");
  const adminInvite = functionSource.indexOf("admin.inviteUserByEmail");
  assert.ok(aalCheck > 0);
  assert.ok(adminInvite > aalCheck);
  assert.match(functionSource, /actor\.role_code === "clinic_admin"/);
  assert.doesNotMatch(functionSource, /actor\.role_code === "super_admin" \|\| actor\.role_code === "clinic_admin"/);
  assert.match(functionSource, /assurance\.currentLevel !== "aal2"/);
});

test("security events are validated and append-only audit records are used", () => {
  for (const action of ["mfa.enrolled", "mfa.verified", "password.changed"]) {
    assert.match(migrationSource, new RegExp(action.replace(".", "\\.")));
  }
  assert.match(migrationSource, /insert into public\.audit_events/);
  assert.match(migrationSource, /grant execute on function public\.record_security_event/);
});
