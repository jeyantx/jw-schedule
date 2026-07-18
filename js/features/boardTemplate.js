// ============================================================================
// BOARD TEMPLATES — minimalist printable boards for the department schedules
// (Audio/Video, Cleaning, Attendants, Field Service Meeting, Weekend meeting).
//
// Design (v3, per user review):
//   • title band at the TOP of the board — light stroke icon + UPPERCASE
//     letter-spaced title in the schedule's accent colour, with the
//     congregation · month on the right; accent underline below
//   • neutral single-colour headers — no per-day colours or coloured
//     underline segments; weekday appears above the date ONLY when the
//     schedule mixes weekdays (e.g. cleaning on midweek + weekend)
//   • header text uses the same alignment + padding as its column's cells
//   • A4-landscape proportions (default width 1082px ≈ A4 landscape with
//     print margins); cell font steps down at >6 date columns so names fit
//   • thin grey separators, subtle zebra, generous even padding
//
// Layouts:
//   renderRoleBoard(cfg)  — roles at LEFT, dates on TOP   (AV, Cleaning, Attendants)
//   renderDateBoard(cfg)  — dates at LEFT, roles on TOP   (Weekend, FSM)
//   renderBoardCard(cfg)  — one date's card for the WhatsApp reminder
//
// theme: a THEMES key or a full theme object. Unlike the CLM sheet (a
// quirks-mode replica of the reference), boards are standard documents.
// ============================================================================
import { esc, imgSrc } from "./sheetKit.js";

// ---- theme presets (Settings shows these names; every colour overridable) --
export const THEMES = {
  "light-1": { name: "Light · Classic", frame: "#25303c", text: "#1f2937", muted: "#6b7280",
    grid: "#e5e7eb", zebra: "#f8fafb", bg: "#ffffff",
    accents: { av: "#1d4ed8", cleaning: "#15803d", attendant: "#0f766e", fsm: "#b45309", weekend: "#9d2146", clm: "#3c7f8b" } },
  "light-2": { name: "Light · Ocean", frame: "#0f3554", text: "#123047", muted: "#5b7285",
    grid: "#dbe6ee", zebra: "#f6fafd", bg: "#ffffff",
    accents: { av: "#0369a1", cleaning: "#0d9488", attendant: "#2563eb", fsm: "#a16207", weekend: "#7c3aed", clm: "#3c7f8b" } },
  "light-3": { name: "Light · Garden", frame: "#233c2c", text: "#1e3328", muted: "#5f7568",
    grid: "#e0e8e2", zebra: "#f7faf7", bg: "#ffffff",
    accents: { av: "#166534", cleaning: "#3f6212", attendant: "#0f766e", fsm: "#92400e", weekend: "#9f1239", clm: "#3c7f8b" } },
  "light-4": { name: "Light · Berry", frame: "#3b1f33", text: "#331b2c", muted: "#7a6273",
    grid: "#ecdfe8", zebra: "#fbf7fa", bg: "#ffffff",
    accents: { av: "#9d174d", cleaning: "#15803d", attendant: "#6d28d9", fsm: "#b45309", weekend: "#be123c", clm: "#3c7f8b" } },
};
export const resolveTheme = (t) => (typeof t === "string" ? THEMES[t] : t && t.name ? t : null) || THEMES["light-1"];

