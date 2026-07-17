// ============================================================================
// CLM SHEET TEMPLATE LIBRARY
// ----------------------------------------------------------------------------
// Generates the congregation midweek-meeting sheet as a self-contained HTML
// document, reproducing the reference template (t3.html — hand-cleaned from
// the original Google-Sheets export) exactly: same CSS classes, same cell
// structure, same row heights, same colours.
//
// Pure string builder — no DOM APIs. Usable in the browser, in Node, and as
// the payload sent to the PDF backend.
//
// IMPORTANT: the output intentionally has NO <!DOCTYPE>. The reference sheet
// renders in quirks mode; adding a doctype changes image-cell baselines and
// shifts row heights. Do not "fix" this.
//
// ----------------------------------------------------------------------------
// renderClmSheet(input) -> html string
//
// input = {
//   title:  "ஊரப்பாக்கம் சபையின் - நம் கிறிஸ்தவ ... அட்டவணை",   // line 1 of heading
//   month:  "ஏப்ரல் 2026",                                      // line 2 of heading
//   header: true,                              // false → no title row (fragment)
//   footer: true,                              // false → no notes rows (fragment)
//   icons:  { treasures, ministry, living },   // optional section icons (see images)
//   theme:  "rgb(244, 241, 220)"               // one day tint for every week, OR
//           | { tints: [...], sections: { treasures, ministry, living } },
//   tints:  ["rgb(244, 241, 220)", ...],       // optional per-week day colours
//   notes:  ["... <span class=\"note-hi\">ஏப்ரல் 1</span> ..."], // 0..3, HTML strings
//   labels: { chairman, prayer, reading, note },                // optional, Tamil defaults
//
// Images (week.image and icons.*) accept any of:
//   • url / relative path        "resources/pic.jpg", "https://…", "data:image/…"
//   • bare base64 string         "iVBORw0KGgo…"   (wrapped as data:image/png)
//   • { data, mime }             { data: "iVBORw…", mime: "image/jpeg" }
//   weeks: [{                                  // 1..5 weeks
//     date: "ஏப்ரல் 8, 2026",
//     image: "resources/xxx.jpg",              // optional weekly picture (89x89)
//     chairman: "Br. உலகநாதன்",
//     openingPrayer: "Br. ஜோதம்",
//     closingPrayer: "Br. உலகநாதன்",
//     treasures: [ { min:10, text:"Br. சிவக்குமார்" }, ... ],   // fixed count (3)
//     ministry:  [ { min:3, student:"Sr. A", assistant:"Sr. B" },
//                  { min:5, text:"Br. C" }, ... ],              // 3..4 items
//     living:    [ { min:15, text:"Br. D" }, ... ],             // 1..3 (before CBS)
//     cbs:       { min:30, conductor:"Br. E", reader:"Br. F" },
//   }],
// }
//
// ALIGNMENT RULES (the whole point of this template):
//   • Every section band has the same height in every week, even when the
//     number of portions differs, so the three section headers line up.
//   • Mechanism (same as the reference sheet): a band is emitted as
//     2×LCM(counts) micro-rows; a week with c items spans rows/c micro-rows
//     per item; a student/assistant pair splits its item's rows in half.
//     Reference month {3,3,4,3} → 24 micro-rows of 8.55px, 3-item weeks get
//     8 rows (4+4) per item, 4-item weeks get 6 rows (3+3). Byte-identical.
// ============================================================================

export const noteHi = (s) => `<span class="note-hi">${esc(s)}</span>`;

// Single-week fragment: same design, one week's card only, no title/notes.
export const renderClmWeek = (week, opts = {}) =>
  renderClmSheet({ ...opts, weeks: [week], header: false, footer: false });

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Normalise an image input (url / path / bare base64 / {data, mime}) to a src.
function imgSrc(v) {
  if (!v) return "";
  if (typeof v === "object") return `data:${v.mime || "image/png"};base64,${v.data}`;
  const s = String(v).trim();
  if (/^(data:|https?:|blob:|file:)/.test(s)) return s;
  if (s.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(s)) return `data:image/png;base64,${s.replace(/\s+/g, "")}`;
  return s; // relative path
}

