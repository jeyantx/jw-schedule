import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { store } = await import("../js/store.js");
const { kindFields, kindMeta, roleBoardHtml, fsmBoardHtml, weekendBoardHtml, weeklyCardHtml, displayName, pubLabel, groupLabel, sheetPrefs, boardTheme, contentLangFor } =
  await import("../js/features/boards.js");
const { THEMES } = await import("../js/features/boardTemplate.js");
const { getContentLang } = await import("../js/i18n.js");

store.docs.publishers = [
  { id: "p1", name: "ஜெயந்த்", nameEn: "Jeyanth", gender: "brother" },
  { id: "p2", name: "மேரி", gender: "sister" },
];
store.docs.groups = [{ id: "g1", name: "மகாலட்சுமி நகர்" }, { id: "g2", name: "ஆதனூர்" }];
store.docs.meta = {};

test("displayName: gender prefix, free text passthrough, empty", () => {
  assert.equal(displayName("p1"), "Br. ஜெயந்த்");
  assert.equal(displayName("p2"), "Sr. மேரி");
  assert.equal(displayName("Visiting Bro"), "Visiting Bro");
  assert.equal(displayName(null), "");
});

test("displayName / pubLabel: bilingual names follow the language", () => {
  const pubs = [
    { id: "b1", name: "ஜெயந்த்", nameEn: "Jeyanth", gender: "brother" },
    { id: "s1", name: "மேரி", gender: "sister" }, // no nameEn → falls back
  ];
  // English UI prefers nameEn, keeps the Br./Sr. prefix
  assert.equal(displayName("b1", pubs, "en"), "Br. Jeyanth");
  assert.equal(displayName("b1", pubs, "ta"), "Br. ஜெயந்த்");
  // fallback: English UI but no nameEn → Tamil name still resolves
  assert.equal(displayName("s1", pubs, "en"), "Sr. மேரி");
  // raw labels, no prefix
  assert.equal(pubLabel(pubs[0], "en"), "Jeyanth");
  assert.equal(pubLabel(pubs[0], "ta"), "ஜெயந்த்");
  assert.equal(pubLabel(pubs[1], "en"), "மேரி");
  // groupLabel mirrors the same preference
  const g = { id: "g", name: "மகாலட்சுமி நகர்", nameEn: "Mahalakshmi Nagar" };
  assert.equal(groupLabel(g, "en"), "Mahalakshmi Nagar");
  assert.equal(groupLabel(g, "ta"), "மகாலட்சுமி நகர்");
});

test("kindFields: cleaning formats produce the 4 layouts", () => {
  const keys = (f) => kindFields("cleaning", { cleaningFormat: f }).map((x) => x.key);
  assert.deepEqual(keys("group"), ["partA"]);
  assert.deepEqual(keys("group-incharge"), ["partA", "incharge"]);
  assert.deepEqual(keys("parts"), ["partA", "partB"]);
  assert.deepEqual(keys("parts-incharge"), ["partA", "partB", "incharge"]);
});

test("kindFields: custom part labels + attendant 2/3 formats", () => {
  const f = kindFields("cleaning", { cleaningFormat: "parts", cleaningPartA: "என் பகுதி" });
  assert.equal(f[0].label, "என் பகுதி");
  assert.equal(kindFields("attendant", { attendantFormat: "2" }).length, 2);
  assert.equal(kindFields("attendant", { attendantFormat: "3" }).length, 3);
});

test("sheetPrefs: defaults + meta.sheet overrides; boardTheme merges custom colours", () => {
  store.docs.meta = {};
  assert.equal(sheetPrefs().theme, "light-1");
  store.docs.meta = { sheet: { theme: "light-2", custom: { accents: { av: "#123456" } } } };
  assert.equal(sheetPrefs().theme, "light-2");
  const T = boardTheme();
  assert.equal(T.accents.av, "#123456");
  assert.equal(T.accents.cleaning, THEMES["light-2"].accents.cleaning);
  store.docs.meta = {};
});

test("roleBoardHtml (av): labels, resolved names, sorted dates", () => {
  const html = roleBoardHtml("av", [
    { date: "2026-05-13", mixer: "p1", media: "p2", micLeft: "p1", micRight: "p1" },
    { date: "2026-05-06", mixer: "p2", media: "p1", micLeft: "p2", micRight: "p1" },
  ], { congName: "ஊரப்பாக்கம்", month: "மே 2026" });
  assert.ok(html.includes("ஆடியோ மிக்சர்"));
  assert.ok(html.includes("Sr. மேரி"));
  assert.ok(html.indexOf("மே 6") < html.indexOf("மே 13"));
});

test("roleBoardHtml (cleaning): group names via store; format from meta", () => {
  store.docs.meta = { sheet: { cleaningFormat: "parts-incharge" } };
  const html = roleBoardHtml("cleaning", [{ weekOf: "2026-05-10", partA: "g1", partB: "g2", incharge: "p1" }], {});
  assert.ok(html.includes("மகாலட்சுமி நகர்"));
  assert.ok(html.includes("ஆதனூர்"));
  assert.ok(html.includes("Br. ஜெயந்த்"));
  assert.ok(html.includes("பொறுப்பாளர்"));
  store.docs.meta = {};
});

test("fsmBoardHtml: zoom shown as hint under location", () => {
  const html = fsmBoardHtml([{ date: "2026-05-02", time: "காலை 7:30", loc: "ராஜ்ய மண்டபம்", zoom: true, field: "பகுதி 12", conductor: "p1" }], {});
  assert.ok(html.includes("+ Zoom"));
  assert.ok(html.includes("பகுதி 12"));
});

