// ============================================================================
// CLM export HTML — faithful reproduction of the reference Google-Sheet
// ("CLM 2026"), verified against its live computed styles:
//   • Section header = small colour icon box (38px) + WHITE title cell with
//     bold CENTRED coloured text and a coloured 2px underline (NOT a solid bar).
//   • Columns: number 38px (centre, bold 11pt) · min 52px (centre, 10pt) ·
//     name ~230px (left, 11pt regular). Verticals #999, inner rows #ccc.
//   • Colours: teal #3c7f8b · gold #d68f00 · red #bf2f13. Fonts Noto Sans Tamil.
//   • Per-week pastel (header/label/number/min) is image-derived in the sheet,
//     so it finalises with the weekly-image feature; a neutral cycle is used now.
// ============================================================================
import { fmtDate, monthName } from "../state.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SECS = [
  { key: "treasures", color: "#3c7f8b", icon: "💎", en: "Treasures From the Bible",            ta: "பைபிளில் இருக்கும் புதையல்கள்" },
  { key: "apply",     color: "#d68f00", icon: "🌾", en: "Apply Yourself to the Field Ministry", ta: "ஊழியத்தை நன்றாகச் செய்யுங்கள்" },
  { key: "living",    color: "#bf2f13", icon: "🐑", en: "Living as Christians",                 ta: "கிறிஸ்தவர்களாக வாழுங்கள்" },
];
const PASTELS = ["#f4ede6", "#eeecf6", "#ededed", "#fffee9", "#fff0f9"];

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
    h += `<div class="wk-head">${esc(fmtDate(w.date, lang))}</div>`;
    h += lrow(L.chairman, w.chairman ? name(w.chairman) : "");
    h += lrow(L.prayer, w.openingPrayer ? name(w.openingPrayer) : "");

    for (const sec of SECS) {
      const parts = (w.sections && w.sections[sec.key]) || [];
      h += `<div class="sec">`
         + `<div class="ic" style="background:${sec.color};border-bottom-color:${sec.color}">${sec.icon}</div>`
         + `<div class="st" style="color:${sec.color};border-bottom-color:${sec.color}">${esc(sec[lang] || sec.en)}</div></div>`;
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
    html,body{font-family:'Noto Sans Tamil',Arial,sans-serif;color:#000;background:#fff}
    .page{padding:24px 28px;width:max-content}
    .title{text-align:center;font-weight:700;font-size:13pt;line-height:1.35}
    .month{text-align:center;font-weight:700;font-size:13pt;margin-bottom:16px}
    .grid{display:flex;gap:14px;align-items:flex-start}
    .week{width:320px;border:2px solid #999}
    .wk-head{background:var(--pastel);border-bottom:2px solid #999;text-align:center;font-weight:700;font-size:12pt;padding:12px 4px;min-height:56px;display:flex;align-items:center;justify-content:center}
    .lrow{display:grid;grid-template-columns:90px 1fr;border-bottom:1px solid #ccc}
    .lrow .l{background:var(--pastel);border-right:2px solid #999;font-size:10pt;padding:4px 6px;text-align:right;display:flex;align-items:center;justify-content:flex-end}
    .lrow .v{font-size:11pt;padding:4px 6px;display:flex;align-items:center;min-height:30px}
    .sec{display:grid;grid-template-columns:38px 1fr}
    .sec .ic{border-bottom:2px solid;border-right:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:13px;min-height:30px}
    .sec .st{background:#fff;border-bottom:2px solid;border-right:2px solid #999;font-weight:700;font-size:10pt;text-align:center;padding:4px 4px;display:flex;align-items:center;justify-content:center;white-space:nowrap}
    .prow{display:grid;grid-template-columns:38px 52px 1fr;border-bottom:1px solid #ccc}
    .prow .n{background:var(--pastel);border-right:1px solid #999;font-weight:700;font-size:11pt;text-align:center;padding:4px 2px;display:flex;align-items:center;justify-content:center}
    .prow .m{background:var(--pastel);border-right:2px solid #999;font-size:10pt;text-align:center;padding:4px 3px;white-space:nowrap;display:flex;align-items:center;justify-content:center}
    .prow .v{font-size:11pt;padding:4px 6px;min-height:30px;display:flex;flex-direction:column;justify-content:center}
    .prow .v .sub{margin-top:6px}
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
