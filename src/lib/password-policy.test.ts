import assert from "node:assert/strict";
import test from "node:test";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "./password-policy.ts";

test("hospital passwords require length and character diversity", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 12);
  assert.match(passwordPolicyError("Short1!") ?? "", /at least 12/);
  assert.match(passwordPolicyError("ALLUPPERCASE1!") ?? "", /lowercase/);
  assert.match(passwordPolicyError("alllowercase1!") ?? "", /uppercase/);
  assert.match(passwordPolicyError("NoNumbersHere!") ?? "", /number/);
  assert.match(passwordPolicyError("NoSymbolsHere1") ?? "", /symbol/);
  assert.equal(passwordPolicyError("ClinicFlow!2026"), null);
});
