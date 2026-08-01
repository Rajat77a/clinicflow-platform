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
const restoredMfaSource = await readFile(
  new URL(
    "../../supabase/migrations/20260729113000_restore_privileged_mfa_requirement.sql",
    import.meta.url,
  ),
  "utf8",
);
const disabledMfaSource = await readFile(
  new URL(
    "../../supabase/migrations/20260731100000_disable_mandatory_mfa.sql",
    import.meta.url,
  ),
  "utf8",
);
const currentMfaSource = await readFile(
  new URL(
    "../../supabase/migrations/20260801100000_restore_hospital_mfa.sql",
    import.meta.url,
  ),
  "utf8",
);
const developmentMfaSource = await readFile(
  new URL(
    "../../supabase/migrations/20260801130000_disable_development_mfa.sql",
    import.meta.url,
  ),
  "utf8",
);

test("mandatory MFA is disabled during development without deleting its implementation", () => {
  assert.doesNotMatch(rootSource, /PrivilegedMfaGate/);
  assert.match(rootSource, /<WorkspaceDataProvider>/);
  assert.match(componentSource, /user\?\.role === "super_admin"/);
  assert.match(componentSource, /user\?\.role === "clinic_admin"/);
  assert.match(componentSource, /currentLevel === "aal2"/);
  assert.match(componentSource, /challengeAndVerify/);
});

test("privileged users can enroll and verify a TOTP authenticator", () => {
  assert.match(componentSource, /factorType: "totp"/);
  assert.match(componentSource, /data\.totp\.qr_code/);
  assert.match(componentSource, /data\.totp\.secret/);
  assert.match(componentSource, /mfa\.enrolled/);
});

test("historical migrations document the previous AAL2 policy", () => {
  assert.match(migrationSource, /m\.role_code not in \('super_admin', 'clinic_admin'\)/);
  assert.match(migrationSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(migrationSource, /= 'aal2'/);
  assert.match(restoredMfaSource, /m\.role_code not in \('super_admin', 'clinic_admin'\)/);
  assert.match(restoredMfaSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(restoredMfaSource, /= 'aal2'/);
});

test("current development permissions accept password-authenticated sessions", () => {
  const adminInvite = functionSource.indexOf("admin.inviteUserByEmail");
  const permissionCheck = functionSource.indexOf('eq("permission_code", "people.manage")');
  assert.ok(permissionCheck > 0);
  assert.ok(adminInvite > permissionCheck);
  assert.doesNotMatch(functionSource, /getAuthenticatorAssuranceLevel/);
  assert.doesNotMatch(functionSource, /Two-step verification is required/);
  assert.match(disabledMfaSource, /membership\.active/);
  assert.match(disabledMfaSource, /permission\.permission_code = permission_name/);
  assert.doesNotMatch(disabledMfaSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.doesNotMatch(disabledMfaSource, /= 'aal2'/);
  assert.match(currentMfaSource, /membership\.role_code not in \('super_admin', 'clinic_admin'\)/);
  assert.match(currentMfaSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(currentMfaSource, /= 'aal2'/);
  assert.match(developmentMfaSource, /membership\.active/);
  assert.match(developmentMfaSource, /permission\.permission_code = permission_name/);
  assert.doesNotMatch(developmentMfaSource, /auth\.jwt\(\) ->> 'aal'/);
  assert.doesNotMatch(developmentMfaSource, /= 'aal2'/);
});

test("security events are validated and append-only audit records are used", () => {
  for (const action of ["mfa.enrolled", "mfa.verified", "password.changed"]) {
    assert.match(migrationSource, new RegExp(action.replace(".", "\\.")));
  }
  assert.match(migrationSource, /insert into public\.audit_events/);
  assert.match(migrationSource, /grant execute on function public\.record_security_event/);
});
