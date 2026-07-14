// ============================================================================
// CLM export HTML — a pixel-match of the printed workbook sheet: month title,
// up to 5 week columns, per-week pastel tint on the label/number column, teal/
// gold/red section bars, two-name demonstrations, and the வாசிப்பு (reading)
// sub-row for the Congregation Bible Study. Self-contained (inline CSS + Noto
// Sans Tamil) for the SmartBrowz PDF backend.
// ============================================================================
import { fmtDate, monthName } from "../state.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Section bars — colour + bilingual header + placeholder icon (swap for the real
// white workbook icons when available).
const SECS = [
  { key: "treasures", color: "#1a8f7e", icon: "💎", en: "Treasures From the Bible",            ta: "பைபிளில் இருக்கும் புதையல்கள்" },
  { key: "apply",     color: "#c8940c", icon: "🌾", en: "Apply Yourself to the Field Ministry", ta: "ஊழியத்தை நன்றாகச் செய்யுங்கள்" },
  { key: "living",    color: "#b0392e", icon: "🐑", en: "Living as Christians",                 ta: "கிறிஸ்தவர்களாக வாழுங்கள்" },
];
const PASTELS = ["#f2ede4", "#eeecf6", "#efefef", "#fbf7e6", "#fbe9e9"];

const readerId = (p) => (typeof p.reader === "string" ? p.reader : null);
const isCbs = (p) => p.cbs === true || p.reader === true || readerId(p) != null;

export function buildClmHtml(weeks, { congName, month, lang, name }) {
  const L = lang === "ta"
    ? { chairman: "சேர்மன்", prayer: "ஜெபம்", reading: "வாசிப்பு" }
    : { chairman: "Chairman", prayer: "Prayer", reading: "Reading" };
  const titleText = lang === "ta"
    ? `${esc(congName)} சபையின் - நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்திற்கான அட்டவணை`
    : `${esc(congName)} — Our Christian Life and Ministry Schedule`;

  const cards = weeks.map((w, i) => {
    const pastel = PASTELS[i % PASTELS.length];
    let h = `<div class="week" style="--pastel:${pastel}">`;
    h += `<div class="wk-head"><span class="wk-date">${esc(fmtDate(w.date, lang))}</span></div>`;
    h += lrow(L.chairman, w.chairman ? name(w.chairman) : "");
    h += lrow(L.prayer, w.openingPrayer ? name(w.openingPrayer) : "");

    for (const sec of SECS) {
      const parts = (w.sections && w.sections[sec.key]) || [];
      h += `<div class="sec" style="background:${sec.color}"><span class="ic">${sec.icon}</span><span class="st">${esc(sec[lang] || sec.en)}</span></div>`;
      for (const p of parts) {
        const cbs = sec.key === "living" && isCbs(p);
        const main = p.assignee ? name(p.assignee) : (p.title || "");
        const nameHtml = (!cbs && p.assistant) ? `${esc(main)}<div class="sub">${esc(name(p.assistant))}</div>` : esc(main);
        h += `<div class="prow"><div class="n">${p.no ?? ""}</div><div class="m">${p.min ? p.min + " min" : ""}</div><div class="v">${nameHtml}</div></div>`;
        if (cbs) h += `<div class="prow"><div class="n"></div><div class="m rd">${L.reading}</div><div class="v">${esc(readerId(p) ? name(readerId(p)) : "")}</div></div>`;
      }
    }
    h += lrow(L.prayer, w.closingPrayer ? name(w.closingPrayer) : "");
    return h + `</div>`;
  }).join("");

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{font-family:'Noto Sans Tamil',sans-serif;color:#1a1a1a;background:#fff}
    .page{width:1660px;padding:28px 32px}
    .title{text-align:center;font-weight:800;font-size:19px}
    .month{text-align:center;font-weight:800;font-size:16px;margin:3px 0 18px}
    .grid{display:flex;gap:8px;align-items:flex-start}
    .week{flex:1;border:1px solid #9a9a9a;border-top:none}
    .week > *{border-top:1px solid #9a9a9a}
    .wk-head{background:var(--pastel);min-height:60px;display:flex;align-items:center;justify-content:center;padding:8px}
    .wk-date{font-weight:800;font-size:15px;text-align:center}
    .lrow{display:grid;grid-template-columns:58px 1fr}
    .lrow .l{background:var(--pastel);padding:7px 6px;font-size:12px;color:#222;border-right:1px solid #9a9a9a;display:flex;align-items:center}
    .lrow .v{padding:7px 9px;font-size:13.5px;font-weight:600;display:flex;align-items:center;min-height:32px}
    .sec{display:flex;align-items:center;gap:7px;padding:5px 8px;color:#fff;font-weight:700;overflow:hidden}
    .sec .ic{width:18px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:13px}
    .sec .st{font-size:12px;white-space:nowrap}
    .prow{display:grid;grid-template-columns:22px 50px 1fr}
    .prow .n{background:var(--pastel);font-weight:800;text-align:center;font-size:13px;border-right:1px solid #9a9a9a;display:flex;align-items:center;justify-content:center}
    .prow .m{background:var(--pastel);padding:7px 5px;font-size:11.5px;color:#333;border-right:1px solid #9a9a9a;display:flex;align-items:center}
    .prow .v{padding:7px 9px;font-size:13.5px;font-weight:600;min-height:32px}
    .prow .v .sub{font-weight:600;margin-top:5px}
  </style></head><body>
    <div class="page">
      <div class="title">${titleText}</div>
      <div class="month">${esc(monthName(month, lang))}</div>
      <div class="grid">${cards}</div>
    </div>
  </body></html>`;

  function lrow(label, value) {
    return `<div class="lrow"><div class="l">${esc(label)}</div><div class="v">${esc(value)}</div></div>`;
  }
}
