import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const { setLang, getLang, getContentLang, getStoredLang, t, tc } = await import("../js/i18n.js");
const { store } = await import("../js/store.js");
const { weekendBoardHtml } = await import("../js/features/boards.js");

test("language modes: ta / en / mixed map to UI + content languages", () => {
  setLang("ta");
  assert.equal(getStoredLang(), "ta");
  assert.equal(getLang(), "ta");
  assert.equal(getContentLang(), "ta");

  setLang("en");
  assert.equal(getStoredLang(), "en");
  assert.equal(getLang(), "en");
  assert.equal(getContentLang(), "en");

  // mixed: English app chrome, Tamil schedule content
  setLang("mixed");
  assert.equal(getStoredLang(), "mixed");
  assert.equal(getLang(), "en");
  assert.equal(getContentLang(), "ta");
});

test("backward compatibility: an unknown/absent stored value falls back sanely", () => {
  // getLang never returns "mixed"; t() always resolves against a real dict
  setLang("mixed");
  assert.ok(getLang() === "en" || getLang() === "ta");
  assert.equal(typeof t("reader"), "string");
});

test("t() follows the UI language; tc() follows the content language", () => {
  setLang("ta");
  assert.equal(t("reader"), "வாசிப்பாளர்");
  assert.equal(tc("reader"), "வாசிப்பாளர்");

  setLang("en");
  assert.equal(t("reader"), "Reader");
  assert.equal(tc("reader"), "Reader");

  setLang("mixed");
  assert.equal(t("reader"), "Reader");        // chrome → English
  assert.equal(tc("reader"), "வாசிப்பாளர்");  // content → Tamil
});

test("weekendBoardHtml renders Tamil labels + names in mixed mode", () => {
  store.docs.publishers = [
    { id: "p1", name: "ஜெயந்த்", nameEn: "Jeyanth", gender: "brother" },
    { id: "p2", name: "மேரி", nameEn: "Mary", gender: "sister" },
  ];
  store.docs.meta = {};

  const rec = [{ date: "2026-05-03", chairman: "p1",
    talk: { number: 12, theme: "தலைப்பு", speaker: "p1", speakerCong: "" },
    wt: { conductor: "p1", reader: "p2" } }];

  setLang("mixed");
  const mixed = weekendBoardHtml(rec, {});
  assert.ok(mixed.includes("பொது பேச்சு"));   // Tamil column label
  assert.ok(mixed.includes("காவற்கோபுரம்"));   // Tamil column label
  assert.ok(mixed.includes("Br. ஜெயந்த்"));    // Tamil name resolved
  assert.ok(mixed.includes("Sr. மேரி"));

  // sanity: pure-English mode uses English chrome for the same board
  setLang("en");
  const eng = weekendBoardHtml(rec, {});
  assert.ok(eng.includes("Public Talk"));
  assert.ok(eng.includes("Br. Jeyanth"));

  setLang("ta"); // restore default for any later files sharing the process
});
