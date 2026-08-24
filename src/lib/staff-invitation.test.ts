import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(
  new URL("../../supabase/functions/invite-staff/index.ts", import.meta.url),
  "utf8",
);
const migrationSource = await readFile(
  new URL("../../supabase/migrations/20260727231000_complete_staff_onboarding.sql", import.meta.url),
  "utf8",
);

test("staff invitation CORS permits every header sent by the browser client", () => {
  for (const header of [
    "authorization",
    "apikey",
    "content-type",
    "idempotency-key",
    "x-client-info",
    "x-request-id",
  ]) {
    assert.match(functionSource, new RegExp(`"${header}"`));
  }
});

test("staff invitation failures include a safe code and request ID", () => {
  assert.match(functionSource, /code: errorCode\(status\)/);
  assert.match(functionSource, /requestId/);
  assert.match(functionSource, /"X-Request-ID": requestId/);
});

test("staff invitations store details in invite tokens for unlimited-validity setup links", () => {
  assert.match(functionSource, /\.from\("invite_tokens"\)/);
  assert.match(functionSource, /medical_registration_number: medicalRegistrationNumber/);
  assert.match(functionSource, /consultation_fee: consultationFee/);
  assert.match(functionSource, /\.from\("facilities"\)/);
  assert.match(functionSource, /\.eq\("active", true\)/);
  assert.match(functionSource, /setupUrl/);
});

test("staff provisioning RPCs are scoped to authenticated hospital users", () => {
  assert.match(migrationSource, /private\.current_hospital_id\(\)/);
  assert.match(migrationSource, /private\.has_permission\('people\.manage'\)/);
  assert.match(migrationSource, /revoke all on function public\.provision_invited_staff\([\s\S]+from public, anon;/);
  assert.match(migrationSource, /grant execute on function public\.provision_invited_staff\([\s\S]+to authenticated;/);
});

test("unconfirmed staff are exposed as invited instead of active", () => {
  assert.match(migrationSource, /invited_user\.email_confirmed_at is null then 'Invited'/);
  assert.match(migrationSource, /create or replace function public\.list_current_staff\(\)/);
});
