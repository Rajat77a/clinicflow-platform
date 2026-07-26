import assert from "node:assert/strict";
import test from "node:test";
import { localDateKey, localStartOfWeek } from "./calendar.ts";

test("local date keys use calendar fields instead of UTC conversion", () => {
  const nearMidnight = new Date(2026, 6, 27, 0, 30);
  assert.equal(localDateKey(nearMidnight), "2026-07-27");
});

test("local weeks begin on Monday at local midnight", () => {
  const wednesday = new Date(2026, 6, 29, 17, 45);
  const monday = localStartOfWeek(wednesday);
  assert.equal(localDateKey(monday), "2026-07-27");
  assert.equal(monday.getHours(), 0);
  assert.equal(monday.getMinutes(), 0);
});
