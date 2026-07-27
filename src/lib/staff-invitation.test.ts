import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(
  new URL("../../supabase/functions/invite-staff/index.ts", import.meta.url),
  "utf8",
);

test("staff invitation CORS permits every header sent by the browser client", () => {
  for (const header of [
    "authorization",
    "apikey",
    "content-type",
    "idempotency-key",
    "x-client-info",
  ]) {
    assert.match(functionSource, new RegExp(`"${header}"`));
  }
});

test("staff invitations persist contact details and select an active facility", () => {
  assert.match(functionSource, /update\(\{ display_name: fullName, email, phone:/);
  assert.match(functionSource, /\.from\("facilities"\)/);
  assert.match(functionSource, /\.eq\("active", true\)/);
});
