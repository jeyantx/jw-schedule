import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { store } = await import("../js/store.js");
const { collectAssignments, statsFor, workload, suggestFor } = await import("../js/features/intelligence.js");

store.docs.publishers = [
  { id: "p1", name: "A", gender: "brother", roles: ["clm.chairman", "av.mixer"] },
  { id: "p2", name: "B", gender: "brother", roles: ["av.mixer"] },
];
store.docs.clm = [{ date: "2026-05-06", chairman: "p1", openingPrayer: "p2", closingPrayer: "p1",
  sections: { treasures: [{ assignee: "p1" }], apply: [{ assignee: "p1", assistant: "p2" }], living: [{ assignee: "p1", cbs: true, reader: "p2" }] } }];
store.docs.weekend = [{ date: "2026-05-10", chairman: "p1", talk: { speaker: "p2" }, wt: { conductor: "p1", reader: "p2" } }];
store.docs.av = [{ date: "2026-05-06", mixer: "p1", media: "p2", micLeft: "p2", micRight: "p1" }];
store.docs.cleaning = [{ weekOf: "2026-05-10", partA: "g1", incharge: "p1" }];
store.docs.attendant = [{ date: "2026-05-10", hall: "p1", entrance: "p2", video: "p1" }];
store.docs.fsm = [{ date: "2026-05-02", conductor: "p2" }];

test("collectAssignments covers the new AV/cleaning/attendant models", () => {
  const all = collectAssignments();
  const roles = new Set(all.map((a) => a.role));
  for (const r of ["av.mixer", "av.media", "av.mic", "cleaning.incharge", "attendant.attendant", "fsm.conductor", "clm.cbs.reader"])
    assert.ok(roles.has(r), `missing ${r}`);
});

test("statsFor: totals, partners, last date", () => {
  const s = statsFor("p1");
  assert.ok(s.total >= 7);
  assert.equal(s.lastDate, "2026-05-10");
  assert.ok(s.partners.some(([id]) => id === "p2")); // apply pair + cbs reader
});

test("workload map + average", () => {
  const w = workload();
  assert.ok(w.map.p1 > 0 && w.map.p2 > 0 && w.avg > 0);
});

test("suggestFor ranks least-recently-used qualified publisher first", () => {
  // p1 did av.mixer on 2026-05-06; p2 has no mixer assignment in that role table order
  const ranked = suggestFor("av.mixer", null);
  assert.equal(ranked[0].p.id, "p2");
});
