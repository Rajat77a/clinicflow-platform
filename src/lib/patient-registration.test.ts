import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const formSource = await readFile(
  new URL("../routes/app.patients.new.tsx", import.meta.url),
  "utf8",
);
const migrationSource = await readFile(
  new URL("../../supabase/migrations/20260727173000_fix_patient_registration.sql", import.meta.url),
  "utf8",
);
const registrationDoctorLookupSource = await readFile(
  new URL(
    "../../supabase/migrations/20260728223000_fix_registration_doctor_lookup.sql",
    import.meta.url,
  ),
  "utf8",
);
const patientDetailsMigrationSource = await readFile(
  new URL(
    "../../supabase/migrations/20260802100000_preserve_patient_registration_details.sql",
    import.meta.url,
  ),
  "utf8",
);
const repositorySource = await readFile(
  new URL("./supabase/workspace-repository.ts", import.meta.url),
  "utf8",
);

test("patient form submits canonical database sex values", () => {
  assert.match(formSource, /value="male">Male/);
  assert.match(formSource, /value="female">Female/);
  assert.match(formSource, /value="unknown">Other/);
  assert.doesNotMatch(formSource, /value="[mfo]">/);
});

test("patient registration establishes the identifier before RLS visibility", () => {
  assert.match(migrationSource, /patient_id uuid := extensions\.gen_random_uuid\(\)/);
  assert.match(migrationSource, /insert into public\.patients \(\s*id,/);
  assert.doesNotMatch(migrationSource, /returning id into patient_id/);
});

test("receptionists resolve doctor assignments without reading private staff rows", () => {
  assert.match(
    migrationSource,
    /function private\.active_doctor_assignment\(target_doctor_user_id uuid\)/,
  );
  assert.match(migrationSource, /private\.has_permission\('appointments\.write'\)/);
  assert.match(
    registrationDoctorLookupSource,
    /from private\.active_doctor_assignment\(p_doctor_user_id\)/,
  );
  assert.doesNotMatch(
    registrationDoctorLookupSource,
    /from public\.staff_memberships[\s\S]*where user_id = p_doctor_user_id/,
  );
});

test("patient registration persists every visible clinical and contact field", () => {
  for (const field of [
    "bloodGroup",
    "email",
    "whatsappPhone",
    "address",
    "emergencyContactName",
    "emergencyContactPhone",
    "allergies",
    "chronicConditions",
  ]) {
    assert.match(formSource, new RegExp(`set${field[0].toUpperCase()}${field.slice(1)}`));
    assert.match(repositorySource, new RegExp(`p_${field.replace(/[A-Z]/g, value => `_${value.toLowerCase()}`)}`));
  }
  assert.match(repositorySource, /register_patient_with_details/);
  assert.match(patientDetailsMigrationSource, /insert into public\.patients[\s\S]*blood_group[\s\S]*emergency_contact[\s\S]*chronic_conditions/);
});

test("patient directory recognizes the canonical primary doctor relationship", () => {
  assert.match(
    patientDetailsMigrationSource,
    /team\.relationship in \('primary_doctor', 'primary'\)/,
  );
});
