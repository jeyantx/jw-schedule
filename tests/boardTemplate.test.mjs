import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRoleBoard, renderDateBoard, renderBoardCard, THEMES, resolveTheme, ICONS } from "../js/features/boardTemplate.js";

const wed = [{ label: "மே 6", iso: "2026-05-06" }, { label: "மே 13", iso: "2026-05-13" }];   // Wednesdays only
const mixed = [{ label: "மே 6", iso: "2026-05-06" }, { label: "மே 10", iso: "2026-05-10" }]; // Wed + Sun
const roleCfg = (dates = wed) => ({
  kind: "av", title: "ஒலி / ஒளி", icon: "speaker", theme: "light-1",
  congName: "ஊரப்பாக்கம்", month: "மே 2026", dates,
  rows: [
    { icon: "mixer", label: "மிக்சர்", cells: ["Br. A", "Br. B"] },
    { icon: "mic", label: "மைக்", cells: ["Br. C", { text: "Br. D", hint: "பயிற்சி" }] },
  ],
});

test("band: title + congregation·month at the top of the board", () => {
  const html = renderRoleBoard(roleCfg());
  const band = html.indexOf('class="band"');
  assert.ok(band >= 0 && band < html.indexOf("<table"), "band before table");
  assert.ok(html.includes("ஊரப்பாக்கம் · மே 2026"));
});

test("weekday line only when the schedule mixes weekdays", () => {
  assert.ok(!renderRoleBoard(roleCfg(wed)).includes('class="wd"'), "single weekday → no wd");
  const html = renderRoleBoard(roleCfg(mixed));
  assert.ok(html.includes("புதன்") && html.includes("ஞாயிறு"), "mixed → weekday shown");
});

test("headers are neutral — no per-day colours", () => {
  const html = renderRoleBoard(roleCfg(mixed));
  assert.ok(!html.includes("#1d4ed8</") && !/color:#c2570b/.test(html));
  assert.ok(!html.includes("class=\"dh\""));
});

test("role board: colgroup left column, zebra, hints, dense font step >6 dates", () => {
  const html = renderRoleBoard(roleCfg());
  assert.ok(html.includes('<colgroup><col style="width:190px">'));
  assert.ok(html.includes('class="r alt"'));
  assert.ok(html.includes('<span class="hint">பயிற்சி</span>'));
  assert.ok(html.includes("--cfs:14px"));
  const many = renderRoleBoard(roleCfg(Array.from({ length: 8 }, (_, i) => ({ label: `d${i}`, iso: `2026-05-${String(6 + i).padStart(2, "0")}` }))));
  assert.ok(many.includes("--cfs:12.5px"), "dense boards step the font down");
});

test("role board: standard document (doctype) + accent from theme kind", () => {
  const html = renderRoleBoard(roleCfg());
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes(`--accent:${THEMES["light-1"].accents.av}`));
});

test("date board: badge number, colgroup widths, header aligned with column", () => {
  const html = renderDateBoard({
    kind: "weekend", title: "வார இறுதி", icon: "tower", theme: "light-1",
    columns: [{ key: "talk", label: "பேச்சு", align: "left" }, { key: "sp", label: "பேச்சாளர்", width: 160 }],
    rows: [{ date: { label: "மே 3", iso: "2026-05-03" }, cells: { talk: { no: 12, text: "தலைப்பு" }, sp: { text: "Br. X", hint: "வேளச்சேரி" } } }],
  });
  assert.ok(html.includes('<span class="no">12</span>'));
  assert.ok(html.includes('<colgroup><col style="width:120px"><col><col style="width:160px"></colgroup>'));
  assert.ok(html.includes('style="text-align:left;padding-left:10px'), "header mirrors column alignment");
  assert.ok(!html.includes('class="wd"'), "single Sunday set → no weekday");
});

test("date board: date cells use the accent colour via .dl", () => {
  const html = renderDateBoard({
    kind: "fsm", title: "F", icon: "home", theme: "light-1",
    columns: [{ key: "a", label: "A" }],
    rows: [{ date: { label: "மே 2", iso: "2026-05-02" }, cells: { a: "x" } }],
  });
  assert.ok(html.includes('class="dl"'));
  assert.ok(html.includes(`--accent:${THEMES["light-1"].accents.fsm}`));
});

test("card: array values stack with <br>; date line present", () => {
  const html = renderBoardCard({
    kind: "av", title: "AV", icon: "speaker", theme: "light-1",
    date: { label: "மே 6, 2026", iso: "2026-05-06" },
    fields: [{ icon: "mic", label: "மைக்", value: ["Br. A", "Br. B"] }],
  });
  assert.ok(html.includes("Br. A<br>Br. B"));
  assert.ok(html.includes("மே 6, 2026"));
});

test("escaping in labels/cells", () => {
  const html = renderRoleBoard({ ...roleCfg(), rows: [{ label: "<img>", cells: ['<script>"'] }] });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;&quot;"));
});

test("themes: every preset names all schedule accents; resolveTheme falls back", () => {
  for (const th of Object.values(THEMES))
    for (const k of ["av", "cleaning", "attendant", "fsm", "weekend", "clm"])
      assert.ok(th.accents[k], `${th.name} missing accent ${k}`);
  assert.equal(resolveTheme("nope"), THEMES["light-1"]);
  assert.equal(resolveTheme(undefined), THEMES["light-1"]);
});

test("icons exist for every field icon used by the boards", () => {
  for (const k of ["mixer", "media", "mic", "speaker", "sparkle", "broom", "droplet", "chair", "talk", "tower", "book", "reader", "clock", "pin", "users", "door", "video", "cal", "home"])
    assert.ok(ICONS[k], `missing icon ${k}`);
});

test("print-fit @page: role/fsm landscape, card portrait, weekend portrait+compact", () => {
  assert.ok(renderRoleBoard(roleCfg()).includes("@page{size:A4 landscape;margin:10mm}"));
  const card = renderBoardCard({ kind: "av", title: "AV", icon: "speaker", theme: "light-1",
    date: { label: "மே 6", iso: "2026-05-06" }, fields: [{ label: "x", value: "y" }] });
  assert.ok(card.includes("@page{size:A4 portrait;margin:10mm}"));
  const wk = renderDateBoard({ kind: "weekend", title: "W", icon: "tower", theme: "light-1",
    orientation: "portrait", compact: true, columns: [{ key: "a", label: "A" }],
    rows: [{ date: { label: "மே 3", iso: "2026-05-03" }, cells: { a: "x" } }] });
  assert.ok(wk.includes("@page{size:A4 portrait;margin:10mm}"));
  assert.ok(wk.includes('class="board compact"'));
});

test("boards centre horizontally (margin:0 auto) so the PDF has even margins", () => {
  assert.ok(renderRoleBoard(roleCfg()).includes("margin:0 auto"));
});

test("notes + guideline render under the board", () => {
  const html = renderRoleBoard({ ...roleCfg(), notes: ["முதல்"], guideline: "வழிகாட்டுதல்" });
  assert.ok(html.includes("முதல்"));
  assert.ok(html.includes("வழிகாட்டுதல்"));
  assert.ok(html.includes('class="foot guide"'));
});
