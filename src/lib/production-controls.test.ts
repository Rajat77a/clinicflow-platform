import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const patientSource = await readFile(
  new URL("../routes/app.patients.$id.tsx", import.meta.url),
  "utf8",
);
const prescriptionSource = await readFile(
  new URL("../routes/app.prescriptions.new.tsx", import.meta.url),
  "utf8",
);
const appShellSource = await readFile(
  new URL("../components/layout/app-shell.tsx", import.meta.url),
  "utf8",
);

test("external patient sharing remains demo-only until consent is implemented", () => {
  assert.match(patientSource, /canUseExternalSharing = supabaseConfig\.demoMode/);
  assert.match(patientSource, /canUseExternalSharing &&[\s\S]*Send on WhatsApp/);
  assert.match(prescriptionSource, /supabaseConfig\.demoMode &&[\s\S]*WhatsApp/);
});

test("production does not offer mutation of immutable signed prescriptions", () => {
  assert.match(patientSource, /canEditRx && supabaseConfig\.demoMode && <Button asChild/);
  assert.match(
    prescriptionSource,
    /if \(edit && !supabaseConfig\.demoMode\)[\s\S]*Signed prescriptions are immutable/,
  );
});

test("production navigation never links to disabled sample modules", () => {
  assert.match(appShellSource, /\{isDemoMode && \([\s\S]*to="\/app\/notifications"[\s\S]*\)\}/);
});

test("global search only offers doctor-directory results to authorized roles", () => {
  assert.match(appShellSource, /canAccessPath\(user\.role, "\/app\/doctors"\)/);
  assert.match(appShellSource, /\(canSearchDoctors \? doctors : \[\]\)/);
});