// ---- light stroke icons (24×24, stroke = currentColor) ----------------------
const P = (d) => d.map((x) => x.startsWith("<") ? x : `<path d="${x}"/>`).join("");
export const ICONS = {
  mixer:   P(['<line x1="21" y1="5" x2="14" y2="5"/>', '<line x1="10" y1="5" x2="3" y2="5"/>', '<line x1="21" y1="12" x2="12" y2="12"/>', '<line x1="8" y1="12" x2="3" y2="12"/>', '<line x1="21" y1="19" x2="16" y2="19"/>', '<line x1="12" y1="19" x2="3" y2="19"/>', '<line x1="14" y1="3" x2="14" y2="7"/>', '<line x1="8" y1="10" x2="8" y2="14"/>', '<line x1="16" y1="17" x2="16" y2="21"/>']),
  media:   P(['<rect x="3" y="4" width="18" height="13" rx="2"/>', "M10 8l4 2.5-4 2.5Z", "M8 21h8", "M12 17v4"]),
  mic:     P(["M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z", "M19 10v1a7 7 0 0 1-14 0v-1", '<line x1="12" y1="18" x2="12" y2="22"/>']),
  speaker: P(["M11 5 6 9H3v6h3l5 4V5Z", "M15.5 8.5a5 5 0 0 1 0 7", "M18.4 5.6a9 9 0 0 1 0 12.8"]),
  sparkle: P(["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z", "M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"]),
  broom:   P(["M13.5 10.5 19 5", "M9.5 14.5c-2 2-5.5 2-7.5 1.5.5-2 1.5-5.5 3.5-7.5l4 4Z", "M9.5 14.5l-4-4c1.5-1.5 4-2 6-1l3 3c1 2 .5 4.5-1 6l-4-4Z"]),
  droplet: P(["M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z"]),
  chair:   P(['<circle cx="12" cy="12" r="9"/>', '<circle cx="12" cy="10" r="3"/>', "M6.5 19a6 6 0 0 1 11 0"]),
  talk:    P(['<rect x="3" y="3" width="18" height="12" rx="1.5"/>', "M12 15v3", "M8 21l4-3 4 3"]),
  tower:   P(["M6 21V8l2 1.5L10 8l2 1.5L14 8l2 1.5L18 8v13", "M4 21h16", '<rect x="10.5" y="15" width="3" height="6"/>', "M6 8V5h2v2h2V5h4v2h2V5h2v3"]),
  book:    P(["M2 4.5h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2Z", "M22 4.5h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7Z"]),
  reader:  P(["M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z", "M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"]),
  clock:   P(['<circle cx="12" cy="12" r="9"/>', "M12 7v5l3 2"]),
  pin:     P(["M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z", '<circle cx="12" cy="10" r="3"/>']),
  users:   P(['<circle cx="9" cy="8" r="3.5"/>', "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.6a3.5 3.5 0 0 1 0 6.8", "M17.5 14.4a6.5 6.5 0 0 1 4 5.6"]),
  door:    P(["M13 4h6v17h-6", "M13 21H3", "M13 4 5 6v13l8 2Z", '<circle cx="10.5" cy="12.5" r=".9"/>']),
  video:   P(['<rect x="2" y="6" width="13" height="12" rx="2"/>', "M15 10.5l7-4.5v12l-7-4.5Z"]),
  cal:     P(['<rect x="3" y="5" width="18" height="16" rx="2"/>', "M3 10h18", "M8 3v4", "M16 3v4"]),
  group:   P(['<circle cx="12" cy="7" r="3"/>', "M5 21a7 7 0 0 1 14 0", '<circle cx="4.5" cy="10" r="2"/>', '<circle cx="19.5" cy="10" r="2"/>']),
  home:    P(["M3 11 12 3l9 8", "M5 9.5V21h14V9.5", "M10 21v-6h4v6"]),
};
export const iconSvg = (name, size = 18, cls = "") =>
  ICONS[name] ? `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>` : "";
const iconHtml = (ic, size, cls) => !ic ? "" :
  (ICONS[ic] ? iconSvg(ic, size, cls) : `<img class="${cls}" src="${esc(imgSrc(ic))}" width="${size}" height="${size}" alt="">`);

