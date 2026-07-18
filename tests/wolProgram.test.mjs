// Intelligent pre-fill: workbook week-doc parsing (en + ta editions), month-page
// week/doc extraction, and the pure never-overwrite helper. Fixtures under
// tests/fixtures/ are trimmed copies of live wol.jw.org pages (July 2026 +
// March–April 2026 including the Memorial gap).
import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const {
  parseWeekProgram, isMemorialPage, parseMonthWeeks, matchWeek,
  pendingWeekDates, tamilDocPath, workbookMonthPath,
} = await import("../js/features/wol.js");

const fx = (name) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf8");
const EN16 = fx("clm-week-en-jeremiah16.html");   // July 13-19: SC/FU/MD week
const EN18 = fx("clm-week-en-jeremiah18.html");   // July 20-26: SC/FU/EB week
const TA16 = fx("clm-week-ta-jeremiah16.html");   // Tamil edition of July 13-19
const MEMORIAL = fx("clm-week-en-memorial.html"); // Memorial reading schedule (no meeting)
const MONTH = fx("clm-month-en-march.html");      // March–April 2026 cover page

test("parseWeekProgram (en): section part counts + week range + songs", () => {
  const p = parseWeekProgram(EN16);
  assert.ok(p, "meeting page must parse");
  assert.equal(p.weekRange, "July 13-19");
  assert.equal(p.treasures.length, 3);
  assert.equal(p.apply.length, 3);
  assert.equal(p.living.length, 2);
  assert.deepEqual(p.songs, [54, 22]); // fixture trims the pre-treasures opening song
});

test("parseWeekProgram (en): durations from '(N min.)'", () => {
  const p = parseWeekProgram(EN16);
  assert.deepEqual(p.treasures.map((x) => x.min), [10, 10, 4]);
  assert.deepEqual(p.apply.map((x) => x.min), [3, 4, 5]);
  assert.deepEqual(p.living.map((x) => x.min), [15, 30]);
});

test("parseWeekProgram (en): treasures kinds — talk, gems, reading — with titles", () => {
  const p = parseWeekProgram(EN16);
  assert.deepEqual(p.treasures.map((x) => x.kind), ["talk", "gems", "reading"]);
  assert.equal(p.treasures[0].title, "It Matters Whom We Trust"); // real opening-talk theme
  assert.equal(p.treasures[1].title, "Spiritual Gems");
  assert.equal(p.treasures[2].title, "Bible Reading");
});

test("parseWeekProgram (en): ministry part kinds → SC/FU/MD and EB type codes", () => {
  assert.deepEqual(parseWeekProgram(EN16).apply.map((x) => x.type), ["SC", "FU", "MD"]);
  assert.deepEqual(parseWeekProgram(EN18).apply.map((x) => x.type), ["SC", "FU", "EB"]);
});

test("parseWeekProgram (en): CBS detected on the last living part only", () => {
  const p = parseWeekProgram(EN16);
  assert.deepEqual(p.living.map((x) => x.cbs), [false, true]);
  assert.equal(p.living[1].title, "Congregation Bible Study");
});

test("parseWeekProgram (ta): same doc id parses in Tamil — counts, types, CBS, range", () => {
  const p = parseWeekProgram(TA16);
  assert.ok(p, "Tamil meeting page must parse");
  assert.equal(p.weekRange, "ஜூலை 13-19");
  assert.equal(p.treasures.length, 3);
  assert.deepEqual(p.treasures.map((x) => x.kind), ["talk", "gems", "reading"]); // தோண்டி எடுங்கள் / பைபிள் வாசிப்பு
  assert.deepEqual(p.apply.map((x) => x.type), ["SC", "FU", "MD"]);              // பேச ஆரம்பிப்பது / மறுபடியும் சந்திப்பது / சீஷர்களை உருவாக்குவது
  assert.deepEqual(p.apply.map((x) => x.min), [3, 4, 5]);                        // "(3 நிமி.)" durations
  assert.deepEqual(p.living.map((x) => x.cbs), [false, true]);                   // சபை பைபிள் படிப்பு
  assert.deepEqual(p.songs, [54, 22]);                                            // பாட்டு 54 / 22
});

test("parseWeekProgram: Memorial schedule page is NOT a meeting → null + flagged", () => {
  assert.equal(parseWeekProgram(MEMORIAL), null);
  assert.ok(isMemorialPage(MEMORIAL));
  assert.ok(!isMemorialPage(EN16));
});

test("parseMonthWeeks: week ranges + doc hrefs + thumbnails; Memorial week absent", () => {
  const weeks = parseMonthWeeks(MONTH, new Date(2026, 2, 1));
  assert.equal(weeks.length, 8); // 4 March + 4 April meeting weeks (Memorial week Mar 30–Apr 5 has no doc)
  assert.deepEqual(weeks.map((w) => w.start),
    ["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23",
     "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"]);
  assert.equal(weeks[0].docPath, "/en/wol/d/r1/lp-e/202026081");
  assert.equal(weeks[7].range, "April 27–May 3"); // cross-month en-dash range
  assert.ok(weeks.every((w) => /^https:\/\/wol\.jw\.org\//.test(w.img)));
});

test("matchWeek: date inside a Mon–Sun window hits; Memorial gap misses", () => {
  const weeks = parseMonthWeeks(MONTH, new Date(2026, 2, 1));
  assert.equal(matchWeek(weeks, "2026-04-08").range, "April 6-12");
  assert.equal(matchWeek(weeks, "2026-04-29").range, "April 27–May 3");
  assert.equal(matchWeek(weeks, "2026-04-01"), null); // Memorial week — no midweek meeting
});

test("pendingWeekDates: skips existing weeks (never overwrite), dedupes, sorts", () => {
  assert.deepEqual(
    pendingWeekDates(["2026-07-01", "2026-07-15"],
      ["2026-07-22", "2026-07-01", "2026-07-08", "2026-07-15", "2026-07-08"]),
    ["2026-07-08", "2026-07-22"]);
  assert.deepEqual(pendingWeekDates([], []), []);
});

test("tamilDocPath: en week doc → aligned r122/lp-tl Tamil edition path", () => {
  assert.equal(tamilDocPath("/en/wol/d/r1/lp-e/202026242"), "ta/wol/d/r122/lp-tl/202026242");
  assert.equal(tamilDocPath("en/wol/d/r1/lp-e/202026242"), "ta/wol/d/r122/lp-tl/202026242");
  // non-workbook paths pass through untouched
  assert.equal(tamilDocPath("en/wol/library/r1/lp-e/x"), "en/wol/library/r1/lp-e/x");
});

test("workbookMonthPath: bimonthly cover month — Aug→july page, Apr→march page", () => {
  assert.match(workbookMonthPath(new Date(2026, 7, 12), "en"), /2026\/july$/);
  assert.match(workbookMonthPath(new Date(2026, 3, 8), "en"), /2026\/march$/);
  assert.match(workbookMonthPath(new Date(2026, 6, 1), "en"), /2026\/july$/); // cover month unchanged
});
