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
const newClinicSource = await readFile(
  new URL("../routes/app.clinics.new.tsx", import.meta.url),
  "utf8",
);
const setupSource = await readFile(
  new URL("../routes/setup.tsx", import.meta.url),
  "utf8",
);
const authSource = await readFile(
  new URL("./auth.tsx", import.meta.url),
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

test("clinics list includes select all and bulk delete to trash", () => {
  assert.match(clinicsListSource, /bulkSoftDeleteClinics/);
  assert.match(clinicsListSource, /toggleSelectAll/);
  assert.match(clinicsListSource, /Move Selected to Trash/);
  assert.match(clinicsListSource, /aria-label="Select all clinics"/);
  assert.match(workspaceDataSource, /bulkSoftDeleteClinics:\s*async/);
});

test("trash bin provides empty trash and delete all from trash", () => {
  assert.match(clinicsBinSource, /emptyTrash/);
  assert.match(clinicsBinSource, /Empty Trash/);
  assert.match(clinicsBinSource, /Delete All from Trash/);
  assert.match(clinicsBinSource, /aria-label="Select all clinics in trash"/);
  assert.match(clinicsBinSource, /bulkPermanentlyDeleteClinics/);
  assert.match(workspaceDataSource, /emptyTrash:\s*async/);
});

test("clinical admin invitation email is generated with 24-hour setup link", () => {
  assert.match(workspaceDataSource, /sendInvitationEmail\(\{[\s\S]*?expiresInHours:\s*24/);
  assert.match(workspaceDataSource, /registerLocalInviteToken/);
});

test("clinic edit pre-populates existing clinic and clinical admin details", () => {
  assert.match(clinicEditSource, /adminStaff/);
  assert.match(clinicEditSource, /clinic\?\.adminName\s*\?\?\s*adminStaff\?\.name/);
  assert.match(clinicEditSource, /clinic\?\.email/);
  assert.match(clinicEditSource, /clinic\?\.phone/);
  assert.match(clinicEditSource, /clinic\?\.address/);
});

test("new clinic creation offers direct email dispatch via mailto and webmail", () => {
  assert.match(newClinicSource, /Send via Email Client/);
  assert.match(newClinicSource, /Open in Gmail/);
  assert.match(newClinicSource, /Copy Email Text/);
  assert.match(newClinicSource, /generateMailtoUrl/);
  assert.match(newClinicSource, /generateGmailComposeUrl/);
});

test("clinical admin password setup registers credentials and auth supports verified login", () => {
  assert.match(setupSource, /saveRegisteredAccount/);
  assert.match(setupSource, /markLocalInviteTokenUsed/);
  assert.match(authSource, /verifyRegisteredAccount/);
  assert.match(authSource, /login:\s*async\s*\(email,\s*password\)/);
});