// ---- shared css -------------------------------------------------------------
// A4 printable widths (CSS px @96dpi, backend default 10mm margins): landscape
// 297mm-20mm ≈ 1040px, portrait 210mm-20mm ≈ 712px. Board widths stay within
// these so the PDF is centred with even margins (never wider → never clipped).
export const PRINTABLE = { landscape: 1040, portrait: 712 };
const baseCss = (T, width, orient = "landscape") => `
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4 ${orient};margin:10mm}
body{background:#fff;font-family:"Noto Sans Tamil",Arial,sans-serif;color:${T.text};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.board{width:${width}px;max-width:100%;margin:0 auto;background:${T.bg};border:2px solid ${T.frame};border-radius:14px;overflow:hidden;padding:0 0 10px}
.band{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 22px 12px;border-bottom:2.5px solid var(--accent);background:color-mix(in srgb,var(--accent) 5%,#fff)}
.band .bt{display:inline-flex;align-items:center;gap:12px;color:var(--accent);font-size:16.5px;font-weight:700;letter-spacing:.1em}
.band .bm{color:${T.muted};font-size:12.5px;font-weight:700;letter-spacing:.03em;text-align:right;line-height:1.45}
table{border-collapse:collapse;width:100%;table-layout:fixed;--cfs:14px;--cpx:10px}
th{font-weight:700}
.ch{padding:11px 10px 8px;color:${T.muted};font-size:11.5px;font-weight:700;letter-spacing:.06em;border-bottom:1.5px solid ${T.grid};text-align:center;vertical-align:bottom}
.ch .in{display:inline-flex;align-items:center;gap:6px}
.ch .wd{display:block;font-size:10px;letter-spacing:.08em;margin-bottom:1px}
.ch .dt{display:block;font-size:13.5px;letter-spacing:0;color:${T.text}}
tr.r td{border-bottom:1px solid ${T.grid};padding:12px var(--cpx);vertical-align:middle}
tr.r.alt td{background:${T.zebra || "#f8fafb"}}
tr.r:last-child td{border-bottom:none}
.rl{display:flex;align-items:center;gap:10px;font-size:13.5px;font-weight:700;color:${T.text};padding:0 8px 0 22px;overflow-wrap:break-word;word-break:normal}
.rl svg{color:${T.muted};flex:none}
.dl{font-size:14px;font-weight:700;color:var(--accent);padding-left:22px;overflow-wrap:break-word;word-break:normal}
.dl .wd{display:block;font-size:10px;letter-spacing:.08em;color:${T.muted}}
.cell{font-size:var(--cfs);font-weight:600;text-align:center;overflow-wrap:break-word;word-break:normal}
.cell .no{display:inline-block;min-width:22px;padding:1px 6px;margin-right:7px;border-radius:99px;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent);font-size:12px;font-weight:700;text-align:center}
.cell .hint{display:block;font-size:11px;color:${T.muted};font-weight:600;margin-top:1px}
.foot{padding:12px 22px 2px;font-size:12px;color:${T.muted}}
.foot b{color:${T.text}}
.guide{display:flex;gap:8px;align-items:flex-start;margin-top:6px;font-style:italic}
.note-hi{color:#b91c1c}
/* compact: portrait boards with many columns (e.g. weekend) — smaller cells,
   tighter padding, wrapping headers so nothing overflows on the narrow page */
.board.compact table{--cfs:12px;--cpx:5px}
.board.compact .ch{font-size:10px;padding:9px 5px 7px;letter-spacing:.02em}
.board.compact .ch .in{flex-wrap:wrap;justify-content:center;gap:3px}
.board.compact .dl{padding-left:8px;font-size:12.5px}
.board.compact .dl .wd{font-size:9px}
.board.compact .rl{padding-left:12px;font-size:12.5px;gap:7px}
`;
const WEEKDAYS = {
  ta: ["ஞாயிறு", "திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி"],
  en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
};
const dayOf = (iso) => (iso ? new Date(iso + "T00:00:00").getDay() : null);
const weekdayOf = (iso, lang = "ta") => (iso ? WEEKDAYS[lang === "en" ? "en" : "ta"][dayOf(iso)] : "");
// show weekdays only when the dates span more than one weekday
const mixedDays = (isos) => new Set(isos.filter((x) => x != null).map(dayOf)).size > 1;

