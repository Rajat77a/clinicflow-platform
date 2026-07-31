import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const emailCheck = await readFile(
  new URL("../../scripts/verify-email-domain.mjs", import.meta.url),
  "utf8",
);
const pentestScope = await readFile(
  new URL("../../docs/PENETRATION_TEST_SCOPE.md", import.meta.url),
  "utf8",
);

test("email release check requires SPF, DKIM, and enforcing DMARC", () => {
  assert.match(emailCheck, /v=spf1/);
  assert.match(emailCheck, /v=DKIM1/);
  assert.match(emailCheck, /v=DMARC1/);
  assert.match(emailCheck, /p=\(quarantine\|reject\)/);
  assert.doesNotMatch(emailCheck, /SMTP|PASSWORD|SERVICE_ROLE/);
});

test("independent assessment covers identity, role, patient, and file boundaries", () => {
  for (const requirement of [
    "MFA",
    "cross-patient",
    "Realtime",
    "malware rejection",
    "signed downloads",
    "critical and high",
  ]) {
    assert.match(pentestScope, new RegExp(requirement, "i"));
  }
});
