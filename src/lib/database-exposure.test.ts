import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationSource = await readFile(
  new URL("../../supabase/migrations/20260728213000_reduce_function_exposure.sql", import.meta.url),
  "utf8",
);

test("legacy and trigger-helper functions are not browser-callable", () => {
  assert.match(
    migrationSource,
    /revoke all on function public\.list_active_doctors\(\)[\s\S]*from public, anon, authenticated;/,
  );
  assert.match(
    migrationSource,
    /revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/,
  );
});
