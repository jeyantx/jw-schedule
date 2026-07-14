// ============================================================================
// CLM export HTML — builds a self-contained, pixel-matched sheet (inline CSS +
// Noto Sans Tamil web font) for the whole month, POSTed to the PDF backend.
// ============================================================================
import { CLM_SECTIONS } from "../config.js";
import { fmtDate, monthName } from "../state.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function buildClmHtml(weeks, { congName, month, lang, name }) {
  const secColors = { treasures: "#127c71", apply: "#c98a00", living: "#b23b34" };
  const L = lang === "ta"
    ? { chairman: "சேர்மன்", prayer: "ஜெபம்", reading: "வாசிப்பு", min: "நிமி" }
    : { chairman: "Chairman", prayer: "Prayer", reading: "Reading", min: "min" };

  const cards = weeks.map((w) => {
    const secHtml = CLM_SECTIONS.map((sec) => {
      const parts = (w.sections && w.sections[sec.key]) || [];
      const rows = parts.map((p) => {
        const main = p.assignee ? name(p.assignee) : (p.title || "");
        const extra = p.assistant ? ` / ${name(p.assistant)}` : (p.reader ? ` · ${L.reading}: ${name(p.reader)}` : "");
        return `<div class="row"><div class="num">${p.no ?? ""}</div><div class="min">${p.min ? p.min + " " + L.min : ""}</div><div class="val">${esc(main)}${esc(extra)}</div></div>`;
      }).join("");
      return `<div class="sec" style="background:${secColors[sec.key]}">${esc(sec[lang] || sec.en)}</div>${rows}`;
    }).join("");
    return `<div class="week">
      <div class="week-head">${esc(fmtDate(w.date, lang))}</div>
      <div class="row2"><div class="lbl">${L.chairman}</div><div class="val">${esc(w.chairman ? name(w.chairman) : "")}</div></div>
      <div class="row2"><div class="lbl">${L.prayer}</div><div class="val">${esc(w.openingPrayer ? name(w.openingPrayer) : "")}</div></div>
      ${secHtml}
      <div class="row2"><div class="lbl">${L.prayer}</div><div class="val">${esc(w.closingPrayer ? name(w.closingPrayer) : "")}</div></div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{font-family:'Noto Sans Tamil',sans-serif;color:#1f2937}
    .page{width:1600px;padding:34px 40px}
    .title{text-align:center;font-weight:800;font-size:21px}
    .sub{text-align:center;font-weight:700;font-size:15px;color:#374151;margin:4px 0 22px}
    .grid{display:flex;gap:12px;align-items:flex-start}
    .week{flex:1;border:1px solid #d1d5db;border-radius:6px;overflow:hidden}
    .week-head{background:#eef2ff;padding:10px;text-align:center;font-weight:800;font-size:14px;border-bottom:1px solid #d1d5db}
    .row2{display:flex;font-size:12.5px;border-bottom:1px solid #e5e7eb}
    .row2 .lbl{width:70px;padding:6px 8px;color:#6b7280;font-weight:600}
    .row2 .val{flex:1;padding:6px 8px;font-weight:600}
    .sec{padding:7px 10px;color:#fff;font-weight:800;font-size:12.5px}
    .row{display:flex;font-size:12.5px;border-bottom:1px solid #e5e7eb}
    .row .num{width:22px;padding:6px 4px;font-weight:700;text-align:center}
    .row .min{width:56px;padding:6px 4px;color:#6b7280}
    .row .val{flex:1;padding:6px 8px;font-weight:600}
    .week > *:last-child{border-bottom:none}
  </style></head><body><div class="page">
    <div class="title">${esc(congName)} - ${lang === "ta" ? "நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்திற்கான அட்டவணை" : "Our Christian Life and Ministry Schedule"}</div>
    <div class="sub">${esc(monthName(month, lang))}</div>
    <div class="grid">${cards}</div>
  </div></body></html>`;
}
