// ============================================================================
// weekTint — per-week THEME COLOUR engine for the midweek (CLM) schedule.
//
// A week's colour can be auto-recommended from its wol.jw.org thumbnail. Two
// hard rules drive the design:
//   1. the colour is ALWAYS a pale pastel wash — never dark, black text must
//      read on it (toPastel forces a very high lightness);
//   2. every week in the same month gets a DISTINCT colour (spreadDistinct
//      rotates hues so no two weeks collide).
//
// dominantColor / toPastel / spreadDistinct + the colour-space helpers are PURE
// and unit-tested. sampleImageColor is the only browser-only, side-effecting
// export (canvas + injected fetch), so it is left out of the unit tests.
// ============================================================================

// Neutral fallback when an image yields no usable colour — a soft slate that
// toPastel turns into a gentle blue-grey wash.
const NEUTRAL = { r: 180, g: 190, b: 210 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v) => Math.round(v);

// --- colour-space helpers (all pure) ----------------------------------------

// RGB (0..255) → HSL (h 0..360, s 0..1, l 0..1).
export function rgbToHsl({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
      case gg: h = (bb - rr) / d + 2; break;
      default: h = (rr - gg) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

// HSL (h 0..360, s 0..1, l 0..1) → RGB (0..255, rounded).
export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  if (s === 0) { const v = round(l * 255); return { r: v, g: v, b: v }; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  return {
    r: round(hue2rgb(p, q, hk + 1 / 3) * 255),
    g: round(hue2rgb(p, q, hk) * 255),
    b: round(hue2rgb(p, q, hk - 1 / 3) * 255),
  };
}

const hex2 = (v) => clamp(round(v), 0, 255).toString(16).padStart(2, "0");
export const rgbToHex = ({ r, g, b }) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

// "#eef3fb" / "#eef" / "eef3fb" → {r,g,b}. Returns NEUTRAL on a bad string.
export function hexToRgb(hex) {
  let s = String(hex).trim().replace(/^#/, "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return { ...NEUTRAL };
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

// Quick saturation proxy (0..1) without a full HSL conversion — used to weight
// colourful pixels above washed-out ones when picking the dominant bucket.
function quickSat(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

// ----------------------------------------------------------------------------
// 1. dominantColor(pixels) — PURE.
// pixels: RGBA byte array (length % 4 === 0), e.g. canvas getImageData().data.
// Ignores near-transparent pixels (a < 128) and near-white / near-black extremes,
// quantizes the rest into 4-bit-per-channel buckets, and returns the average of
// the heaviest bucket where "heavy" is weighted toward more saturated pixels so
// the result reflects the image's character rather than its background.
// Deterministic. Returns a neutral {r,g,b} when nothing usable remains.
// ----------------------------------------------------------------------------
export function dominantColor(pixels) {
  if (!pixels || pixels.length < 4) return { ...NEUTRAL };
  const buckets = new Map();   // key -> { w, r, g, b }  (colour sums are weighted)
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
    if (a < 128) continue;                                  // near-transparent
    if (r > 240 && g > 240 && b > 240) continue;            // near-white
    if (r < 15 && g < 15 && b < 15) continue;               // near-black
    const sat = quickSat(r, g, b);
    // colourful pixels count far more than grey ones, but grey still counts a
    // little so a fully desaturated image is not thrown away.
    const w = 1 + sat * 6;
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const acc = buckets.get(key);
    if (acc) { acc.w += w; acc.r += r * w; acc.g += g * w; acc.b += b * w; }
    else buckets.set(key, { w, r: r * w, g: g * w, b: b * w });
  }
  if (buckets.size === 0) return { ...NEUTRAL };
  let best = null;
  // Deterministic tie-break: higher weight wins, else lower key (Map preserves
  // insertion order, but the explicit key compare removes any ambiguity).
  for (const [key, acc] of buckets) {
    if (!best || acc.w > best.acc.w || (acc.w === best.acc.w && key < best.key)) {
      best = { key, acc };
    }
  }
  const { w, r, g, b } = best.acc;
  return { r: round(r / w), g: round(g / w), b: round(b / w) };
}

// ----------------------------------------------------------------------------
// 2. toPastel({r,g,b}) — PURE.
// Keeps the input HUE, caps SATURATION modest and forces LIGHTNESS very high so
// the result is a gentle wash black text reads on. Returns a hex string.
// A luminance guard guarantees a light result even for a black input.
// ----------------------------------------------------------------------------
const PASTEL_S_CAP = 0.45;   // modest saturation ceiling
const PASTEL_L_MIN = 0.90;   // never darker than this
const PASTEL_L_MAX = 0.94;

export function toPastel(rgb) {
  const { h, s, l } = rgbToHsl(rgb);
  const sat = Math.min(s, PASTEL_S_CAP);
  // Nudge lightness within the pale band by the input's own lightness so
  // distinct source colours keep a hint of individuality — but always pale.
  let light = PASTEL_L_MIN + clamp(l, 0, 1) * (PASTEL_L_MAX - PASTEL_L_MIN);
  light = clamp(light, PASTEL_L_MIN, PASTEL_L_MAX);
  // Luminance assertion: whatever the input, the output must be light. If the
  // computed colour is somehow too dark, force it back into the pale band.
  const out = { h, s: sat, l: light };
  const check = rgbToHsl(hslToRgb(out));
  if (check.l < PASTEL_L_MIN) out.l = PASTEL_L_MIN;
  return hslToHex(out);
}

// ----------------------------------------------------------------------------
// 3. spreadDistinct(hexes) — PURE.
// Input: pastel hex colours, one per week, in week order. If any two hues sit
// too close, rotate hues so they spread evenly round the wheel while keeping
// each colour's own (pale) lightness and (modest) saturation. Returns a new
// array of the same length/order, each hue distinct. Deterministic; 1..N weeks.
// ----------------------------------------------------------------------------
const MIN_HUE_SEP = 25;   // degrees — below this two weeks read as "the same"

// Shortest distance between two hues on the 0..360 wheel.
function hueDist(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

export function spreadDistinct(hexes) {
  const list = Array.isArray(hexes) ? hexes.slice() : [];
  const n = list.length;
  if (n <= 1) return list;

  const hsl = list.map((hex) => rgbToHsl(hexToRgb(hex)));

  // Already distinct? (every pair separated by at least MIN_HUE_SEP.)
  let collides = false;
  for (let i = 0; i < n && !collides; i++) {
    for (let j = i + 1; j < n; j++) {
      if (hueDist(hsl[i].h, hsl[j].h) < MIN_HUE_SEP) { collides = true; break; }
    }
  }
  if (!collides) return list;

  // Spread evenly, anchored to the first week's hue so the result is stable.
  const base = hsl[0].h;
  const step = 360 / n;
  return hsl.map((c, i) => hslToHex({ h: (base + i * step) % 360, s: c.s, l: c.l }));
}

// ----------------------------------------------------------------------------
// 4. sampleImageColor(url, fetchBlob) — async, BROWSER-ONLY (not unit-tested).
// fetchBlob(url) is injected (the caller passes one backed by api.wolImage so the
// blob is same-origin and the canvas is not CORS-tainted). Loads the blob, draws
// it downscaled to ~24x24, reads the pixels, and runs dominantColor → toPastel.
// Returns the pastel hex, or null on ANY failure. Dependency-free + defensive.
// ----------------------------------------------------------------------------
export async function sampleImageColor(url, fetchBlob) {
  const SIZE = 24;
  try {
    if (!url || typeof fetchBlob !== "function") return null;
    const blob = await fetchBlob(url);
    if (!blob) return null;

    let imageData = null;

    // Preferred path: ImageBitmap + OffscreenCanvas (works off the main DOM).
    if (typeof createImageBitmap === "function" && typeof OffscreenCanvas === "function") {
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = new OffscreenCanvas(SIZE, SIZE);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
        imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      } finally {
        if (typeof bitmap.close === "function") bitmap.close();
      }
    } else if (typeof document !== "undefined") {
      // Fallback: <img> + a detached <canvas> in a normal DOM.
      const objUrl = URL.createObjectURL(blob);
      try {
        const img = await new Promise((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("image decode failed"));
          el.src = objUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = SIZE; canvas.height = SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      } finally {
        URL.revokeObjectURL(objUrl);
      }
    } else {
      return null;
    }

    if (!imageData || !imageData.data) return null;
    return toPastel(dominantColor(imageData.data));
  } catch {
    return null;   // any decode / draw / read failure → no recommendation
  }
}
