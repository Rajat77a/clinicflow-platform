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
const usersSource = await readFile(
  new URL("../routes/app.users.tsx", import.meta.url),
  "utf8",
);
const emailServiceSource = await readFile(
  new URL("./email-service.ts", import.meta.url),
  "utf8",
);
const serverSource = await readFile(
  new URL("../server.ts", import.meta.url),
  "utf8",
);

import {
  saveRegisteredAccount,
  verifyRegisteredAccount,
  deactivateClinicAccounts,
  reactivateClinicAccounts,
  deleteClinicAccounts,
} from "./account-store.ts";
import {
  generateInvitationEmailHtml,
  generateInvitationEmailText,
} from "./email-service.ts";

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

test("deletion confirmation dialogs warn that all associated users will be deleted or deactivated", () => {
  // Single clinic delete dialog
  assert.match(clinicsListSource, /Clinical Admin/);
  assert.match(clinicsListSource, /Doctors/);
  assert.match(clinicsListSource, /Receptionists/);
  assert.match(clinicsListSource, /deactivate all users associated with this clinic/);
  assert.match(clinicsListSource, /Users cannot remain assigned to a clinic that no longer exists/);

  // Bulk clinic delete dialog
  assert.match(clinicsListSource, /all associated users across all selected clinics/);

  // Edit page delete dialog
  assert.match(clinicEditSource, /deactivate all users associated with this clinic/);
  assert.match(clinicEditSource, /Users cannot remain assigned to a clinic that no longer exists/);

  // Trash bin permanent deletion dialogs
  assert.match(clinicsBinSource, /All Associated Users Will Be Permanently Removed/);
  assert.match(clinicsBinSource, /permanently erase all users associated with this clinic/);
});

test("user management table contains Assigned Clinic column and renders clinic name or Not Assigned", () => {
  assert.match(usersSource, /<TableHead>Assigned Clinic<\/TableHead>/);
  assert.match(usersSource, /Not Assigned/);
  assert.match(usersSource, /Building2/);

  // User detail profile modal includes clinic assignment
  assert.match(usersSource, /selectedProfile/);
  assert.match(usersSource, /User Profile Details/);
  assert.match(usersSource, /Assigned Clinic/);
});

test("super admin can select clinic assignment when creating or inviting users", () => {
  assert.match(usersSource, /Add \/ Invite User/);
  assert.match(usersSource, /Assigned Clinic/);
  assert.match(usersSource, /hospitalId/);
  assert.match(usersSource, /Select clinic/);
});

test("invitation email includes structured clinic details, 24-hr expiry, and activation CTA", () => {
  const emailParams = {
    recipientName: "Dr. Sarah Jenkins",
    recipientEmail: "sarah.jenkins@cityhealth.org",
    roleTitle: "Clinical Admin",
    clinicName: "City Care Clinic",
    clinicId: "clinic-city-101",
    clinicAddress: "456 Wellness Way",
    clinicCity: "San Francisco",
    clinicPhone: "+1 (555) 012-3456",
    clinicEmail: "contact@cityhealth.org",
    setupUrl: "https://clinicflow.app/setup?token=sec-token-12345",
    expiresInHours: 24,
  };

  const html = generateInvitationEmailHtml(emailParams);
  const text = generateInvitationEmailText(emailParams);

  // HTML content checks
  assert.ok(html.includes("City Care Clinic"), "HTML should include clinic name");
  assert.ok(html.includes("clinic-city-101"), "HTML should include clinic ID");
  assert.ok(html.includes("456 Wellness Way"), "HTML should include clinic address");
  assert.ok(html.includes("San Francisco"), "HTML should include clinic city");
  assert.ok(html.includes("+1 (555) 012-3456"), "HTML should include clinic phone");
  assert.ok(html.includes("Dr. Sarah Jenkins"), "HTML should include recipient name");
  assert.ok(html.includes("sarah.jenkins@cityhealth.org"), "HTML should include recipient email");
  assert.ok(html.includes("Create Password &amp; Activate Account") || html.includes("Create Password & Activate Account"), "HTML should include CTA button");
  assert.ok(html.includes("24 hours"), "HTML should specify 24 hour expiry");

  // Text content checks
  assert.ok(text.includes("City Care Clinic"), "Text should include clinic name");
  assert.ok(text.includes("456 Wellness Way"), "Text should include clinic address");
  assert.ok(text.includes("San Francisco"), "Text should include clinic city");
  assert.ok(text.includes("+1 (555) 012-3456"), "Text should include clinic phone");
  assert.ok(text.includes("24 hours"), "Text should specify 24 hour expiry");
  assert.ok(text.includes("Create Password & Activate Account"), "Text should include CTA label");
});

