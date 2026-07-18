import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { portionMatrix } = await import("../js/views/portions.js");

const clm = [
  { date: "2026-07-15", sections: {
    treasures: [{ assignee: "p2" }, { assignee: "p3" }, { assignee: "p6" }], // index 2 → BR for p6
    apply: [
      { type: "SC", assignee: "p4", assistant: "p5" }, // SC.m p4, SC.a p5
      { assignee: "p6" },                               // no type → S.m p6
      { type: "MD", assignee: "p5" },                   // MD.m p5
    ],
  } },
  { date: "2026-03-11", sections: {
    treasures: [{ assignee: "p1" }, { assignee: "p2" }, { assignee: "p4" }], // BR for p4 (March)
    apply: [{ type: "FU", assignee: "p4" }],
  } },
  { date: "2025-12-10", sections: { apply: [{ type: "EB", assignee: "p4" }] } }, // different year → excluded
];

test("portionMatrix: codes, roles, month placement, year filter", () => {
  const m = portionMatrix(2026, clm);
  // p6: BR (July, idx6) + S (July) = 2 in July
  assert.equal(m.p6[6].length, 2);
  assert.deepEqual(m.p6[6].map((c) => c.code).sort(), ["BR", "S"]);
  // p4: BR (March idx2) + FU (March) + SC.m (July); 2025 EB excluded by year
  assert.deepEqual(m.p4[2].map((c) => c.code).sort(), ["BR", "FU"]);
  assert.deepEqual(m.p4[6].map((c) => c.code), ["SC"]);
  const total4 = m.p4.reduce((n, arr) => n + arr.length, 0);
  assert.equal(total4, 3); // 2025 EB not counted
  // assistant vs student role suffix
  assert.equal(m.p5[6].find((c) => c.code === "SC").role, "a");
  assert.equal(m.p4[6].find((c) => c.code === "SC").role, "m");
});

test("portionMatrix: empty when no docs match the year", () => {
  assert.deepEqual(portionMatrix(2030, clm), {});
});
