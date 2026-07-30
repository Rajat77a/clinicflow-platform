import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellSource = await readFile(
  new URL("../components/layout/app-shell.tsx", import.meta.url),
  "utf8",
);
const patientSource = await readFile(
  new URL("../routes/app.patients.$id.tsx", import.meta.url),
  "utf8",
);
const appointmentSource = await readFile(
  new URL("../routes/app.appointments.new.tsx", import.meta.url),
  "utf8",
);
const billingSource = await readFile(
  new URL("../routes/app.billing.new.tsx", import.meta.url),
  "utf8",
);
const authSource = await readFile(new URL("./auth.tsx", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");
const repositorySource = await readFile(
  new URL("./supabase/workspace-repository.ts", import.meta.url),
  "utf8",
);
const usersSource = await readFile(new URL("../routes/app.users.tsx", import.meta.url), "utf8");
const offboardingMigration = await readFile(
  new URL("../../supabase/migrations/20260730100000_safe_staff_offboarding.sql", import.meta.url),
  "utf8",
);

test("every authenticated portal renders the shared live clock", () => {
  assert.match(shellSource, /function PortalClock\(\)/);
  assert.match(shellSource, /setInterval\(\(\) => setNow\(new Date\(\)\), 1_000\)/);
  assert.match(shellSource, /<PortalClock \/>/);
});

test("patient follow-up links preselect the patient in appointment booking", () => {
  assert.match(patientSource, /search=\{\{ patient: patient\.id \}\}/);
  assert.match(appointmentSource, /requestedPatientId/);
  assert.match(appointmentSource, /getPatient\(requestedPatientId\)/);
});

test("billing loads the assigned doctor's configured consultation fee", () => {
  assert.match(billingSource, /assignedDoctor\?\.consultationFee == null/);
  assert.match(billingSource, /unit: consultationFee/);
  assert.match(billingSource, /minmax\(240px,2fr\)/);
});

test("invite and recovery password setup survives the PKCE redirect", () => {
  assert.match(repositorySource, /\/login\?setup=invite/);
  assert.match(authSource, /\/login\?setup=recovery/);
  assert.match(authSource, /passwordSetupRequired\s*\|\|/);
  assert.match(loginSource, /showPw2/);
  assert.match(loginSource, /EyeOff/);
});

test("staff offboarding revokes access without deleting hospital history", () => {
  assert.match(repositorySource, /rpc\("deactivate_staff_member"/);
  assert.match(usersSource, /Existing clinical and audit records will be preserved/);
  assert.match(offboardingMigration, /not private\.has_permission\('people\.manage'\)/);
  assert.match(offboardingMigration, /p_user_id = auth\.uid\(\)/);
  assert.match(offboardingMigration, /assert_staff_role_assignment/);
  assert.match(offboardingMigration, /update public\.staff_memberships[\s\S]*active = false/);
  assert.match(offboardingMigration, /update public\.patient_care_teams[\s\S]*active = false/);
  assert.doesNotMatch(offboardingMigration, /delete from public\./i);
  assert.match(offboardingMigration, /'staff\.deactivated'/);
});
