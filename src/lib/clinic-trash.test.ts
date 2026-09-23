import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clinicsListSource = await readFile(
  new URL("../routes/app.clinics.index.tsx", import.meta.url),
  "utf8",
);
const clinicsBinSource = await readFile(
  new URL("../routes/app.clinics.bin.tsx", import.meta.url),
  "utf8",
);
const clinicEditSource = await readFile(
  new URL("../routes/app.clinics.$id.edit.tsx", import.meta.url),
  "utf8",
);
const sidebarNavSource = await readFile(
  new URL("../components/layout/sidebar-nav.tsx", import.meta.url),
  "utf8",
);
const workspaceDataSource = await readFile(
  new URL("./workspace-data.tsx", import.meta.url),
  "utf8",
);
const repositorySource = await readFile(
  new URL("./supabase/workspace-repository.ts", import.meta.url),
  "utf8",
);

test("super admin portal contains clinic deletion moving to trash", () => {
  // Only super admins see the delete button and trash navigation
  assert.match(clinicsListSource, /isSuperAdmin\s*&&\s*<TableHead[^>]*>Actions<\/TableHead>/);
  assert.match(clinicsListSource, /softDeleteClinic\(deleteTarget\.id\)/);
  assert.match(clinicsListSource, /Move to Trash/);
  assert.match(clinicsListSource, /\/app\/clinics\/bin/);
});

test("trash bin is accessible only to super administrators", () => {
  assert.match(clinicsBinSource, /isSuperAdmin\s*=\s*user\?\.role === "super_admin"/);
  assert.match(clinicsBinSource, /The Trash is accessible to Super Administrators only/);
  assert.match(clinicsBinSource, /restoreClinic/);
  assert.match(clinicsBinSource, /permanentlyDeleteClinic/);
});

test("clinic edit screen provides delete to trash option for super administrators", () => {
  assert.match(clinicEditSource, /isSuperAdmin\s*=\s*user\?\.role === "super_admin"/);
  assert.match(clinicEditSource, /softDeleteClinic\(clinic\.id\)/);
  assert.match(clinicEditSource, /Move to Trash/);
  assert.match(clinicEditSource, /Danger Zone/);
});

test("sidebar navigation exposes Trash under super admin operations only", () => {
  assert.match(sidebarNavSource, /super_admin:\s*\[[\s\S]*?to:\s*"\/app\/clinics\/bin",\s*label:\s*"Trash"/);
  // Non super admin roles should not have trash in their navigation
  const clinicAdminNav = sidebarNavSource.match(/clinic_admin:\s*\[([\s\S]*?)doctor:/)?.[1] ?? "";
  assert.doesNotMatch(clinicAdminNav, /\/app\/clinics\/bin/);
  const doctorNav = sidebarNavSource.match(/doctor:\s*\[([\s\S]*?)receptionist:/)?.[1] ?? "";
  assert.doesNotMatch(doctorNav, /\/app\/clinics\/bin/);
});

test("workspace state moves soft deleted clinics to binClinics and excludes from active clinics", () => {
  assert.match(workspaceDataSource, /clinics:\s*state\.clinics\.filter\(\(c\)\s*=>\s*!c\.deletedAt\)/);
  assert.match(workspaceDataSource, /binClinics:\s*state\.clinics\.filter/);
  assert.match(workspaceDataSource, /case "clinic\.soft_deleted"/);
  assert.match(workspaceDataSource, /case "clinic\.restored"/);
  assert.match(workspaceDataSource, /case "clinic\.permanently_deleted"/);
  assert.match(repositorySource, /softDeleteClinic/);
  assert.match(repositorySource, /restoreClinic/);
  assert.match(repositorySource, /permanentlyDeleteClinic/);
});
