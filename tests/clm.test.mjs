import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { isoWeekKey, sameIsoWeek } = await import("../js/views/clm.js");

// The Issue-2 root cause: after the midweek default moved Wed→Thu, a saved Wed
// week (July 1 2026) and the generated Thu ghost (July 2 2026) are the SAME
// calendar week — the ghost must be suppressed so it can't leave an undeletable card.
test("isoWeekKey: every day maps to its Monday (Mon–Sun weeks)", () => {
  assert.equal(isoWeekKey("2026-07-01"), "2026-06-29"); // Wed → Mon Jun 29
  assert.equal(isoWeekKey("2026-07-02"), "2026-06-29"); // Thu → same Monday
  assert.equal(isoWeekKey("2026-06-29"), "2026-06-29"); // Monday itself
  assert.equal(isoWeekKey("2026-07-05"), "2026-06-29"); // Sunday → still that week
});

test("sameIsoWeek: Wed Jul 1 and Thu Jul 2 2026 are the same week", () => {
  assert.equal(sameIsoWeek("2026-07-01", "2026-07-02"), true);
});

test("sameIsoWeek: Sun/Mon boundary splits weeks", () => {
  assert.equal(sameIsoWeek("2026-07-05", "2026-07-06"), false); // Sun vs next Mon → different
  assert.equal(sameIsoWeek("2026-06-29", "2026-07-05"), true);  // Mon..Sun of one week → same
});

test("sameIsoWeek: different weeks and empty inputs", () => {
  assert.equal(sameIsoWeek("2026-07-01", "2026-07-08"), false); // a week apart
  assert.equal(sameIsoWeek("", "2026-07-01"), false);
  assert.equal(sameIsoWeek(undefined, "2026-07-01"), false);
});
