import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, imgSrc, noteRows, cellCss, titleRow } from "../js/features/sheetKit.js";

test("esc escapes html-significant characters", () => {
  assert.equal(esc('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
  assert.equal(esc(null), "");
});

test("imgSrc: url/path/data-uri passthrough, bare base64 wrapped, object form", () => {
  assert.equal(imgSrc("resources/x.jpg"), "resources/x.jpg");
  assert.equal(imgSrc("https://x/y.png"), "https://x/y.png");
  assert.equal(imgSrc("data:image/png;base64,AA"), "data:image/png;base64,AA");
  const b64 = "B".repeat(240);
  assert.equal(imgSrc(b64), `data:image/png;base64,${b64}`);
  assert.equal(imgSrc({ data: "QQ==", mime: "image/webp" }), "data:image/webp;base64,QQ==");
  assert.equal(imgSrc(""), "");
});

test("noteRows: gap always, growth for extra notes, spacers when empty", () => {
  const none = noteRows(23, []);
  assert.ok(none.includes("height:14.55px"));
  assert.ok(!none.includes('class="note"'));
  const three = noteRows(23, ["a", "b", "c"]);
  assert.ok(three.includes("1. a<br><br>2. b<br><br>3. c"));
  assert.ok(three.includes(`height:${(35.55 + 88).toFixed(2)}px`));
});

test("titleRow + cellCss basic shape", () => {
  assert.ok(titleRow(23, "T", "M").includes('colspan="23"'));
  assert.ok(cellCss("100.00").includes("width:100.00px"));
});
