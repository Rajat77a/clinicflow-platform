import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repository = await readFile(new URL("./supabase/workspace-repository.ts", import.meta.url), "utf8");
const subscriptions = await readFile(new URL("../routes/app.subscriptions.tsx", import.meta.url), "utf8");
const clinics = await readFile(new URL("../routes/app.clinics.index.tsx", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../../supabase/migrations/20260806100000_platform_control_plane.sql", import.meta.url),
  "utf8",
);

test("platform clinic mutations use authorized RPCs instead of direct table writes", () => {
  assert.doesNotMatch(repository, /from\("hospitals"\)\s*\.(?:insert|delete)/);
  assert.match(repository, /rpc\("create_platform_clinic"/);
  assert.match(repository, /rpc\("set_platform_clinic_access"/);
  assert.match(repository, /rpc\("extend_platform_subscription"/);
});

test("subscription and clinic controls wait for persisted operations", () => {
  assert.match(subscriptions, /await onExtend\(/);
  assert.match(clinics, /await setClinicAccess\(/);
});

test("platform operations require an administrator and write audit history", () => {
  assert.match(migration, /private\.is_platform_admin\(\)/);
  assert.match(migration, /hospital_subscription_events/);
  assert.match(migration, /subscription\.extended/);
  assert.match(migration, /clinic\.created/);
  assert.match(migration, /security definer/);
});
