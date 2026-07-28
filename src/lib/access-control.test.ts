import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessLocation,
  canAccessPath,
  hasPermission,
  permissionForLocation,
  permissionForPath,
  rolesForPermission,
} from "./access-control.ts";

test("each portal can reach its own operational routes", () => {
  assert.equal(canAccessPath("super_admin", "/app/clinics"), true);
  assert.equal(canAccessPath("super_admin", "/app/users"), true);
  assert.equal(canAccessPath("clinic_admin", "/app/doctors"), true);
  assert.equal(canAccessPath("doctor", "/app/followups"), true);
  assert.equal(canAccessPath("receptionist", "/app/billing/new"), true);
});

test("super administrators can perform the staff invite operation", () => {
  assert.equal(hasPermission("super_admin", "users.manage"), true);
  assert.equal(hasPermission("super_admin", "people.manage"), true);
});

test("platform administrators cannot open clinical records", () => {
  assert.equal(canAccessPath("super_admin", "/app/patients"), false);
  assert.equal(canAccessPath("super_admin", "/app/patients/PT-10293"), false);
  assert.equal(canAccessPath("super_admin", "/app/prescriptions"), false);
  assert.equal(canAccessPath("super_admin", "/app/billing"), false);
});

test("clinic roles cannot enter platform controls", () => {
  for (const role of ["clinic_admin", "doctor", "receptionist"] as const) {
    assert.equal(canAccessPath(role, "/app/clinics"), false);
    assert.equal(canAccessPath(role, "/app/payments"), false);
    assert.equal(canAccessPath(role, "/app/subscriptions"), false);
  }
});

test("clinical duties remain separated by permission", () => {
  assert.equal(hasPermission("doctor", "prescriptions.write"), true);
  assert.equal(hasPermission("receptionist", "prescriptions.write"), false);
  assert.equal(hasPermission("receptionist", "prescriptions.read"), false);
  assert.equal(hasPermission("receptionist", "labs.write"), false);
  assert.equal(hasPermission("clinic_admin", "prescriptions.write"), false);
  assert.equal(hasPermission("doctor", "billing.read"), false);
  assert.equal(hasPermission("receptionist", "billing.write"), true);
  assert.equal(hasPermission("clinic_admin", "people.manage"), true);
});

test("lab entry uses lab permissions without granting prescription access", () => {
  const labSearch = { mode: "lab", patient: "PT-10293" };

  assert.equal(permissionForLocation("/app/prescriptions/new", labSearch), "labs.write");
  assert.equal(canAccessLocation("clinic_admin", "/app/prescriptions/new", labSearch), true);
  assert.equal(canAccessLocation("doctor", "/app/prescriptions/new", labSearch), true);
  assert.equal(canAccessLocation("receptionist", "/app/prescriptions/new", labSearch), false);
  assert.equal(canAccessLocation("super_admin", "/app/prescriptions/new", labSearch), false);
  assert.equal(canAccessLocation("clinic_admin", "/app/prescriptions/new"), false);
  assert.equal(canAccessLocation("doctor", "/app/prescriptions/new"), true);
});

test("route matching covers nested records and creation screens", () => {
  assert.equal(permissionForPath("/app/patients/PT-10293"), "patients.read");
  assert.equal(permissionForPath("/app/patients/new"), "patients.create");
  assert.equal(permissionForPath("/app/appointments/new"), "appointments.create");
  assert.equal(permissionForPath("/app/prescriptions/new"), "prescriptions.write");
  assert.equal(permissionForPath("/app/clinics/new"), "platform.clinics.manage");
  assert.equal(permissionForPath("/app"), null);
  assert.equal(canAccessPath("super_admin", "/app/unregistered-future-route"), false);
});

test("every protected permission has at least one owning role", () => {
  const paths = [
    "/app/clinics",
    "/app/subscriptions",
    "/app/payments",
    "/app/doctors",
    "/app/receptionists",
    "/app/users",
    "/app/patients",
    "/app/patients/new",
    "/app/appointments",
    "/app/appointments/new",
    "/app/prescriptions",
    "/app/prescriptions/new",
    "/app/billing",
    "/app/files",
    "/app/reports",
    "/app/audit-logs",
    "/app/downloads",
    "/app/followups",
    "/app/settings",
    "/app/support",
    "/app/notifications",
  ];

  for (const path of paths) {
    const permission = permissionForPath(path);
    assert.ok(permission, `${path} should be protected`);
    assert.ok(rolesForPermission(permission).length > 0, `${permission} needs an owning role`);
  }
});
