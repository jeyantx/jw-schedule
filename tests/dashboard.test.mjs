import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { store } = await import("../js/store.js");
const { pendingForMonth, resolveMemberPubId, myAssignmentsForMonth } = await import("../js/views/dashboard.js");
const { monthRangeLabel } = await import("../js/state.js");

// Meeting weekdays: clm=Wed(3) pinned explicitly (the app default is now Thu(4)),
// weekend/cleaning/attendant=Sun(0), av=Wed+Sun, fsm=Sat(6). July 2026 begins on a Wednesday.
store.docs.meta = { sheet: { midweekDay: 3 } };
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

test("resolveMemberPubId: matches nameEn, then falls back to the Tamil name", () => {
  const pubs = [
    { id: "p1", name: "ஜெயந்த்", nameEn: "Jeyanth", gender: "brother" },
    { id: "p2", name: "மேரி", nameEn: "Mary", gender: "sister" },
  ];
  assert.equal(resolveMemberPubId({ nameEn: "Jeyanth" }, pubs), "p1");
  assert.equal(resolveMemberPubId({ nameEn: "  mary " }, pubs), "p2");   // case/space-insensitive
  assert.equal(resolveMemberPubId({ nameEn: "ஜெயந்த்" }, pubs), "p1");    // English field empty → Tamil name
  assert.equal(resolveMemberPubId({ nameEn: "" }, pubs), null);
  assert.equal(resolveMemberPubId({}, pubs), null);
  assert.equal(resolveMemberPubId({ nameEn: "Nobody" }, pubs), null);
});

test("myAssignmentsForMonth: this member's assignments, this app month, sorted", () => {
  store.docs.publishers = [{ id: "p1", name: "A" }, { id: "p2", name: "B" }];
  store.docs.groups = [];
  store.docs.clm = [
    { date: "2026-07-08", chairman: "p1", sections: {} },
    { date: "2026-08-05", chairman: "p1", sections: {} },   // next month → excluded
  ];
  store.docs.weekend = [{ date: "2026-07-04", chairman: "p1" }];
  store.docs.av = [{ date: "2026-07-01", mixer: "p2" }];
  store.docs.cleaning = []; store.docs.fsm = []; store.docs.attendant = [];

  const mine = myAssignmentsForMonth("p1", new Date(2026, 6, 1));
  assert.deepEqual(mine.map((a) => a.date), ["2026-07-04", "2026-07-08"]); // July only, sorted
  assert.ok(mine.every((a) => a.pubId === "p1"));
  assert.equal(myAssignmentsForMonth("p2", new Date(2026, 6, 1)).length, 1);
  assert.equal(myAssignmentsForMonth(null, new Date(2026, 6, 1)).length, 0);
});
