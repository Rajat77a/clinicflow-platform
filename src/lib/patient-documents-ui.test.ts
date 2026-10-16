import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const filesSource = await readFile(new URL("../routes/app.files.tsx", import.meta.url), "utf8");
const patientSource = await readFile(new URL("../routes/app.patients.$id.tsx", import.meta.url), "utf8");
const repositorySource = await readFile(new URL("./supabase/workspace-repository.ts", import.meta.url), "utf8");

test("file manager renders real patient documents instead of demo files", () => {
  assert.doesNotMatch(filesSource, /const FILES = \[/);
  assert.doesNotMatch(filesSource, /Liam Andersson|Sophia Romano|Annual report 2025/);
  assert.match(filesSource, /useRecordPage\(listDocuments\)/);
  assert.match(filesSource, /groupByPatient/);
});

test("patient profile documents tab lists documents directly", () => {
  assert.match(patientSource, /useRecordPage\(listDocuments, \{ patientId: id \}\)/);
  assert.match(patientSource, /myDocuments\.map/);
  assert.doesNotMatch(patientSource, /Open file manager/);
});

test("supabase repository reads clean uploaded document rows", () => {
  assert.match(repositorySource, /async listDocuments/);
  assert.match(repositorySource, /\.from\("documents"\)/);
  assert.match(repositorySource, /\.eq\("scan_status", "clean"\)/);
});
