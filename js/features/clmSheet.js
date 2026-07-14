// ============================================================================
// CLM export HTML — matched to the reference Google-Sheet ("CLM 2026"):
//   section bars   teal #3c7f8b · gold #d68f00 · red #bf2f13, white CENTERED title
//   row borders    the section colour (2px) between parts, #999999 verticals
//   left column    per-week pastel (header + சேர்மன்/ஜெபம் + number + min);
//                  name column stays white
//   font           Noto Sans Tamil, 10pt body / 13–14pt headers, tight padding
// The weekly illustration goes in the header once the image feature lands; the
// pastel below is the per-week theme.
// ============================================================================
import { fmtDate, monthName } from "../state.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const SECS = [
  { key: "treasures", color: "#3c7f8b", icon: "💎", en: "Treasures From the Bible",            ta: "பைபிளில் இருக்கும் புதையல்கள்" },
  { key: "apply",     color: "#d68f00", icon: "🌾", en: "Apply Yourself to the Field Ministry", ta: "ஊழியத்தை நன்றாகச் செய்யுங்கள்" },
  { key: "living",    color: "#bf2f13", icon: "🐑", en: "Living as Christians",                 ta: "கிறிஸ்தவர்களாக வாழுங்கள்" },
];
// Per-week theme pastels (beige · lavender · grey · cream · pink) — the weekly image's tint.
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
      h += `<div class="sec" style="background:${sec.color};border-bottom-color:${sec.color}">`
         + `<span class="ic">${sec.icon}</span><span class="st">${esc(sec[lang] || sec.en)}</span></div>`;
      for (const p of parts) {
        const cbs = sec.key === "living" && isCbs(p);
        const main = p.assignee ? name(p.assignee) : (p.title || "");
        const nameHtml = (!cbs && p.assistant) ? `${esc(main)}<div class="sub">${esc(name(p.assistant))}</div>` : esc(main);
        h += `<div class="prow" style="border-bottom-color:${sec.color}">`
           + `<div class="n">${p.no ?? ""}</div><div class="m">${p.min ? p.min + " min" : ""}</div>`
           + `<div class="v">${nameHtml}</div></div>`;
        if (cbs) h += `<div class="prow" style="border-bottom-color:${sec.color}">`
           + `<div class="n"></div><div class="m rd">${L.reading}</div>`
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
    .wk-head{border-bottom:2px solid #999;background:var(--pastel);text-align:center;font-weight:700;font-size:11pt;padding:10px 4px;min-height:52px;display:flex;align-items:center;justify-content:center}
    .lrow{display:grid;grid-template-columns:64px 1fr;border-bottom:1px solid #999}
    .lrow .l{background:var(--pastel);border-right:1px solid #999;font-size:10pt;padding:4px 6px;text-align:right;display:flex;align-items:center;justify-content:flex-end}
    .lrow .v{font-size:10pt;font-weight:600;padding:4px 6px;display:flex;align-items:center;min-height:28px}
    .sec{position:relative;border-bottom:2px solid;color:#fff;font-weight:700;font-size:10pt;padding:5px 8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .sec .ic{position:absolute;left:6px;top:50%;transform:translateY(-50%);width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
    .sec .st{white-space:nowrap;text-align:center}
    .prow{display:grid;grid-template-columns:26px 54px 1fr;border-bottom:2px solid}
    .prow .n{background:var(--pastel);border-right:1px solid #999;font-weight:700;font-size:10pt;text-align:center;padding:4px 2px;display:flex;align-items:center;justify-content:center}
    .prow .m{background:var(--pastel);border-right:1px solid #999;font-size:9pt;text-align:center;padding:4px 3px;white-space:nowrap;display:flex;align-items:center;justify-content:center}
    .prow .v{font-size:10pt;font-weight:600;padding:4px 6px;min-height:28px;display:flex;flex-direction:column;justify-content:center}
    .prow .v .sub{font-weight:600;margin-top:4px}
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