test("deleting clinic deactivates all associated user accounts and prevents login", () => {
  const clinicAId = "clinic-alpha-999";
  const clinicBId = "clinic-beta-888";

  // Register users for Clinic A
  saveRegisteredAccount({
    email: "admin.alpha@test.com",
    password: "Password123!",
    name: "Alpha Admin",
    role: "clinic_admin",
    clinicId: clinicAId,
    clinicName: "Alpha Clinic",
  });
  saveRegisteredAccount({
    email: "doctor.alpha@test.com",
    password: "Password123!",
    name: "Dr. Alpha",
    role: "doctor",
    clinicId: clinicAId,
    clinicName: "Alpha Clinic",
  });

  // Register user for Clinic B
  saveRegisteredAccount({
    email: "doctor.beta@test.com",
    password: "Password123!",
    name: "Dr. Beta",
    role: "doctor",
    clinicId: clinicBId,
    clinicName: "Beta Clinic",
  });

  // Initial verification: all accounts are active and can verify
  assert.ok(verifyRegisteredAccount("admin.alpha@test.com", "Password123!"));
  assert.ok(verifyRegisteredAccount("doctor.alpha@test.com", "Password123!"));
  assert.ok(verifyRegisteredAccount("doctor.beta@test.com", "Password123!"));

  // Super Admin deletes Clinic A -> deactivate all Clinic A accounts
  deactivateClinicAccounts(clinicAId);

  // Clinic A users can no longer log in
  assert.equal(verifyRegisteredAccount("admin.alpha@test.com", "Password123!"), null);
  assert.equal(verifyRegisteredAccount("doctor.alpha@test.com", "Password123!"), null);

  // Clinic B user is unaffected and can still log in
  assert.ok(verifyRegisteredAccount("doctor.beta@test.com", "Password123!"));

  // Super Admin restores Clinic A -> reactivate accounts
  reactivateClinicAccounts(clinicAId);
  assert.ok(verifyRegisteredAccount("admin.alpha@test.com", "Password123!"));
  assert.ok(verifyRegisteredAccount("doctor.alpha@test.com", "Password123!"));

  // Super Admin permanently deletes Clinic A -> delete accounts
  deleteClinicAccounts(clinicAId);
  assert.equal(verifyRegisteredAccount("admin.alpha@test.com", "Password123!"), null);
});

test("trash bin contains separate Clinics and Users tabs with required columns", () => {
  // Tabs separation
  assert.match(clinicsBinSource, /<Tabs defaultValue="clinics"/);
  assert.match(clinicsBinSource, /<TabsTrigger value="clinics"/);
  assert.match(clinicsBinSource, /<TabsTrigger value="users"/);
  assert.match(clinicsBinSource, /<TabsContent value="clinics"/);
  assert.match(clinicsBinSource, /<TabsContent value="users"/);

  // Users tab columns
  assert.match(clinicsBinSource, /<TableHead>Name<\/TableHead>/);
  assert.match(clinicsBinSource, /<TableHead>Email<\/TableHead>/);
  assert.match(clinicsBinSource, /<TableHead>Role<\/TableHead>/);
  assert.match(clinicsBinSource, /<TableHead>Previously Assigned Clinic<\/TableHead>/);
  assert.match(clinicsBinSource, /<TableHead>Deleted Date<\/TableHead>/);
  assert.match(clinicsBinSource, /<TableHead>Deleted By<\/TableHead>/);

  // User restore and permanent deletion actions
  assert.match(clinicsBinSource, /restoreStaff/);
  assert.match(clinicsBinSource, /permanentlyDeleteStaff/);
  assert.match(clinicsBinSource, /Restore User/);
  assert.match(clinicsBinSource, /Permanent Deletion Warning/);
  assert.match(clinicsBinSource, /This action cannot be undone\. Permanently delete this record\?/);
});

test("user management provides Resend Invitation and Delete User to Trash", () => {
  // Resend invitation
  assert.match(usersSource, /Resend Invitation/);
  assert.match(usersSource, /resendStaffInvitation/);
  assert.match(usersSource, /Invitation sent successfully to/);

  // Delete user to trash dialog
  assert.match(usersSource, /Delete User\?/);
  assert.match(usersSource, /This user will be moved to Trash and will no longer be active\./);
  assert.match(usersSource, /Move to Trash/);
  assert.match(usersSource, /softDeleteStaff/);
});

test("invitation setup page provides branded welcome, password activation, and login redirection", () => {
  assert.match(setupSource, /You're invited to ClinicFlow/);
  assert.match(setupSource, /Create Password & Activate Account/);
  assert.match(setupSource, /Your account has been activated successfully\./);
  assert.match(setupSource, /Go to Login/);
  assert.match(setupSource, /to="\/login"[\s\S]*?email:\s*tokenInfo\.email/);
});

test("server strictly rejects email dispatch when RESEND_API_KEY is not configured", () => {
  assert.match(serverSource, /Email service is not configured\./);
  assert.match(serverSource, /status:\s*503/);
  assert.doesNotMatch(serverSource, /Live delivery simulated/);
  assert.match(serverSource, /https:\/\/api\.resend\.com\/emails/);
  assert.match(serverSource, /Authorization`?:\s*`?Bearer/);
});

test("server normalizes setup URL to prevent localhost links in emails", () => {
  assert.match(serverSource, /isLocal/);
  assert.match(serverSource, /APP_URL/);
  assert.match(serverSource, /finalSetupUrl/);
});

test("frontend email service awaits real server response and surfaces delivery failures", () => {
  assert.match(emailServiceSource, /fetch\("\/api\/send-email"/);
  assert.match(emailServiceSource, /getAppBaseUrl/);
  assert.match(emailServiceSource, /throw new Error/);
});

test("clinic creation only confirms delivery when Resend succeeds and alerts if delivery fails", () => {
  assert.match(newClinicSource, /clinic\.emailSent/);
  assert.match(newClinicSource, /clinic\.emailError/);
  assert.match(newClinicSource, /Invitation email sent successfully/);
  assert.match(newClinicSource, /Email service alert/);
  assert.match(workspaceDataSource, /getAppBaseUrl/);
});



