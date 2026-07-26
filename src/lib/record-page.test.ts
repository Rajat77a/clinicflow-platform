import assert from "node:assert/strict";
import test from "node:test";
import { localRecordPage, normalizePageInput } from "./record-page.ts";

test("record pages clamp unsafe limits and offsets", () => {
  assert.deepEqual(normalizePageInput({ limit: 1000, offset: -5 }), {
    limit: 100,
    offset: 0,
  });
  assert.deepEqual(normalizePageInput({ limit: 0, offset: 12 }), {
    limit: 1,
    offset: 12,
  });
});

test("local record pages preserve exact totals", () => {
  assert.deepEqual(localRecordPage([1, 2, 3, 4], { limit: 2, offset: 2 }), {
    rows: [3, 4],
    total: 4,
    limit: 2,
    offset: 2,
  });
});
