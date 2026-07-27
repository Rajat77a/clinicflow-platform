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
