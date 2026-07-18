import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { workbookMonthPath, parseWeekImages, matchWeekImage, WEEK_RANGE_RE } = await import("../js/features/wol.js");

test("workbookMonthPath: month lowercase, workbook year = date year", () => {
  assert.equal(
    workbookMonthPath(new Date(2026, 6, 1), "en"),
    "en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-2026/july");
  assert.equal(
    workbookMonthPath(new Date(2027, 0, 15), "en"),
    "en/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-2027/january");
});

test("WEEK_RANGE_RE matches hyphen + en-dash + cross-month ranges", () => {
  const re = new RegExp(WEEK_RANGE_RE.source);
  assert.ok(re.test("July 6-12"));
  assert.ok(re.test("June 29–July 5"));
  assert.ok(!re.test("Just some prose without a range"));
});

// Small fixture mirroring the workbook month page: each week is an item with a
// thumbnail <img> (relative or absolute) and a range label.
const FIXTURE = `
<div class="publications">
  <li class="card"><img src="/mediaitems/w0.jpg"><a>June 29–July 5</a></li>
  <li class="card"><img src="https://wol.jw.org/mediaitems/w1.jpg"><a>July 6-12</a></li>
  <li class="card"><img src="/mediaitems/w2.jpg"><a>July 13-19</a></li>
  <li class="card"><img src="/mediaitems/w3.jpg"><a>July 20-26</a></li>
  <li class="card"><img src="/mediaitems/w4.jpg"><a>July 27–August 2</a></li>
  <li class="card"><a>No image here — skipped week label ignored 99</a></li>
</div>`;

test("parseWeekImages: ≥4 weeks, Monday ISO starts, absolute image URLs", () => {
  const weeks = parseWeekImages(FIXTURE, new Date(2026, 6, 1));
  assert.ok(weeks.length >= 4, `expected >=4 weeks, got ${weeks.length}`);
  assert.deepEqual(weeks.map((w) => w.start),
    ["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27"]);
  // relative src resolved against wol.jw.org; absolute src kept as-is
  assert.equal(weeks[0].img, "https://wol.jw.org/mediaitems/w0.jpg");
  assert.equal(weeks[1].img, "https://wol.jw.org/mediaitems/w1.jpg");
  assert.ok(weeks.every((w) => /^https:\/\/wol\.jw\.org\//.test(w.img)));
});

test("matchWeekImage: CLM date falls inside the Mon–Sun window", () => {
  const weeks = parseWeekImages(FIXTURE, new Date(2026, 6, 1));
  // 2026-07-15 (a Wednesday) is inside the July 13-19 week
  assert.equal(matchWeekImage(weeks, "2026-07-15"), "https://wol.jw.org/mediaitems/w2.jpg");
  // 2026-07-01 is inside June 29–July 5
  assert.equal(matchWeekImage(weeks, "2026-07-01"), "https://wol.jw.org/mediaitems/w0.jpg");
  // outside every window → null
  assert.equal(matchWeekImage(weeks, "2026-09-01"), null);
});