const doc = (css, body) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Schedule</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`;

const bandHtml = (icon, title, meta) =>
  `<div class="band"><span class="bt">${iconHtml(icon, 22)}<span>${esc(title)}</span></span>${meta ? `<span class="bm">${esc(meta)}</span>` : ""}</div>`;
const bandMeta = (cfg) => cfg.meta ?? [cfg.congName, cfg.month].filter(Boolean).join(" · ");

const footHtml = (notes, guideline, labels = {}) => {
  let h = "";
  if (notes && notes.length)
    h += `<div class="foot"><b>${esc(labels.note || "குறிப்பு:")}</b> ${notes.slice(0, 3).map((n, i) => `${notes.length > 1 ? (i + 1) + ". " : ""}${n}`).join(" &nbsp;·&nbsp; ")}</div>`;
  if (guideline) h += `<div class="foot guide">${iconSvg("book", 15)}<span>${guideline}</span></div>`;
  return h;
};

const cellHtml = (c) => c && typeof c === "object"
  ? `${c.no != null ? `<span class="no">${esc(c.no)}</span>` : ""}${esc(c.text)}${c.hint ? `<span class="hint">${esc(c.hint)}</span>` : ""}`
  : esc(c);

// ---- layout 1: roles at left, dates on top (AV / Cleaning / Attendants) ----
// cfg = { title, icon, accent, theme, kind?, congName?, month?, meta?, lang?,
//         width?, leftWidth?,
//         dates: [{ label, iso? }],
//         rows:  [{ icon?, label, cells: [string|{text,hint,no}] }],
//         notes?, guideline?, labels? }
export function renderRoleBoard(cfg) {
  const T = resolveTheme(cfg.theme);
  const accent = cfg.accent || T.accents[cfg.kind] || T.frame;
  const width = cfg.width || PRINTABLE.landscape;
  const leftW = cfg.leftWidth || 190;
  const dates = cfg.dates || [];
  const dense = dates.length > 6;
  const cfs = dense ? "12.5px" : "14px";
  const cpx = dense ? "5px" : "10px";
  const showWd = cfg.showWeekday ?? mixedDays(dates.map((d) => d.iso));
  const colgroup = `<colgroup><col style="width:${leftW}px">${dates.map(() => `<col>`).join("")}</colgroup>`;
  const head = `<tr><th class="ch"></th>${dates.map((d) =>
    `<th class="ch">${showWd ? `<span class="wd">${esc(d.weekday ?? weekdayOf(d.iso, cfg.lang))}</span>` : ""}<span class="dt">${esc(d.label)}</span></th>`).join("")}</tr>`;
  const body = (cfg.rows || []).map((r, ri) =>
    `<tr class="r${ri % 2 ? " alt" : ""}"><td><div class="rl">${iconHtml(r.icon, 18)}<span>${esc(r.label)}</span></div></td>` +
    dates.map((_, i) => `<td class="cell">${cellHtml((r.cells || [])[i])}</td>`).join("") + `</tr>`).join("");
  const table = `<table style="--accent:${accent};--cfs:${cfs};--cpx:${cpx}">${colgroup}${head}${body}</table>`;
  return doc(baseCss(T, width, "landscape"),
    `<div class="board" style="--accent:${accent}">${bandHtml(cfg.icon, cfg.title, bandMeta(cfg))}${table}${footHtml(cfg.notes, cfg.guideline, cfg.labels)}</div>`);
}

// ---- layout 2: dates at left, roles on top (Weekend / FSM) ------------------
// cfg = { title, icon, accent, theme, kind?, congName?, month?, meta?, lang?,
//         width?, dateWidth?,
//         columns: [{ key, icon?, label, width?, align? }],
//         rows: [{ date: {label, iso?}, cells: { key: string|{text,hint,no} } }],
//         notes?, guideline?, labels? }
export function renderDateBoard(cfg) {
  const T = resolveTheme(cfg.theme);
  const accent = cfg.accent || T.accents[cfg.kind] || T.frame;
  const orient = cfg.orientation === "portrait" ? "portrait" : "landscape";
  const width = cfg.width || PRINTABLE[orient];
  const dateW = cfg.dateWidth || 120;
  const columns = cfg.columns || [];
  const showWd = cfg.showWeekday ?? mixedDays((cfg.rows || []).map((r) => r.date && r.date.iso));
  const colgroup = `<colgroup><col style="width:${dateW}px">${columns.map((c) => c.width ? `<col style="width:${c.width}px">` : `<col>`).join("")}</colgroup>`;
  // header alignment/padding mirrors the column's cells so labels sit over content
  const head = `<tr><th class="ch"></th>${columns.map((c) =>
    `<th class="ch" style="text-align:${c.align || "center"};padding-left:10px;padding-right:10px"><span class="in">${iconHtml(c.icon, 15)}${esc(c.label)}</span></th>`).join("")}</tr>`;
  const body = (cfg.rows || []).map((r, ri) =>
    `<tr class="r${ri % 2 ? " alt" : ""}"><td><div class="dl">${showWd ? `<span class="wd">${esc(r.date.weekday ?? weekdayOf(r.date.iso, cfg.lang))}</span>` : ""}${esc(r.date.label)}</div></td>` +
    columns.map((c) => `<td class="cell"${c.align ? ` style="text-align:${c.align}"` : ""}>${cellHtml((r.cells || {})[c.key])}</td>`).join("") + `</tr>`).join("");
  const table = `<table style="--accent:${accent}">${colgroup}${head}${body}</table>`;
  return doc(baseCss(T, width, orient),
    `<div class="board${cfg.compact ? " compact" : ""}" style="--accent:${accent}">${bandHtml(cfg.icon, cfg.title, bandMeta(cfg))}${table}${footHtml(cfg.notes, cfg.guideline, cfg.labels)}</div>`);
}

// ---- weekly card (WhatsApp reminder) ----------------------------------------
// cfg = { title, icon, accent, theme, kind?, date: {label, iso?}, width?,
//         fields: [{ icon?, label, value: string|string[] }], notes?, guideline? }
export function renderBoardCard(cfg) {
  const T = resolveTheme(cfg.theme);
  const accent = cfg.accent || T.accents[cfg.kind] || T.frame;
  const width = cfg.width || 420;
  const rows = (cfg.fields || []).map((f, i) => {
    const v = Array.isArray(f.value) ? f.value.map(esc).join("<br>") : esc(f.value);
    return `<tr class="r${i % 2 ? " alt" : ""}"><td style="width:45%"><div class="rl">${iconHtml(f.icon, 17)}<span>${esc(f.label)}</span></div></td><td class="cell" style="text-align:left;padding-left:2px">${v}</td></tr>`;
  }).join("");
  const dateLine = `<tr><td colspan="2" style="padding:10px 22px 8px;border-bottom:1.5px solid ${T.grid}">` +
    `<span style="display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:15px;color:var(--accent)">${iconSvg("cal", 16)}${esc((cfg.date || {}).label)}</span></td></tr>`;
  const table = `<table style="--accent:${accent}">${dateLine}${rows}</table>`;
  return doc(baseCss(T, width, "portrait"),
    `<div class="board" style="--accent:${accent}">${bandHtml(cfg.icon, cfg.title, bandMeta(cfg))}${table}${footHtml(cfg.notes, cfg.guideline, cfg.labels)}</div>`);
}