// --- geometry taken verbatim from the reference sheet -----------------------
// Per-week column widths [num, time, mid, name-a, name-b]; edge = gap column.
const WEEK_COLS = [
  [37.52, 51.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 201.66],
  [37.52, 52.53, 12.50, 26.51, 201.66],
];
const EDGE_W = 25.52;
// The reference table declares width 2930.80px over columns summing 2784.69px;
// fixed layout stretches every column proportionally (×1.052469). We drop the
// reference's unused trailing columns but keep the same stretch so the visible
// sheet is pixel-identical.
const TABLE_SCALE = 2930.80 / 2784.69;
const H = { title: "69.56", ruleTop: "13.55", photo1: "20.91", photo2: "69.75", ruleMid: "12.55",
            chairman: "42.55", prayer: "29.55", secHdr: "38.66", treasure: "34.55",
            cbs1: "27.55", cbs2: "28.55", reader: "36.55", closing1: "29.55", closing2: "34.55",
            noteGap: "14.55", note1: "16.55", note2: "35.55", note3: "20.70" };
const MINISTRY_UNIT = 51.30;  // ministry band height per item at max density (24×8.55 / 4)
const LIVING_UNIT   = 49.56;  // living portion row height at max density
const DAY_TINTS = ["rgb(244, 241, 220)", "rgb(255, 234, 221)", "rgb(231, 231, 231)", "rgb(255, 240, 249)"];
const LABELS = { chairman: "சேர்மன்", prayer: "ஜெபம்", reading: "வாசிப்பு", note: "குறிப்பு:" };

// --- CSS verbatim from the reference (day tints + table width injected) -----
const CSS = `
body{margin:0;background:#fff}
table{border-collapse:separate;border-spacing:0;table-layout:fixed;width:__WIDTH__px}
td,th{box-sizing:content-box;overflow:hidden;line-height:normal;white-space:normal;word-wrap:break-word;--day:#fff;--sec:#999;background:var(--day)}
img{max-width:none;display:inline-block;vertical-align:top}
.brk{font-size:2.66667px}
.note-hi{color:rgb(152, 0, 0)}
/* ===== cell roles ===== */
.title{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:17.3333px;font-weight:700;text-align:center;vertical-align:middle;border-right:0.5px solid rgb(255, 255, 255);border-bottom:2.5px solid rgb(255, 255, 255);padding:2px 3px 2px 3px}
.daydate{background:var(--day);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:16px;font-weight:700;text-align:center;vertical-align:middle;border-right:1.5px solid rgb(153, 153, 153);border-bottom:1.5px solid rgb(153, 153, 153);padding:2px 3px 2px 3px}
.photo{background:rgb(217, 217, 217);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;font-weight:700;text-align:center;vertical-align:middle;border-right:0.5px solid color(srgb 0 0 0 / 0.15);border-bottom:1.5px solid rgb(153, 153, 153);padding:0px 0px 0px 0px;border-left: 1.5px solid rgb(153, 153, 153)}
.section{background:rgb(255, 255, 255);color:var(--sec);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;font-weight:700;text-align:center;vertical-align:middle;border-right:1.5px solid rgb(153, 153, 153);border-bottom:1.5px solid var(--sec);padding:2px 3px 2px 3px}
.sec-icon{background:var(--sec);color:var(--sec);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;font-weight:700;text-align:center;vertical-align:middle;border-right:1.5px solid rgb(255, 255, 255);border:1.5px solid var(--sec);padding:0px 0px 0px 0px}
.label{background:var(--day);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;text-align:right;vertical-align:middle;border-right:1.5px solid rgb(153, 153, 153);border-bottom:0.5px solid color(srgb 0 0 0 / 0.15);padding:2px 3px 2px 3px;border-left: 1.5px solid rgb(153, 153, 153)}
.num{background:var(--day);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:14.6667px;font-weight:700;text-align:center;vertical-align:middle;border-right:0.5px solid var(--day);border-bottom:0.5px solid rgb(204, 204, 204);padding:2px 3px 2px 3px;border-left: 1.5px solid rgb(153, 153, 153)}
.time{background:var(--day);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;text-align:center;vertical-align:middle;border-right:1.5px solid rgb(153, 153, 153);border-bottom:0.5px solid rgb(204, 204, 204);padding:2px 3px 2px 3px}
.assignee{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:14.6667px;text-align:left;vertical-align:middle;border-right:1.5px solid rgb(153, 153, 153);border-bottom:0.5px solid rgb(204, 204, 204);padding:2px 3px 2px 3px}
.first.assignee{border-bottom:0;}
.note{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;font-weight:700;text-align:left;vertical-align:middle;border-right:0.5px solid rgb(255, 255, 255);border-bottom:0.5px solid rgb(255, 255, 255);padding:2px 3px 2px 3px}
.divider{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;text-align:right;vertical-align:middle;border-right:0.5px solid rgb(255, 255, 255);padding:2px 3px 2px 3px}
.edge{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:14.6667px;text-align:left;vertical-align:middle;border-bottom:1.5px solid rgb(255, 255, 255);padding:2px 3px 2px 3px}
.rule{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:13.3333px;text-align:center;vertical-align:middle;border-right:0.5px solid rgb(255, 255, 255);border-bottom:1.5px solid rgb(153, 153, 153);padding:2px 3px 2px 3px}
.spacer{background:rgb(255, 255, 255);color:rgb(0, 0, 0);font-family:"docs-Noto Sans Tamil","Noto Sans Tamil",Arial;font-size:14.6667px;font-weight:700;text-align:left;vertical-align:middle;border-right:0.5px solid rgb(255, 255, 255);border-bottom:0.5px solid rgb(255, 255, 255);padding:2px 3px 2px 3px}
.front.spacer{border-bottom:0.5px solid rgb(204, 204, 204)}
.prayer{border-bottom: 1.5px solid rgb(153, 153, 153);}
/* ===== day colours (background tint) ===== */
__DAYS__
/* ===== section accent colours ===== */
__SECS__

.section{border: 1.5px solid var(--sec)}
`;
const SEC_COLORS = { treasures: "rgb(60, 127, 139)", ministry: "rgb(214, 143, 0)", living: "rgb(191, 47, 19)" };

