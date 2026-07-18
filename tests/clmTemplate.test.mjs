import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderClmSheet, renderClmWeek, noteHi } from "../js/features/clmTemplate.js";

const week = (over = {}) => ({
  date: "ஏப்ரல் 8, 2026",
  chairman: "Br. A", openingPrayer: "Br. B", closingPrayer: "Br. A",
  treasures: [{ min: 10, text: "Br. C" }, { min: 10, text: "Br. D" }, { min: 4, text: "Br. E" }],
  ministry: [
    { min: 3, student: "Br. F", assistant: "Br. G" },
    { min: 4, student: "Sr. H", assistant: "Sr. I" },
    { min: 5, student: "Sr. J", assistant: "Sr. K" }],
  living: [{ min: 15, text: "Br. L" }],
  cbs: { min: 30, conductor: "Br. M", reader: "Br. N" },
  ...over,
});
const month = (weeks) => ({ title: "T சபையின் அட்டவணை", month: "ஏப்ரல் 2026", weeks });
const count = (s, re) => (s.match(re) || []).length;

test("quirks mode: no doctype (reference renders in quirks mode)", () => {
  assert.ok(!renderClmSheet(month([week()])).toLowerCase().includes("<!doctype"));
});

test("reference month {3,3,4,3} → 24 micro-rows of 8.55px with 8/6 rowspans", () => {
  const w3 = week({ ministry: [...week().ministry.slice(0, 2).map((m) => ({ ...m, min: 2 })),
    { min: 2, student: "Sr. X", assistant: "Sr. Y" }, { min: 5, text: "Br. Z" }] });
  const html = renderClmSheet(month([week(), week(), w3, week()]));
  assert.equal(count(html, /height:8\.55px/g), 24);
  assert.ok(html.includes('rowspan="8"'));  // 3-item weeks: 8 rows/item
  assert.ok(html.includes('rowspan="6"'));  // 4-item week: 6 rows/item
  assert.ok(html.includes('rowspan="4"'));  // pair splits 8 → 4+4
  assert.ok(html.includes('rowspan="3"'));  // pair splits 6 → 3+3
});

test("table width reproduces the reference fixed-layout stretch (×1.052469)", () => {
  const html = renderClmSheet(month([week(), week(), week(), week()]));
  const m = html.match(/width:(\d+\.\d+)px/);
  assert.ok(Math.abs(parseFloat(m[1]) - 1392.44 * (2930.80 / 2784.69)) < 0.02);
});

test("uniform living counts render as plain rows (no micro-band)", () => {
  const html = renderClmSheet(month([week(), week()]));
  assert.equal(count(html, /height:49\.56px/g), 1); // one living row shared by both weeks
});

test("section markers match the reference (divider + next-section class)", () => {
  const html = renderClmSheet(month([week()]));
  assert.ok(html.includes('class="divider treasures"'));   // opening prayer row
  assert.ok(html.includes('class="divider ministry"'));    // last treasures row
  assert.ok(html.includes('class="divider living"'));      // last ministry row
  assert.ok(html.includes("வாசிப்பு"));                     // CBS reader row
});

test("numbering continues through sections per week", () => {
  const html = renderClmSheet(month([week()]));
  // treasures 1-3, ministry 4-6, living 7, CBS 8
  assert.ok(/class="num day1"[^>]*rowspan="2">8</.test(html));
});

test("header/footer flags → single-week fragment has no title or notes", () => {
  const html = renderClmWeek(week());
  assert.ok(!html.includes('class="title"'));
  assert.ok(!html.includes('class="note"'));
});

test("notes: gap row, numbering, growth for 3 notes, noteHi escaping", () => {
  const three = renderClmSheet({ ...month([week()]), notes: ["a", "b", noteHi("<x>")] });
  assert.ok(three.includes("height:14.55px"));            // breathing gap
  assert.ok(three.includes("1. a<br><br>2. b"));
  assert.ok(three.includes(`height:${(35.55 + 88).toFixed(2)}px`)); // grown middle row
  assert.ok(three.includes("&lt;x&gt;"));                 // hi() escapes
});

test("html escaping of names/titles", () => {
  const html = renderClmSheet(month([week({ chairman: 'Br. <script>"&' })]));
  assert.ok(html.includes("Br. &lt;script&gt;&quot;&amp;"));
  assert.ok(!html.includes("<script>"));
});

test("images: bare base64 wrapped, {data,mime} honoured, urls passthrough", () => {
  const b64 = "A".repeat(240);
  const html = renderClmSheet({ ...month([week({ image: b64 })]),
    icons: { treasures: { data: "QUJD", mime: "image/jpeg" }, ministry: "resources/x.jpg" } });
  assert.ok(html.includes(`data:image/png;base64,${b64}`));
  assert.ok(html.includes("data:image/jpeg;base64,QUJD"));
  assert.ok(html.includes('src="resources/x.jpg"'));
});

test("theme: string → all-week day tint; sections override accents", () => {
  const html = renderClmSheet({ ...month([week(), week()]), theme: "rgb(1, 2, 3)" });
  assert.ok(html.includes(".day1{--day:rgb(1, 2, 3)}"));
  assert.ok(html.includes(".day2{--day:rgb(1, 2, 3)}"));
  const html2 = renderClmSheet({ ...month([week()]), theme: { sections: { treasures: "#111111" } } });
  assert.ok(html2.includes(".treasures{--sec:#111111}"));
});

test("five weeks supported; week columns extend with the reference widths", () => {
  const html = renderClmSheet(month([week(), week(), week(), week(), week()]));
  assert.equal(count(html, /class="daydate day\d"/g), 5);
  assert.ok(html.includes(".day5{--day:"));
});

test("print-fit: month is A4 landscape + zoomed to fit; table wrapped in .fit", () => {
  const html = renderClmSheet(month([week(), week(), week(), week()]));
  assert.ok(html.includes("@page{size:A4 landscape;margin:10mm}"));
  assert.ok(html.includes('<div class="fit"><table>'));
  // over-wide reference table (~1465px) must be scaled under the printable width
  assert.ok(/@media print\{\.fit\{zoom:0\.\d+\}\}/.test(html));
});

test("print-fit: single-week fragment is A4 portrait and not shrunk (zoom omitted)", () => {
  const html = renderClmWeek(week());
  assert.ok(html.includes("@page{size:A4 portrait;margin:10mm}"));
  assert.ok(!html.includes("zoom:")); // one narrow week already fits the page
});
