import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const downloadsSource = await readFile(
  new URL("../routes/app.downloads.tsx", import.meta.url),
  "utf8",
);

test("download center allows clinical admin to download complete clinic data or individual datasets", () => {
  // Complete clinic backup / all clinic data option
  assert.match(downloadsSource, /downloadCompleteClinicBackup/);
  assert.match(downloadsSource, /Download Complete Clinic Data \(Backup\)/);
  assert.match(downloadsSource, /downloadAllDatasetsBatch/);
  assert.match(downloadsSource, /Download All Datasets \(CSVs\)/);

  // Clinic profile and summary with necessary details (no. of patients, doctors, etc.)
  assert.match(downloadsSource, /clinicSummary/);
  assert.match(downloadsSource, /Clinic Profile & Summary/);
  assert.match(downloadsSource, /No\. of Patients/);
  assert.match(downloadsSource, /No\. of Doctors/);
  assert.match(downloadsSource, /No\. of Receptionists/);
  assert.match(downloadsSource, /No\. of Clinical Admins/);

  // Individual dataset options for clinical admin
  assert.match(downloadsSource, /key:\s*"patients"/);
  assert.match(downloadsSource, /key:\s*"doctors"/);
  assert.match(downloadsSource, /key:\s*"receptionists"/);
  assert.match(downloadsSource, /key:\s*"clinicalAdmins"/);
  assert.match(downloadsSource, /key:\s*"allUsers"/);

  // Individual one-click download buttons on each dataset card
  assert.match(downloadsSource, /downloadSingleDataset/);
  assert.match(downloadsSource, /Download CSV/);

  // Batch download selected option
  assert.match(downloadsSource, /downloadSelectedDatasets/);
  assert.match(downloadsSource, /Download Selected/);
});
