import assert from "node:assert/strict";
import test from "node:test";
import { sessionIdleTimeoutMs } from "./session-timeout.ts";

test("session inactivity defaults to thirty minutes", () => {
  assert.equal(sessionIdleTimeoutMs(), 30 * 60_000);
  assert.equal(sessionIdleTimeoutMs("not-a-number"), 30 * 60_000);
});

test("session inactivity configuration stays within safe bounds", () => {
  assert.equal(sessionIdleTimeoutMs("1"), 5 * 60_000);
  assert.equal(sessionIdleTimeoutMs("45"), 45 * 60_000);
  assert.equal(sessionIdleTimeoutMs("900"), 720 * 60_000);
});
