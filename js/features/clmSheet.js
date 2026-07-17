// ============================================================================
// CLM export — adapter from the app's week model to the sheet template library
// (clmTemplate.js renders the exact reference design; this file only maps data).
// ============================================================================
import { fmtDate, monthName } from "../state.js";
import { renderClmSheet } from "./clmTemplate.js";

const readerId = (p) => (typeof p.reader === "string" ? p.reader : null);
const isCbs = (p) => p.cbs === true || p.reader === true || readerId(p) != null;

// Single week (WhatsApp reminder) — same design, no title row / notes.
export const buildClmWeekHtml = (week, opts = {}) =>
  buildClmHtml([week], { congName: "", month: new Date(week.date + "T00:00:00"), lang: opts.lang || "ta", ...opts, header: false, footer: false });

export function buildClmHtml(weeks, { congName, month, lang, name, pubs, notes, icons, tints, header, footer }) {
  // Display name with Br./Sr. prefix when we can resolve gender; else raw name.
  const disp = (id) => {
    if (!id) return "";
    const p = (pubs || []).find((x) => x.id === id);
    if (!p) return name ? name(id) : String(id);
    const prefix = p.gender === "sister" ? "Sr." : "Br.";
    return p.name?.startsWith("Br.") || p.name?.startsWith("Sr.") ? p.name : `${prefix} ${p.name}`;
  };
  const main = (p) => (p.assignee ? disp(p.assignee) : (p.title || ""));

  const sorted = [...weeks].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const data = {
    title: lang === "ta"
      ? `${congName} சபையின் - நம் கிறிஸ்தவ வாழ்க்கையும் ஊழியமும் கூட்டத்துக்கான அட்டவணை`
      : `${congName} — Our Christian Life and Ministry Meeting Schedule`,
    month: monthName(month, lang),
    labels: lang === "ta" ? undefined : { chairman: "Chairman", prayer: "Prayer", reading: "Reading", note: "Note:" },
    icons, tints, notes, header, footer,
    weeks: sorted.map((w) => {
      const secs = w.sections || {};
      const livingParts = (secs.living || []).filter((p) => !isCbs(p));
      const cbsPart = (secs.living || []).find(isCbs);
      return {
        date: fmtDate(w.date, lang),
        image: w.image,
        chairman: disp(w.chairman),
        openingPrayer: disp(w.openingPrayer),
        closingPrayer: disp(w.closingPrayer),
        treasures: (secs.treasures || []).map((p) => ({ min: p.min, text: main(p) + (p.assistant ? ` (${disp(p.assistant)})` : "") })),
        ministry: (secs.apply || []).map((p) => (p.assistant
          ? { min: p.min, student: main(p), assistant: disp(p.assistant) }
          : { min: p.min, text: main(p) })),
        living: livingParts.map((p) => ({ min: p.min, text: main(p) })),
        cbs: cbsPart
          ? { min: cbsPart.min ?? 30, conductor: main(cbsPart), reader: disp(readerId(cbsPart)) }
          : { min: 30, conductor: "", reader: "" },
      };
    }),
  };
  return renderClmSheet(data);
}
