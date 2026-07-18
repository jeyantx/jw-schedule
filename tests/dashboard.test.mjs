import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { store } = await import("../js/store.js");
const { pendingForMonth } = await import("../js/views/dashboard.js");
const { monthRangeLabel } = await import("../js/state.js");

// Default meeting weekdays (meta empty): clm=Wed(3), weekend/cleaning/attendant=Sun(0),
// av=Wed+Sun, fsm=Sat(6). July 2026 begins on a Wednesday.
store.docs.meta = {};
store.docs.publishers = [];
store.docs.groups = [];
store.docs.clm = [{ date: "2026-07-01" }, { date: "2026-07-08" }];       // 2 of 5 Wednesdays
store.docs.weekend = [{ date: "2026-07-05" }, { date: "2026-07-06" }];   // Sun kept, Mon ignored → 1 of 4
store.docs.cleaning = [{ weekOf: "2026-07-12" }];                        // weekOf field → 1 of 4
store.docs.av = [{ date: "2026-07-01" }];                                // 1 of 9 (Wed ∪ Sun)
store.docs.fsm = [];                                                     // 0 of 4
store.docs.attendant = [];                                              // 0 of 4

test("pendingForMonth: expected vs filled per kind (July 2026)", () => {
  const by = Object.fromEntries(pendingForMonth(new Date(2026, 6, 1)).map((p) => [p.kind, p]));
  assert.deepEqual(by.clm, { kind: "clm", expected: 5, filled: 2 });
  assert.deepEqual(by.weekend, { kind: "weekend", expected: 4, filled: 1 }); // Monday record excluded
  assert.deepEqual(by.cleaning, { kind: "cleaning", expected: 4, filled: 1 }); // matches on weekOf
  assert.deepEqual(by.av, { kind: "av", expected: 9, filled: 1 }); // 5 Wed + 4 Sun, deduped
  assert.deepEqual(by.fsm, { kind: "fsm", expected: 4, filled: 0 });
  assert.deepEqual(by.attendant, { kind: "attendant", expected: 4, filled: 0 });
});

test("pendingForMonth: a month with no matching records is 0/expected", () => {
  const by = Object.fromEntries(pendingForMonth(new Date(2026, 7, 1)).map((p) => [p.kind, p]));
  assert.equal(by.clm.filled, 0);
  assert.ok(by.clm.expected > 0);
});

test("monthRangeLabel: single month when from/to share a month", () => {
  assert.equal(monthRangeLabel(new Date(2026, 6, 1), new Date(2026, 6, 26), "ta"), "ஜூலை 2026");
  assert.equal(monthRangeLabel(new Date(2026, 6, 1), new Date(2026, 6, 26), "en"), "July 2026");
});

test("monthRangeLabel: same-year range shows the year once", () => {
  assert.equal(monthRangeLabel(new Date(2026, 6, 1), new Date(2026, 7, 15), "ta"), "ஜூலை – ஆகஸ்ட் 2026");
  assert.equal(monthRangeLabel(new Date(2026, 6, 1), new Date(2026, 7, 15), "en"), "July – August 2026");
});

test("monthRangeLabel: cross-year range shows both years", () => {
  assert.equal(monthRangeLabel(new Date(2026, 11, 1), new Date(2027, 0, 10), "ta"), "டிசம்பர் 2026 – ஜனவரி 2027");
  assert.equal(monthRangeLabel(new Date(2026, 11, 1), new Date(2027, 0, 10), "en"), "December 2026 – January 2027");
});
