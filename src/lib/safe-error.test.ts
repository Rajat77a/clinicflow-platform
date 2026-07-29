import assert from "node:assert/strict";
import test from "node:test";
import { SafeBackendError, toSafeBackendError } from "./backend/safe-error.ts";

test("backend errors map database details to safe operation messages", () => {
  const unique = toSafeBackendError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "patients_hospital_mrn_key"',
  });
  const denied = toSafeBackendError({
    code: "42501",
    message: "permission denied for table profiles",
  });

  assert.equal(unique.code, "conflict");
  assert.equal(unique.message, "This record changed or conflicts with an existing record");
  assert.equal(denied.code, "access_denied");
  assert.equal(denied.message, "You do not have permission to perform this operation");
  assert.doesNotMatch(unique.message, /constraint|patients_hospital/i);
});

test("explicitly allowlisted workflow guidance remains visible", () => {
  const error = toSafeBackendError(
    new Error("Signed prescriptions are immutable; create a replacement prescription"),
  );

  assert.ok(error instanceof SafeBackendError);
  assert.equal(
    error.message,
    "Signed prescriptions are immutable; create a replacement prescription",
  );
});