test("weekendBoardHtml: badge number + speaker congregation hint", () => {
  const html = weekendBoardHtml([{ date: "2026-05-03", chairman: "p1",
    talk: { number: 12, theme: "தலைப்பு", speaker: "Br. வெளியூர்", speakerCong: "வேளச்சேரி" }, wt: { conductor: "p1", reader: "p2" } }], {});
  assert.ok(html.includes('<span class="no">12</span>'));
  assert.ok(html.includes("வேளச்சேரி"));
  assert.ok(html.includes("Br. வெளியூர்"));
});

test("weeklyCardHtml: attendant format respected; empty fields dropped", () => {
  store.docs.meta = { sheet: { attendantFormat: "3" } };
  const html = weeklyCardHtml("attendant", { date: "2026-05-06", hall: "p1", entrance: "", video: "p2" });
  assert.ok(html.includes("Br. ஜெயந்த்"));
  assert.ok(html.includes("Sr. மேரி"));
  assert.ok(!html.includes("நுழைவாயில்")); // empty → dropped
  store.docs.meta = {};
});

test("kindMeta covers every schedule", () => {
  for (const k of ["av", "cleaning", "attendant", "fsm", "weekend"]) {
    assert.ok(kindMeta(k).title, k);
    assert.ok(kindMeta(k).icon, k);
  }
});

test("kindMeetingDays: defaults + meta.sheet overrides (DOM-free)", async () => {
  const { kindMeetingDays } = await import("../js/features/boards.js");
  store.docs.meta = {};
  assert.deepEqual(kindMeetingDays("clm"), [4]);
  assert.deepEqual(kindMeetingDays("weekend"), [0]);
  assert.deepEqual(kindMeetingDays("av"), [4, 0]);
  assert.deepEqual(kindMeetingDays("cleaning"), [0]);
  assert.deepEqual(kindMeetingDays("attendant"), [0]);
  assert.deepEqual(kindMeetingDays("fsm"), [6]);
  assert.deepEqual(kindMeetingDays("nope"), []);
  store.docs.meta = { sheet: { midweekDay: 2, weekendDay: 6, fsmDay: 0 } };
  assert.deepEqual(kindMeetingDays("clm"), [2]);
  assert.deepEqual(kindMeetingDays("av"), [2, 6]);
  assert.deepEqual(kindMeetingDays("fsm"), [0]);
  store.docs.meta = {};
});

test("contentLangFor: per-kind override, else app content language", () => {
  store.docs.meta = { sheet: { langOverrides: { weekend: "en", clm: "" } } };
  assert.equal(contentLangFor("weekend"), "en");     // explicit override
  assert.equal(contentLangFor("clm"), getContentLang()); // "" → inherit app
  assert.equal(contentLangFor("av"), getContentLang());  // unset → inherit app
  store.docs.meta = { sheet: { langOverrides: { weekend: "bogus" } } };
  assert.equal(contentLangFor("weekend"), getContentLang()); // invalid → inherit
  store.docs.meta = {};
});

test("langOverrides: one schedule renders English while others stay Tamil (app=ta)", () => {
  assert.equal(getContentLang(), "ta"); // test env default
  store.docs.meta = { sheet: { langOverrides: { weekend: "en" } } };
  const wknd = weekendBoardHtml([{ date: "2026-05-03", chairman: "p1",
    talk: { number: 12, theme: "தலைப்பு", speaker: "p2" }, wt: { conductor: "p1", reader: "p2" } }], {});
  // weekend override → English title + column labels + English publisher name
  assert.ok(wknd.includes("WEEKEND MEETING"));
  assert.ok(wknd.includes("Chairman"));
  assert.ok(wknd.includes("Public Talk"));
  assert.ok(wknd.includes("Br. Jeyanth"));   // p1 nameEn under en
  // a non-overridden schedule keeps the Tamil app content language
  const av = roleBoardHtml("av", [{ date: "2026-05-06", mixer: "p1", media: "p2", micLeft: "p1", micRight: "p2" }], {});
  assert.ok(av.includes("ஆடியோ மிக்சர்"));   // Tamil label
  assert.ok(av.includes("Br. ஜெயந்த்"));     // Tamil name (no override)
  store.docs.meta = {};
});

test("langOverrides: weekly card + role board follow their own kind's override", () => {
  store.docs.meta = { sheet: { langOverrides: { av: "en", cleaning: "en" } } };
  const card = weeklyCardHtml("av", { date: "2026-05-06", mixer: "p1", media: "p2", micLeft: "p1", micRight: "p2" });
  assert.ok(card.includes("Audio Mixer"));   // en field label
  assert.ok(card.includes("AUDIO / VIDEO")); // en title
  // cleaning override independent of av
  const clean = roleBoardHtml("cleaning", [{ weekOf: "2026-05-10", partA: "g1", partB: "g2" }], {});
  assert.ok(clean.includes("CLEANING"));
  store.docs.meta = {};
});

test("monthDates: all weekday occurrences of a month as ISO dates", async () => {
  const { monthDates } = await import("../js/state.js");
  // July 2026: Wednesdays are 1, 8, 15, 22, 29; Sundays 5, 12, 19, 26
  assert.deepEqual(monthDates(3, new Date(2026, 6, 1)), ["2026-07-01", "2026-07-08", "2026-07-15", "2026-07-22", "2026-07-29"]);
  assert.deepEqual(monthDates(0, new Date(2026, 6, 1)), ["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26"]);
  assert.deepEqual(monthDates(6, new Date(2026, 1, 1)), ["2026-02-07", "2026-02-14", "2026-02-21", "2026-02-28"]);
});
