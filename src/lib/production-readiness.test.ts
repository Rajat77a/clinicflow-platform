import assert from "node:assert/strict";
import test from "node:test";
import { isProductionReadyPath } from "./production-readiness.ts";

test("production exposes database-backed hospital workflows", () => {
  for (const path of [
    "/app",
    "/app/patients",
    "/app/patients/new",
    "/app/appointments",
    "/app/appointments/new",
    "/app/prescriptions",
    "/app/prescriptions/new",
    "/app/billing",
    "/app/doctors",
    "/app/receptionists",
    "/app/users",
    "/app/audit-logs",
  ]) {
    assert.equal(isProductionReadyPath(path), true, `${path} should be enabled`);
  }
});

test("production blocks screens that still contain sample data or placeholder actions", () => {
  for (const path of [
    "/app/clinics/new",
    "/app/downloads",
    "/app/files",
    "/app/followups",
    "/app/notifications",
    "/app/payments",
    "/app/reports",
    "/app/settings",
    "/app/subscriptions",
    "/app/support",
  ]) {
    assert.equal(isProductionReadyPath(path), false, `${path} should be blocked`);
  }
});
