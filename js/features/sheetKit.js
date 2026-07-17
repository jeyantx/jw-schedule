// ============================================================================
// SHEET KIT — shared design tokens + helpers for every printable sheet.
// The visual language comes from the reference CLM sheet (t3): same fonts,
// borders, tints and cell classes, so all schedules look like one family.
// (clmTemplate.js keeps its own verbatim copy — it is verified 0-diff against
// the reference and must not change; new sheets share this kit instead.)
//
// All sheets intentionally render in quirks mode (no <!DOCTYPE>) — see
// clmTemplate.js for why.
// ============================================================================

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const px = (n) => n.toFixed(2);

// url / path / bare base64 / {data, mime} → usable img src
export function imgSrc(v) {
  if (!v) return "";
  if (typeof v === "object") return `data:${v.mime || "image/png"};base64,${v.data}`;
  const s = String(v).trim();
  if (/^(data:|https?:|blob:|file:)/.test(s)) return s;
  if (s.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(s)) return `data:image/png;base64,${s.replace(/\s+/g, "")}`;
  return s;
}

export const FONT = `"docs-Noto Sans Tamil","Noto Sans Tamil",Arial`;
export const DAY_TINTS = ["rgb(244, 241, 220)", "rgb(255, 234, 221)", "rgb(231, 231, 231)", "rgb(255, 240, 249)"];
export const BORDER_DARK = "rgb(153, 153, 153)";   // card outlines
export const BORDER_LIGHT = "rgb(204, 204, 204)";  // inner row separators

// Same per-week column widths + fixed-layout stretch as the reference sheet,
// so weekend cards line up with CLM cards on the notice board.
export const WEEK_COLS = [
  [37.52, 51.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 200.66],
  [36.52, 52.53, 12.50, 26.51, 201.66],
  [37.52, 52.53, 12.50, 26.51, 201.66],
];
export const EDGE_W = 25.52;
export const TABLE_SCALE = 2930.80 / 2784.69;

// Full document wrapper (quirks mode, web fonts).
export const docHtml = (css, body) => `<html><head><meta charset="UTF-8"><title>Schedule</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;700&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
${body}
</body></html>`;

// Cell-role CSS shared by the family (mirrors the reference classes).
export const cellCss = (width) => `
body{margin:0;background:#fff}
table{border-collapse:separate;border-spacing:0;table-layout:fixed;width:${width}px}
td,th{box-sizing:content-box;overflow:hidden;line-height:normal;white-space:normal;word-wrap:break-word;--day:#fff;--sec:#999;background:var(--day)}
img{max-width:none;display:inline-block;vertical-align:top}
.brk{font-size:2.66667px}
.note-hi{color:rgb(152, 0, 0)}
.title{background:#fff;color:#000;font-family:${FONT};font-size:17.3333px;font-weight:700;text-align:center;vertical-align:middle;border-right:0.5px solid #fff;border-bottom:2.5px solid #fff;padding:2px 3px 2px 3px}
.daydate{background:var(--day);color:#000;font-family:${FONT};font-size:16px;font-weight:700;text-align:center;vertical-align:middle;border:1.5px solid ${BORDER_DARK};border-top:0;padding:2px 3px 2px 3px}
.section{background:#fff;color:var(--sec);font-family:${FONT};font-size:13.3333px;font-weight:700;text-align:center;vertical-align:middle;border:1.5px solid var(--sec);padding:2px 3px 2px 3px}
.sec-icon{background:var(--sec);color:#fff;font-family:${FONT};font-size:13.3333px;font-weight:700;text-align:center;vertical-align:middle;border:1.5px solid var(--sec);padding:0}
.label{background:var(--day);color:#000;font-family:${FONT};font-size:13.3333px;text-align:right;vertical-align:middle;border-right:1.5px solid ${BORDER_DARK};border-bottom:0.5px solid color(srgb 0 0 0 / 0.15);padding:2px 3px 2px 3px;border-left:1.5px solid ${BORDER_DARK}}
.assignee{background:#fff;color:#000;font-family:${FONT};font-size:14.6667px;text-align:left;vertical-align:middle;border-right:1.5px solid ${BORDER_DARK};border-bottom:0.5px solid ${BORDER_LIGHT};padding:2px 3px 2px 3px}
.hint{font-size:12px;color:rgb(90, 90, 90)}
.note{background:#fff;color:#000;font-family:${FONT};font-size:13.3333px;font-weight:700;text-align:left;vertical-align:middle;border-right:0.5px solid #fff;border-bottom:0.5px solid #fff;padding:2px 3px 2px 3px}
.divider{background:#fff;color:#000;font-family:${FONT};font-size:13.3333px;text-align:right;vertical-align:middle;border-right:0.5px solid #fff;padding:2px 3px 2px 3px}
.edge{background:#fff;color:#000;font-family:${FONT};font-size:14.6667px;text-align:left;border-bottom:1.5px solid #fff;padding:2px 3px 2px 3px}
.rule{background:#fff;color:#000;font-family:${FONT};font-size:13.3333px;text-align:center;vertical-align:middle;border-right:0.5px solid #fff;border-bottom:1.5px solid ${BORDER_DARK};padding:2px 3px 2px 3px}
.spacer{background:#fff;color:#000;font-family:${FONT};font-size:14.6667px;font-weight:700;text-align:left;border-right:0.5px solid #fff;border-bottom:0.5px solid #fff;padding:2px 3px 2px 3px}
.front.spacer{border-bottom:0.5px solid ${BORDER_LIGHT}}
.prayer{border-bottom:1.5px solid ${BORDER_DARK}}
`;

// Title (heading) row used by month sheets.
export const titleRow = (totalCols, title, month) =>
  `<tr style="height:69.56px"><td class="title" colspan="${totalCols}">${esc(title)}<span class="brk"><br class="brk"><br class="brk"></span>${esc(month)}</td></tr>`;

// குறிப்பு block (gap row + up to 3 numbered HTML notes), same as the CLM sheet.
export function noteRows(totalCols, notes, noteLabel = "குறிப்பு:") {
  const sp = (n) => `<td class="spacer"></td>`.repeat(Math.max(0, n));
  let h = `<tr style="height:14.55px">${sp(totalCols)}</tr>`;
  if (notes && notes.length) {
    const span = Math.min(11, totalCols - 1);
    const lead = Math.min(5, totalCols - span);
    const body = notes.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join("<br><br>");
    const grow = (Math.min(3, notes.length) - 1) * 44;
    h += `<tr style="height:16.55px">${sp(lead)}<td class="note" colspan="${span}" rowspan="3">${esc(noteLabel)} <br><br>${body}</td>${sp(totalCols - lead - span)}</tr>`;
    h += `<tr style="height:${px(35.55 + grow)}px">${sp(totalCols - span)}</tr><tr style="height:20.70px">${sp(totalCols - span)}</tr>`;
  } else {
    h += `<tr style="height:16.55px">${sp(totalCols)}</tr><tr style="height:35.55px">${sp(totalCols)}</tr><tr style="height:20.70px">${sp(totalCols)}</tr>`;
  }
  return h;
}
