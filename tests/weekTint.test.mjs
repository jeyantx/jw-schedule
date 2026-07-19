import "./_env.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dominantColor, toPastel, spreadDistinct,
  rgbToHsl, hexToRgb, hslToHex,
} from "../js/features/weekTint.js";

// Build an RGBA byte array from a list of [r,g,b,a] tuples (a defaults to 255).
const rgba = (rows) => {
  const out = new Uint8ClampedArray(rows.length * 4);
  rows.forEach(([r, g, b, a = 255], i) => {
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  });
  return out;
};
const fill = (tuple, n) => Array.from({ length: n }, () => tuple);

test("dominantColor: mostly-one-colour image returns that colour's family", () => {
  // 90 saturated-red pixels, plus a handful of white/black extremes to ignore.
  const pixels = rgba([
    ...fill([200, 30, 30], 90),
    ...fill([255, 255, 255], 20),
    ...fill([0, 0, 0], 20),
  ]);
  const { r, g, b } = dominantColor(pixels);
  assert.ok(r > 150 && r > g + 60 && r > b + 60, `expected a red, got rgb(${r},${g},${b})`);
});

test("dominantColor: saturated minority still wins over a washed-out majority", () => {
  // A large grey background vs. a small vivid-blue subject — the subject should
  // define the image's character thanks to the saturation weighting.
  const pixels = rgba([
    ...fill([150, 150, 150], 120),
    ...fill([30, 60, 220], 25),
  ]);
  const { r, g, b } = dominantColor(pixels);
  assert.ok(b > r && b > g, `expected a blue family, got rgb(${r},${g},${b})`);
});

test("dominantColor: all-transparent → neutral fallback (never crashes)", () => {
  const pixels = rgba(fill([200, 30, 30, 0], 50));
  const c = dominantColor(pixels);
  assert.ok(Number.isFinite(c.r) && Number.isFinite(c.g) && Number.isFinite(c.b));
  // Neutral fallback is a mid-tone slate, not the (ignored) red.
  assert.ok(!(c.r > 150 && c.r > c.g + 60), "should not be the transparent red");
});

test("dominantColor: empty / malformed input → neutral, no throw", () => {
  assert.doesNotThrow(() => dominantColor(new Uint8ClampedArray(0)));
  assert.doesNotThrow(() => dominantColor(null));
});

test("dominantColor: deterministic — same input, same output", () => {
  const pixels = rgba([...fill([200, 30, 30], 40), ...fill([30, 200, 60], 30)]);
  assert.deepEqual(dominantColor(pixels), dominantColor(pixels));
});

test("toPastel: every input is forced light (L >= 0.88), even pure black", () => {
  const inputs = [
    { r: 0, g: 0, b: 0 },        // pure black — the hard case
    { r: 255, g: 255, b: 255 },  // white
    { r: 30, g: 60, b: 220 },    // saturated blue
    { r: 200, g: 20, b: 20 },    // saturated red
    { r: 120, g: 120, b: 120 },  // mid grey
  ];
  for (const input of inputs) {
    const hex = toPastel(input);
    assert.match(hex, /^#[0-9a-f]{6}$/, `not a hex: ${hex}`);
    const { l } = rgbToHsl(hexToRgb(hex));
    assert.ok(l >= 0.88, `input ${JSON.stringify(input)} → ${hex} has L=${l.toFixed(3)}`);
  }
});

test("toPastel: hue is preserved for a saturated colour", () => {
  const blue = { r: 30, g: 60, b: 220 };
  const inHue = rgbToHsl(blue).h;
  const outHue = rgbToHsl(hexToRgb(toPastel(blue))).h;
  assert.ok(Math.abs(inHue - outHue) < 6, `hue drifted ${inHue} → ${outHue}`);
});

test("toPastel: saturation is capped modest (still a wash, not vivid)", () => {
  const { s } = rgbToHsl(hexToRgb(toPastel({ r: 30, g: 60, b: 220 })));
  assert.ok(s <= 0.5, `saturation ${s.toFixed(3)} exceeds pastel cap`);
});

test("spreadDistinct: 5 near-identical pastels → pairwise hue sep above threshold", () => {
  // Five barely-different blues (all collide under MIN_HUE_SEP).
  const near = [210, 212, 214, 208, 211].map((h) => hslToHex({ h, s: 0.4, l: 0.92 }));
  const out = spreadDistinct(near);
  assert.equal(out.length, 5);
  const hues = out.map((hex) => rgbToHsl(hexToRgb(hex)).h);
  const dist = (a, b) => { const d = Math.abs((a - b) % 360); return Math.min(d, 360 - d); };
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      assert.ok(dist(hues[i], hues[j]) >= 30, `weeks ${i}&${j} too close: ${hues[i]} vs ${hues[j]}`);
    }
  }
});

test("spreadDistinct: keeps each colour pale + modest after rotating", () => {
  const near = [210, 212, 214, 208, 211].map((h) => hslToHex({ h, s: 0.4, l: 0.92 }));
  for (const hex of spreadDistinct(near)) {
    const { s, l } = rgbToHsl(hexToRgb(hex));
    assert.ok(l >= 0.88, `L dropped to ${l.toFixed(3)}`);
    assert.ok(s <= 0.5, `S rose to ${s.toFixed(3)}`);
  }
});

test("spreadDistinct: already-distinct input is returned unchanged", () => {
  const distinct = [0, 72, 144, 216, 288].map((h) => hslToHex({ h, s: 0.4, l: 0.92 }));
  assert.deepEqual(spreadDistinct(distinct), distinct);
});

test("spreadDistinct: 1-element input returned unchanged; length/order preserved", () => {
  assert.deepEqual(spreadDistinct(["#eef3fb"]), ["#eef3fb"]);
  assert.deepEqual(spreadDistinct([]), []);
});

test("spreadDistinct: deterministic", () => {
  const near = [210, 212, 214].map((h) => hslToHex({ h, s: 0.4, l: 0.92 }));
  assert.deepEqual(spreadDistinct(near), spreadDistinct(near));
});
