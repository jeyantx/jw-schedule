import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildClmHtml, buildClmWeekHtml } from "../js/features/clmSheet.js";

const pubs = [
  { id: "p1", name: "ஜெயந்த்", gender: "brother" },
  { id: "p2", name: "மேரி", gender: "sister" },
  { id: "p3", name: "Br. தாமஸ்", gender: "brother" },   // already prefixed
];
const appWeek = {
  id: "w1", date: "2026-04-08", chairman: "p1", openingPrayer: "p3", closingPrayer: "p1",
  sections: {
    treasures: [{ no: 1, min: 10, assignee: "p1" }, { no: 2, min: 10, assignee: "p3", assistant: "p1" }, { no: 3, min: 4, assignee: "p1" }],
    apply: [{ min: 3, assignee: "p2", assistant: "p2" }, { min: 4, assignee: "p1" }, { min: 5, assignee: "p2", assistant: "p2" }],
    living: [{ min: 15, title: "உள்ளூர் தேவைகள்" }, { min: 30, assignee: "p1", cbs: true, reader: "p3" }],
  },
};
const opts = { congName: "ஊரப்பாக்கம்", month: new Date(2026, 3, 1), lang: "ta", pubs };

test("adapter: prefixes by gender, keeps existing prefix, resolves reader", () => {
  const html = buildClmHtml([appWeek], opts);
  assert.ok(html.includes("Br. ஜெயந்த்"));
  assert.ok(html.includes("Sr. மேரி"));
  assert.ok(!html.includes("Br. Br."));                 // no double prefix
  assert.ok(html.includes("Br. தாமஸ்"));                 // reader row content
});

test("adapter: treasures assistant shown in parentheses; title used when no assignee", () => {
  const html = buildClmHtml([appWeek], opts);
  assert.ok(html.includes("Br. தாமஸ் (Br. ஜெயந்த்)"));
  assert.ok(html.includes("உள்ளூர் தேவைகள்"));
});

test("adapter: cbs part → conductor + reader, not a living portion", () => {
  const html = buildClmHtml([appWeek], opts);
  assert.ok(html.includes("வாசிப்பு"));
  // only ONE pre-CBS living portion → plain 49.56px row
  assert.equal((html.match(/height:49\.56px/g) || []).length, 1);
});

test("adapter: title wording matches the reference sheet (கூட்டத்துக்கான)", () => {
  const html = buildClmHtml([appWeek], opts);
  assert.ok(html.includes("ஊரப்பாக்கம் சபையின் - நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்துக்கான அட்டவணை"));
  assert.ok(html.includes("ஏப்ரல் 2026"));
});

test("buildClmWeekHtml: fragment — no title row, no notes, one week", () => {
  const html = buildClmWeekHtml(appWeek, { lang: "ta", pubs });
  assert.ok(!html.includes('class="title"'));
  assert.ok(!html.includes('class="note"'));
  assert.ok(html.includes("ஏப்ரல் 8, 2026"));
});

test("weeks sorted by date regardless of input order", () => {
  const w2 = { ...appWeek, id: "w2", date: "2026-04-01" };
  const html = buildClmHtml([appWeek, w2], opts);
  assert.ok(html.indexOf("ஏப்ரல் 1, 2026") < html.indexOf("ஏப்ரல் 8, 2026"));
});
