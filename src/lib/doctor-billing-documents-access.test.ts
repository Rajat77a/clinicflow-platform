import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../../supabase/migrations/20261013020000_allow_doctor_patient_billing_and_documents.sql", import.meta.url),
  "utf8",
);

test("doctor billing and document access remains patient-scoped", () => {
  assert.match(migration, /\('doctor', 'billing\.read'\)/);
  assert.match(migration, /\('doctor', 'documents\.read'\)/);
  assert.match(migration, /create policy invoices_select[\s\S]*private\.can_access_patient\(patient_id\)/);
  assert.match(migration, /create policy documents_select[\s\S]*private\.can_access_patient\(patient_id\)/);
});

test("hospital document storage downloads require visible clean document rows", () => {
  assert.match(migration, /create policy hospital_documents_select on storage\.objects/);
  assert.match(migration, /document\.storage_bucket = storage\.objects\.bucket_id/);
  assert.match(migration, /document\.storage_path = storage\.objects\.name/);
  assert.match(migration, /document\.scan_status = 'clean'/);
  assert.match(migration, /private\.can_access_patient\(document\.patient_id\)/);
});