const SECTIONS = [
  { key: "treasures", title: "பைபிளில் இருக்கும் புதையல்கள்" },
  { key: "ministry",  title: "ஊழியத்தை நன்றாகச் செய்யுங்கள்" },
  { key: "living",    title: "கிறிஸ்தவர்களாக வாழுங்கள்" },
];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);
const px = (n) => n.toFixed(2);

export function renderClmSheet(input) {
  const weeks = (input.weeks || []).slice(0, WEEK_COLS.length);
  const N = weeks.length;
  if (!N) throw new Error("renderClmSheet: at least one week required");
  const L = { ...LABELS, ...(input.labels || {}) };
  const icons = input.icons || {};
  const notes = (input.notes || []).slice(0, 3);
  const secTitles = { ...Object.fromEntries(SECTIONS.map((s) => [s.key, s.title])), ...(input.sectionTitles || {}) };
  const header = input.header !== false;
  const footer = input.footer !== false;
  const theme = input.theme || {};
  const themeTints = typeof theme === "string" ? weeks.map(() => theme) : (theme.tints || input.tints || []);
  const secColors = { ...SEC_COLORS, ...(typeof theme === "object" ? theme.sections : null) };

  // ---- columns / width ----
  const cols = [];
  for (let i = 0; i < N; i++) { if (i) cols.push(EDGE_W); cols.push(...WEEK_COLS[i]); }
  const totalCols = 6 * N - 1;
  const width = px(cols.reduce((a, b) => a + b, 0) * TABLE_SCALE);
  const colgroup = cols.map((w) => `<col style="width:${px(w)}px">`).join("\n");
  const iconW = (i) => (WEEK_COLS[i][0] >= 37 ? 37 : 36);

  // ---- day tint classes ----
  const tints = weeks.map((w, i) => w.tint || themeTints[i] || DAY_TINTS[i % DAY_TINTS.length]);
  const dayCss = tints.map((c, i) => `.day${i + 1}{--day:${c}}`).join("\n");
  const secCss = SECTIONS.map((s) => `.${s.key}{--sec:${secColors[s.key]}}`).join("\n");

  const rows = [];
  const tr = (h, cells) => rows.push(`<tr style="height:${h}px">${cells}</tr>`);
  // one row shared by all weeks; gap cell between weeks (cellFor may return "" when covered by a rowspan)
  const weekRow = (h, cellFor, gap = `<td class="edge"></td>`) =>
    tr(h, weeks.map((w, i) => cellFor(w, i) + (i < N - 1 ? gap : "")).join(""));
  const day = (i) => `day${i + 1}`;
  const minTxt = (m) => (m == null || m === "" ? "" : `${m} min`);

  // ---- title ----
  if (header)
    tr(H.title, `<td class="title" colspan="${totalCols}">${esc(input.title)}<span class="brk"><br class="brk"><br class="brk"></span>${esc(input.month)}</td>`);

  // ---- top rule ----
  weekRow(H.ruleTop, () => `<td class="rule"></td>`.repeat(5), `<td class="spacer"></td>`);

  // ---- photo + date (two rows, rowspan 2) ----
  weekRow(H.photo1, (w, i) =>
    `<td class="photo" colspan="2" rowspan="2">${w.image ? `<div><img src="${esc(imgSrc(w.image))}" alt="" width="89" height="89"></div>` : ""}</td>` +
    `<td class="daydate ${day(i)}" colspan="3" rowspan="2">${esc(w.date)}</td>`);
  tr(H.photo2, weeks.slice(1).map((_, g) => (g === 0 ? `<th class="spacer"></th>` : `<td class="edge"></td>`)).join(""));

  // ---- mid rule ----
  weekRow(H.ruleMid, () => `<td class="rule" colspan="5"></td>`, `<td class="spacer"></td>`);

  // ---- chairman / opening prayer ----
  weekRow(H.chairman, (w, i) =>
    `<td class="label ${day(i)}" colspan="2">${esc(L.chairman)}</td><td class="front spacer"></td><td class="assignee" colspan="2">${esc(w.chairman)}</td>`);
  weekRow(H.prayer, (w, i) =>
    `<td class="label ${day(i)} treasures" colspan="2">${esc(L.prayer)}</td><td class="divider treasures"></td><td class="assignee treasures" colspan="2">${esc(w.openingPrayer)}</td>`);

  // ---- section header row ----
  const secHdr = (sec) => weekRow(H.secHdr, (w, i) =>
    `<td class="sec-icon ${sec}">${icons[sec] ? `<div><img src="${esc(imgSrc(icons[sec]))}" alt="" width="${iconW(i)}" height="37"></div>` : ""}</td>` +
    `<td class="section ${sec}" colspan="4">${esc(secTitles[sec])}</td>`);

  // per-week running part number
  const no = weeks.map(() => 0);

  // ---- TREASURES: fixed rows; last row carries the next section's marker ----
  secHdr("treasures");
  const tCount = Math.max(...weeks.map((w) => w.treasures.length));
  for (let r = 0; r < tCount; r++) {
    const last = r === tCount - 1;
    weekRow(H.treasure, (w, i) => {
      const p = w.treasures[r];
      if (!p) return `<td class="num ${day(i)}"></td><td class="time ${day(i)}"></td><td class="front spacer"></td><td class="assignee" colspan="2"></td>`;
      no[i]++;
      const m = last ? " ministry" : "";
      const mid = last ? `<td class="divider ministry"></td>` : `<td class="front spacer"></td>`;
      return `<td class="num ${day(i)}${m}">${no[i]}</td><td class="time ${day(i)}${m}">${minTxt(p.min)}</td>${mid}<td class="assignee${m}" colspan="2">${esc(p.text)}</td>`;
    });
  }

  // ---- flex band: 2×LCM micro-rows; each week divides them evenly ----------
  // marker = class the last item's cells carry (name of the *next* section).
  function flexBand(items, unit, { pairs, marker }) {
    const counts = weeks.map((_, i) => Math.max(1, items(i).length));
    const uniform = counts.every((c) => c === counts[0]);
    if (uniform && !pairs) {              // plain rows — matches the reference exactly
      for (let r = 0; r < counts[0]; r++) {
        weekRow(px(unit), (w, i) => {
          const p = items(i)[r]; no[i]++;
          return `<td class="num ${day(i)}">${p ? no[i] : ""}</td><td class="time ${day(i)}">${p ? minTxt(p.min) : ""}</td><td class="front spacer"></td><td class="assignee" colspan="2">${p ? esc(p.text ?? p.student) : ""}</td>`;
        });
      }
      return;
    }
    const total = unit * Math.max(...counts);
    const nRows = 2 * counts.reduce((a, c) => lcm(a, c), 1);
    const h = px(total / nRows);
    const span = counts.map((c) => nRows / c);
    const rs = (s) => (s > 1 ? ` rowspan="${s}"` : "");
    for (let r = 0; r < nRows; r++) {
      weekRow(h, (w, i) => {
        const s = span[i], list = items(i);
        let cells = "";
        if (r % s === 0) {                          // item starts here
          const it = list[r / s] || {};
          const isLast = r / s === list.length - 1;
          const m = marker && isLast ? ` ${marker}` : "";
          no[i]++;
          cells += `<td class="num ${day(i)}${m}"${rs(s)}>${no[i]}</td><td class="time ${day(i)}${m}"${rs(s)}>${minTxt(it.min)}</td>`;
          cells += marker && isLast ? `<td class="divider ${marker}"${rs(s)}></td>` : `<td class="front spacer"${rs(s)}></td>`;
          const student = it.student ?? it.text ?? "";
          cells += it.assistant
            ? `<td class="first assignee" colspan="2"${rs(s / 2)}>${esc(student)}</td>`
            : `<td class="assignee${marker && isLast ? ` ${marker}` : ""}" colspan="2"${rs(s)}>${esc(student)}</td>`;
        } else if (r % s === s / 2) {               // assistant half starts here
          const it = list[(r - s / 2) / s] || {};
          const isLast = (r - s / 2) / s === list.length - 1;
          if (it.assistant) cells += `<td class="assignee${marker && isLast ? ` ${marker}` : ""}" colspan="2"${rs(s / 2)}>${esc(it.assistant)}</td>`;
        }
        return cells;
      });
    }
  }

  // ---- MINISTRY ----
  secHdr("ministry");
  flexBand((i) => weeks[i].ministry, MINISTRY_UNIT, { pairs: true, marker: "living" });

  // ---- LIVING ----
  secHdr("living");
  flexBand((i) => weeks[i].living, LIVING_UNIT, { pairs: false, marker: null });

  // CBS (two rows, rowspan 2)
  weekRow(H.cbs1, (w, i) => {
    const c = w.cbs || {}; no[i]++;
    return `<td class="num ${day(i)}" rowspan="2">${no[i]}</td><td class="time ${day(i)}" rowspan="2">${minTxt(c.min ?? 30)}</td><td class="front spacer" rowspan="2"></td><td class="assignee" colspan="2" rowspan="2">${esc(c.conductor)}</td>`;
  });
  tr(H.cbs2, `<td class="edge"></td>`.repeat(N - 1));

  // reader
  weekRow(H.reader, (w, i) =>
    `<td class="label ${day(i)}" colspan="2">${esc(L.reading)}</td><td class="front spacer"></td><td class="assignee" colspan="2">${esc((w.cbs || {}).reader)}</td>`);

  // closing prayer (two rows, rowspan 2)
  weekRow(H.closing1, (w, i) =>
    `<td class="prayer label ${day(i)}" colspan="2" rowspan="2">${esc(L.prayer)}</td><td class="rule" rowspan="2"></td><td class="prayer assignee" colspan="2" rowspan="2">${esc(w.closingPrayer)}</td>`);
  tr(H.closing2, `<td class="edge"></td>`.repeat(N - 1));

  // ---- notes ----
  if (footer) {
    const sp = (n) => `<td class="spacer"></td>`.repeat(Math.max(0, n));
    tr(H.noteGap, sp(totalCols)); // breathing room between the cards and குறிப்பு
    if (notes.length) {
      // note column span: 11 on full sheets (sits under weeks 2-3), narrower sheets use what exists
      const span = Math.min(11, totalCols - 5);
      const lead = Math.min(5, totalCols - span);
      const body = notes.map((t, i) => `${i + 1}. ${t}`).join("<br><br>");
      // grow the middle row so 2-3 notes never clip (base rows fit one note)
      const grow = (notes.length - 1) * 44;
      tr(H.note1, sp(lead) + `<td class="note" colspan="${span}" rowspan="3">${esc(L.note)} <br><br>${body}</td>` + sp(totalCols - lead - span));
      tr(px(parseFloat(H.note2) + grow), sp(totalCols - span));
      tr(H.note3, sp(totalCols - span));
    } else {
      tr(H.note1, sp(totalCols)); tr(H.note2, sp(totalCols)); tr(H.note3, sp(totalCols));
    }
  }

  const css = CSS.replace("__WIDTH__", width).replace("__DAYS__", dayCss).replace("__SECS__", secCss);
  return `<html><head><meta charset="UTF-8"><title>Schedule</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<table>
<colgroup>
${colgroup}
</colgroup>
<tbody>
${rows.join("\n")}
</tbody>
</table></body></html>`;
}
