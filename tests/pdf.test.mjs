import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

// pdf.js imports ui/api/i18n, all import-safe under node (no top-level DOM).
const { imageWrapHtml, imagePlan } = await import("../js/features/pdf.js");
const { renderBoardCard } = await import("../js/features/boardTemplate.js");

// A real weekly-card document (has <!DOCTYPE html><html><head>…<body>…).
const card = renderBoardCard({
  kind: "weekend", theme: "light-1", title: "WEEKEND MEETING", icon: "tower",
  date: { label: "May 3, 2026" },
  fields: [{ icon: "chair", label: "Chairman", value: "Br. Test" }],
});

test("imageWrapHtml: injects zoom + margin-reset style into a real template", () => {
  const out = imageWrapHtml(card);
  // 3× zoom wrapper present, with comfortable padding on all sides (pre-zoom)
  assert.match(out, /#__imgzoom\{zoom:3;display:inline-block;padding:16px;background:#fff\}/);
  // page margins / centering neutralised so the full-page capture hugs content
  assert.match(out, /html,body\{margin:0!important;padding:0!important;background:#fff!important/);
  assert.match(out, /#__imgzoom>\*\{margin:0!important\}/);
  // body content preserved and wrapped in the zoom div
  assert.match(out, /<body[^>]*><div id="__imgzoom">/);
  assert.match(out, /<\/div><\/body>/);
  assert.ok(out.includes("WEEKEND MEETING"));         // band title survives
  assert.ok(out.includes("Br. Test"));                // cell value survives
  // the wrapper must not corrupt the doctype/head
  assert.ok(out.includes("<!DOCTYPE html>") || out.toLowerCase().includes("<html"));
});

test("imageWrapHtml: honours a custom zoom factor", () => {
  assert.match(imageWrapHtml(card, 1.5), /#__imgzoom\{zoom:1.5;/);
});

test("imagePlan: card content width → 3× viewport width (incl. padding), wrapped html", () => {
  const p = imagePlan(card, 420);
  assert.equal(p.width, (420 + 2 * 16) * 3 + 6);      // (420+32)*3+6 = 1362
  assert.match(p.html, /#__imgzoom\{zoom:3;/);
  assert.match(p.html, /padding:16px/);
});

test("imagePlan: wide content clamps to 2400 and recomputes a smaller zoom", () => {
  const p = imagePlan(card, 1840);                    // ~CLM month sheet width
  assert.equal(p.width, 2400);
  const z = parseFloat(/#__imgzoom\{zoom:([\d.]+);/.exec(p.html)[1]);
  assert.ok(z > 1 && z < 3, `zoom ${z} between 1 and 3`);
  // the padded content (content + 2×16) scaled by zoom must fit the clamp
  assert.ok(Math.round((1840 + 2 * 16) * z) <= 2400, "scaled padded content fits the clamp");
});

test("imagePlan: missing/zero contentWidth → passthrough (legacy path, no wrap)", () => {
  const p = imagePlan(card, undefined);
  assert.equal(p.width, undefined);
  assert.equal(p.html, card);                         // untouched
  assert.equal(imagePlan(card, 0).html, card);
});
