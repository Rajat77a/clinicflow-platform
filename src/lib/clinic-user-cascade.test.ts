import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceSource = await readFile(new URL("./workspace-data.tsx", import.meta.url), "utf8");
const cascadeMigration = await readFile(
  new URL("../../supabase/migrations/20261101120000_cascade_clinic_user_lifecycle.sql", import.meta.url),
  "utf8",
);

test("workspace filters out any unassigned users without valid clinics", () => {
  assert.match(workspaceSource, /const validClinicIds = new Set\(state\.clinics\.map\(\(c\) => c\.id\)\);/);
  assert.match(workspaceSource, /Boolean\(item\.clinicId && validClinicIds\.has\(item\.clinicId\)\)/);
  assert.match(workspaceSource, /doctors: clinicScope\(clinicAssigned\(state\.doctors\)\)/);
  assert.match(workspaceSource, /receptionists: clinicScope\(clinicAssigned\(state\.receptionists\)\)/);
  assert.match(workspaceSource, /rawFiltered = clinicScope\(clinicAssigned\(state\.staffMembers\)\)/);
});

test("clinic deletion and restoration cascades to all associated users in state reducer", () => {
  assert.match(workspaceSource, /case "clinic\.accessChanged":/);
  assert.match(workspaceSource, /const nextAccess = command\.active \? "Allowed" : "Suspended";/);
  assert.match(workspaceSource, /const nextStatus = command\.active \? "Active" : "Inactive";/);
  assert.match(workspaceSource, /m\.clinicId === command\.clinicId\s*\?\s*\{\s*\.\.\.m,\s*status:\s*nextStatus\s*\}/);
  assert.match(workspaceSource, /d\.clinicId === command\.clinicId\s*\?\s*\{\s*\.\.\.d,\s*status:\s*nextStatus\s*\}/);
  assert.match(workspaceSource, /r\.clinicId === command\.clinicId\s*\?\s*\{\s*\.\.\.r,\s*status:\s*nextStatus\s*\}/);
});

test("database migration cascades clinic access to staff memberships and cleans up unassigned users", () => {
  assert.match(cascadeMigration, /delete from public\.staff_memberships\s*where hospital_id is null/);
  assert.match(cascadeMigration, /update public\.staff_memberships\s*set active = p_active/);
  assert.match(cascadeMigration, /update public\.patient_care_teams team\s*set active = false/);
  assert.match(cascadeMigration, /update public\.patient_care_teams team\s*set active = true/);
});

