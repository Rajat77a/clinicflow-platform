import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const authSource = await readFile(new URL("./auth.tsx", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../routes/login.tsx", import.meta.url), "utf8");

test("invite and recovery callbacks require password setup", () => {
  assert.match(authSource, /authFlowType === "invite" \|\| authFlowType === "recovery"/);
  assert.match(authSource, /event === "PASSWORD_RECOVERY"/);
});

test("password setup opens automatically and cannot be dismissed unfinished", () => {
  assert.match(loginSource, /if \(passwordSetupRequired\) \{/);
  assert.match(loginSource, /if \(!o && passwordSetupRequired\) return;/);
  assert.match(loginSource, /onPasswordSetupComplete\(\)/);
});
