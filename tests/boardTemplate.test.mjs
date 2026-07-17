import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRoleBoard, renderDateBoard, renderBoardCard, THEMES, resolveTheme, ICONS } from "../js/features/boardTemplate.js";

const dates = [
  { label: "மே 6", iso: "2026-05-06" },   // Wednesday
  { label: "மே 10", iso: "2026-05-10" },  // Sunday
];
const roleCfg = () => ({
  kind: "av", title: "ஒலி / ஒளி", icon: "speaker", theme: "light-1", dates,
  rows: [
    { icon: "mixer", label: "மிக்சர்", cells: ["Br. A", "Br. B"] },
    { icon: "mic", label: "மைக்", cells: ["Br. C", { text: "Br. D", hint: "பயிற்சி" }] },
  ],
});

test("role board: weekday computed from iso, coloured by day", () => {
  const html = renderRoleBoard(roleCfg());
  const T = THEMES["light-1"];
  assert.ok(html.includes("புதன்"), "midweek weekday");
  assert.ok(html.includes("ஞாயிறு"), "sunday weekday");
  assert.ok(html.includes(`color:${T.wed}`));
  assert.ok(html.includes(`color:${T.sun}`));
});

test("role board: colgroup fixes left column; zebra on alternate rows; hints render", () => {
  const html = renderRoleBoard(roleCfg());
  assert.ok(html.includes('<colgroup><col style="width:230px">'));
  assert.ok(html.includes('class="r alt"'));
  assert.ok(html.includes('<span class="hint">பயிற்சி</span>'));
});

test("role board: standard document (doctype) + accent from theme kind", () => {
  const html = renderRoleBoard(roleCfg());
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes(`--accent:${THEMES["light-1"].accents.av}`));
});

test("date board: badge number, flexible column via colgroup, custom width honoured", () => {
  const html = renderDateBoard({
    kind: "weekend", title: "வார இறுதி", icon: "tower", theme: "light-1",
    columns: [{ key: "talk", label: "பேச்சு", align: "left" }, { key: "sp", label: "பேச்சாளர்", width: 160 }],
    rows: [{ date: dates[1], cells: { talk: { no: 12, text: "தலைப்பு" }, sp: { text: "Br. X", hint: "வேளச்சேரி" } } }],
  });
  assert.ok(html.includes('<span class="no">12</span>'));
  assert.ok(html.includes("<colgroup><col style=\"width:118px\"><col><col style=\"width:160px\"></colgroup>"));
  assert.ok(html.includes('text-align:left'));
});

test("card: array values stack with <br>; date coloured", () => {
  const html = renderBoardCard({
    kind: "av", title: "AV", icon: "speaker", theme: "light-1",
    date: { label: "மே 6, 2026", iso: "2026-05-06" },
    fields: [{ icon: "mic", label: "மைக்", value: ["Br. A", "Br. B"] }],
  });
  assert.ok(html.includes("Br. A<br>Br. B"));
  assert.ok(html.includes(THEMES["light-1"].wed));
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
  const custom = { name: "X", frame: "#000", text: "#000", muted: "#666", grid: "#eee", bg: "#fff", wed: "#00f", sun: "#f80", accents: { av: "#00f" } };
  assert.equal(resolveTheme(custom), custom);
});

test("icons exist for every field icon used by the boards", () => {
  for (const k of ["mixer", "media", "mic", "speaker", "sparkle", "broom", "droplet", "chair", "talk", "tower", "book", "reader", "clock", "pin", "users", "door", "video", "cal", "home"])
    assert.ok(ICONS[k], `missing icon ${k}`);
});

test("notes + guideline render under the board", () => {
  const html = renderRoleBoard({ ...roleCfg(), notes: ["முதல்"], guideline: "வழிகாட்டுதல்" });
  assert.ok(html.includes("முதல்"));
  assert.ok(html.includes("வழிகாட்டுதல்"));
  assert.ok(html.includes('class="foot guide"'));
});
