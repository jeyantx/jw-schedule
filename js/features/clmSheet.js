// ============================================================================
// CLM export HTML — matched to the reference Google-Sheet ("CLM 2026") tokens:
//   section colours  teal #3c7f8b · gold #d68f00 · red #bf2f13
//   borders          section-colour (2px) between rows, #999999 verticals
//   font             Noto Sans Tamil, 10pt body / 13pt headers, 2px 3px padding
// Per-week pastel tints (image-derived in the sheet) arrive with the weekly-image
// feature; until then number/min cells use a light tint of the section colour.
// ============================================================================
import { fmtDate, monthName } from "../state.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SECS = [
  { key: "treasures", color: "#3c7f8b", tint: "#e9fcff", icon: "💎", en: "Treasures From the Bible",            ta: "பைபிளில் இருக்கும் புதையல்கள்" },
  { key: "apply",     color: "#d68f00", tint: "#fff2d6", icon: "🌾", en: "Apply Yourself to the Field Ministry", ta: "ஊழியத்தை நன்றாகச் செய்யுங்கள்" },
  { key: "living",    color: "#bf2f13", tint: "#ffe2dd", icon: "🐑", en: "Living as Christians",                 ta: "கிறிஸ்தவர்களாக வாழுங்கள்" },
];

const readerId = (p) => (typeof p.reader === "string" ? p.reader : null);
const isCbs = (p) => p.cbs === true || p.reader === true || readerId(p) != null;

export function buildClmHtml(weeks, { congName, month, lang, name }) {
  const L = lang === "ta"
    ? { chairman: "சேர்மன்", prayer: "ஜெபம்", reading: "வாசிப்பு" }
    : { chairman: "Chairman", prayer: "Prayer", reading: "Reading" };
  const titleText = lang === "ta"
    ? `${esc(congName)} சபையின் - நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்திற்கான அட்டவணை`
    : `${esc(congName)} — Our Christian Life and Ministry Schedule`;

  const cards = weeks.map((w) => {
    let h = `<div class="week">`;
    h += `<div class="wk-head">${esc(fmtDate(w.date, lang))}</div>`;
    h += lrow(L.chairman, w.chairman ? name(w.chairman) : "");
    h += lrow(L.prayer, w.openingPrayer ? name(w.openingPrayer) : "");

    for (const sec of SECS) {
      const parts = (w.sections && w.sections[sec.key]) || [];
      h += `<div class="sec" style="background:${sec.color};border-bottom-color:${sec.color}">`
         + `<span class="ic">${sec.icon}</span><span class="st">${esc(sec[lang] || sec.en)}</span></div>`;
      const bc = sec.color, tint = sec.tint;
      for (const p of parts) {
        const cbs = sec.key === "living" && isCbs(p);
        const main = p.assignee ? name(p.assignee) : (p.title || "");
        const nameHtml = (!cbs && p.assistant) ? `${esc(main)}<div class="sub">${esc(name(p.assistant))}</div>` : esc(main);
        h += `<div class="prow" style="border-bottom-color:${bc}">`
           + `<div class="n" style="background:${tint}">${p.no ?? ""}</div>`
           + `<div class="m" style="background:${tint}">${p.min ? p.min + " min" : ""}</div>`
           + `<div class="v">${nameHtml}</div></div>`;
        if (cbs) h += `<div class="prow" style="border-bottom-color:${bc}">`
           + `<div class="n" style="background:${tint}"></div>`
           + `<div class="m rd" style="background:${tint}">${L.reading}</div>`
           + `<div class="v">${esc(readerId(p) ? name(readerId(p)) : "")}</div></div>`;
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
    html,body{font-family:'Noto Sans Tamil',Arial,sans-serif;color:#000;background:#fff}
    .page{width:1480px;padding:26px 30px}
    .title{text-align:center;font-weight:700;font-size:14pt;line-height:1.3}
    .month{text-align:center;font-weight:700;font-size:12pt;margin:2px 0 16px}
    .grid{display:flex;gap:0}
    .week{flex:1;border-left:2px solid #999;border-top:2px solid #999}
    .week:last-child{border-right:2px solid #999}
    .wk-head{border-bottom:2px solid #999;background:#efefef;text-align:center;font-weight:700;font-size:11pt;padding:9px 4px;min-height:46px;display:flex;align-items:center;justify-content:center}
    .lrow{display:grid;grid-template-columns:60px 1fr;border-bottom:1px solid #999}
    .lrow .l{background:#efefef;border-right:1px solid #999;font-size:10pt;padding:3px 4px;display:flex;align-items:center}
    .lrow .v{font-size:10pt;font-weight:600;padding:3px 5px;display:flex;align-items:center;min-height:26px}
    .sec{border-bottom:2px solid;color:#fff;font-weight:700;font-size:10pt;padding:4px 6px;display:flex;align-items:center;gap:6px;overflow:hidden}
    .sec .ic{width:16px;height:16px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
    .sec .st{white-space:nowrap}
    .prow{display:grid;grid-template-columns:26px 54px 1fr;border-bottom:2px solid}
    .prow .n{border-right:1px solid #999;font-weight:700;font-size:10pt;text-align:center;padding:3px 2px;display:flex;align-items:center;justify-content:center}
    .prow .m{border-right:1px solid #999;font-size:9pt;text-align:center;padding:3px 3px;white-space:nowrap;display:flex;align-items:center;justify-content:center}
    .prow .m.rd{font-size:9pt}
    .prow .v{font-size:10pt;font-weight:600;padding:3px 5px;min-height:26px;display:flex;flex-direction:column;justify-content:center}
    .prow .v .sub{font-weight:600;margin-top:3px}
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
