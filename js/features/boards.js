// ============================================================================
// BOARDS — maps app data + per-congregation preferences (meta.sheet) to the
// printable board templates. Views call these to export monthly PDFs and
// weekly WhatsApp cards; keeping the mapping here makes it unit-testable.
//
// meta.sheet = {
//   theme: "light-1",                              // THEMES key
//   custom: { frame?, wed?, sun?, accents: {} },   // colour overrides
//   cleaningFormat: "parts",       // group | group-incharge | parts | parts-incharge
//   cleaningPartA / cleaningPartB, // custom part labels (Tamil/any text)
//   attendantFormat: "2" | "3",    // hall+entrance (+ video conferencing)
//   tints: [..4 colours],          // CLM sheet day tints
//   guidelines: { av, cleaning, fsm, attendant, weekend },  // shown under boards
// }
// ============================================================================
import { store } from "../store.js";
import { getLang } from "../i18n.js";
import { fmtDate } from "../state.js";
import { renderRoleBoard, renderDateBoard, renderBoardCard, resolveTheme } from "./boardTemplate.js";

const lang = () => getLang();
const L = (ta, en) => (lang() === "ta" ? ta : en);

export const sheetPrefs = () => ({
  theme: "light-1", cleaningFormat: "parts", attendantFormat: "2",
  ...((store.get("meta") || {}).sheet || {}),
});
export function boardTheme(prefs = sheetPrefs()) {
  const base = resolveTheme(prefs.theme);
  const c = prefs.custom || {};
  return { ...base, ...c, accents: { ...base.accents, ...(c.accents || {}) } };
}

// ---- shared helpers ---------------------------------------------------------
export function displayName(idOrText, pubs = store.get("publishers")) {
  if (!idOrText) return "";
  const p = pubs.find((x) => x.id === idOrText);
  if (!p) return String(idOrText); // free text (e.g. visiting speaker)
  if (/^(Br|Sr)\./.test(p.name || "")) return p.name;
  return `${p.gender === "sister" ? "Sr." : "Br."} ${p.name}`;
}
const groupName = (id) => (store.get("groups").find((g) => g.id === id) || {}).name || (id || "");
const shortDate = (iso) => fmtDate(iso, lang()).replace(/,\s*\d{4}$/, "");
const dateObj = (iso) => ({ label: shortDate(iso), iso });
const fullDate = (iso) => ({ label: fmtDate(iso, lang()), iso });
const guideline = (prefs, kind) => ((prefs.guidelines || {})[kind] || "").trim() || undefined;

// ---- per-kind field definitions (drive BOTH the view editors and the boards) --
export function kindFields(kind, prefs = sheetPrefs()) {
  switch (kind) {
    case "av": return [
      { key: "mixer", icon: "mixer", label: L("ஆடியோ மிக்சர்", "Audio Mixer"), type: "person", role: "av.mixer" },
      { key: "media", icon: "media", label: L("மீடியா & Zoom", "Media & Zoom"), type: "person", role: "av.media" },
      { key: "micLeft", icon: "mic", label: L("மைக் - இடது / மேடை", "Mic - Left / Stage"), type: "person", role: "av.mic" },
      { key: "micRight", icon: "mic", label: L("மைக் - வலது", "Mic - Right"), type: "person", role: "av.mic" },
    ];
    case "cleaning": {
      const f = prefs.cleaningFormat;
      const partA = prefs.cleaningPartA || L("பெருக்குதல் & கழிவறை", "Brooming & Toilet");
      const partB = prefs.cleaningPartB || L("துடைத்தல் & மேடை", "Mopping & Stage");
      const rows = f === "group" || f === "group-incharge"
        ? [{ key: "partA", icon: "sparkle", label: L("குழு", "Group"), type: "group" }]
        : [{ key: "partA", icon: "broom", label: partA, type: "group" },
           { key: "partB", icon: "droplet", label: partB, type: "group" }];
      if (f.endsWith("incharge")) rows.push({ key: "incharge", icon: "chair", label: L("பொறுப்பாளர்", "In-charge"), type: "person", role: "cleaning.incharge" });
      return rows;
    }
    case "attendant": {
      const rows = [
        { key: "hall", icon: "users", label: L("மண்டபம்", "Hall"), type: "person", role: "attendant.attendant" },
        { key: "entrance", icon: "door", label: L("நுழைவாயில்", "Entrance"), type: "person", role: "attendant.attendant" },
      ];
      if (prefs.attendantFormat === "3") rows.push({ key: "video", icon: "video", label: L("வீடியோ கான்ஃபரன்ஸ்", "Video Conferencing"), type: "person", role: "attendant.attendant" });
      return rows;
    }
    case "fsm": return [
      { key: "time", icon: "clock", label: L("நேரம்", "Time"), type: "text" },
      { key: "loc", icon: "pin", label: L("கூட்ட இடம்", "Meeting Location"), type: "text" },
      { key: "zoom", icon: "video", label: "Zoom", type: "check" },
      { key: "field", icon: "home", label: L("வெளி ஊழியப் பகுதி", "Field Territory"), type: "text" },
      { key: "conductor", icon: "chair", label: L("நடத்துபவர்", "Conductor"), type: "person", role: "fsm.conductor" },
    ];
  }
  return [];
}
export const kindMeta = (kind) => ({
  av: { icon: "speaker", title: L("ஒலி / ஒளி அமைப்பு", "AUDIO / VIDEO") },
  cleaning: { icon: "sparkle", title: L("சுத்தம் செய்தல்", "CLEANING") },
  attendant: { icon: "users", title: L("வரவேற்பாளர்", "ATTENDANTS") },
  fsm: { icon: "home", title: L("வெளி ஊழியக் கூட்டம்", "FIELD SERVICE MEETING") },
  weekend: { icon: "tower", title: L("வார இறுதி கூட்டம்", "WEEKEND MEETING") },
}[kind]);

const fieldValue = (kind, rec, f) => {
  if (f.type === "person") return displayName(rec[f.key]);
  if (f.type === "group") return groupName(rec[f.key]);
  if (f.type === "check") return rec[f.key] ? "Zoom" : "";
  return rec[f.key] || "";
};

// ---- monthly boards ---------------------------------------------------------
// AV / Cleaning / Attendants → roles left, dates top.
export function roleBoardHtml(kind, records, { congName, month } = {}) {
  const prefs = sheetPrefs();
  const meta = kindMeta(kind);
  const dateField = kind === "cleaning" ? "weekOf" : "date";
  const recs = [...records].sort((a, b) => (a[dateField] || "").localeCompare(b[dateField] || ""));
  const fields = kindFields(kind, prefs).filter((f) => f.type !== "check");
  return renderRoleBoard({
    kind, theme: boardTheme(prefs), lang: lang(),
    title: meta.title, icon: meta.icon,
    congName, month,
    dates: recs.map((r) => dateObj(r[dateField])),
    rows: fields.map((f) => ({ icon: f.icon, label: f.label, cells: recs.map((r) => fieldValue(kind, r, f)) })),
    notes: prefs.notes?.[kind], guideline: guideline(prefs, kind),
  });
}

// FSM → dates left, role columns top.
export function fsmBoardHtml(records, { congName, month } = {}) {
  const prefs = sheetPrefs();
  const meta = kindMeta("fsm");
  const recs = [...records].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return renderDateBoard({
    kind: "fsm", theme: boardTheme(prefs), lang: lang(),
    title: meta.title, icon: meta.icon, congName, month, dateWidth: 112,
    columns: [
      { key: "time", icon: "clock", label: L("நேரம்", "Time"), width: 140 },
      { key: "loc", icon: "pin", label: L("கூட்ட இடம்", "Meeting Location"), align: "left" },
      { key: "field", icon: "home", label: L("வெளி ஊழியப் பகுதி", "Field Territory"), align: "left" },
      { key: "conductor", icon: "chair", label: L("நடத்துபவர்", "Conductor"), width: 175 },
    ],
    rows: recs.map((r) => ({ date: dateObj(r.date), cells: {
      time: r.time || "", loc: { text: r.loc || "", hint: r.zoom ? "+ Zoom" : "" },
      field: r.field || "", conductor: displayName(r.conductor),
    } })),
    guideline: guideline(prefs, "fsm"),
  });
}

// Weekend → dates left, role columns top.
export function weekendBoardHtml(records, { congName, month, notes } = {}) {
  const prefs = sheetPrefs();
  const meta = kindMeta("weekend");
  const recs = [...records].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return renderDateBoard({
    kind: "weekend", theme: boardTheme(prefs), lang: lang(),
    title: meta.title, icon: meta.icon, congName, month, dateWidth: 112,
    columns: [
      { key: "chair", icon: "chair", label: L("சேர்மன்", "Chairman"), width: 155 },
      { key: "talk", icon: "talk", label: L("பொது பேச்சு", "Public Talk"), align: "left" },
      { key: "speaker", icon: "mic", label: L("பேச்சாளர்", "Speaker"), width: 180, align: "left" },
      { key: "cond", icon: "book", label: L("காவற்கோபுரம்", "Watchtower"), width: 145 },
      { key: "reader", icon: "reader", label: L("வாசிப்பு", "Reader"), width: 130 },
    ],
    rows: recs.map((w) => ({ date: dateObj(w.date), cells: {
      chair: displayName(w.chairman),
      talk: { no: w.talk?.number ?? null, text: w.talk?.theme || "" },
      speaker: { text: displayName(w.talk?.speaker), hint: w.talk?.speakerCong || "" },
      cond: displayName(w.wt?.conductor), reader: displayName(w.wt?.reader),
    } })),
    notes, guideline: guideline(prefs, "weekend"),
  });
}

// ---- weekly cards (WhatsApp) --------------------------------------------------
export function weeklyCardHtml(kind, rec) {
  const prefs = sheetPrefs();
  const meta = kindMeta(kind);
  const dateField = kind === "cleaning" ? "weekOf" : "date";
  let fields;
  if (kind === "weekend") {
    fields = [
      { icon: "chair", label: L("சேர்மன்", "Chairman"), value: displayName(rec.chairman) },
      { icon: "talk", label: L("பொது பேச்சு", "Public Talk"), value: `${rec.talk?.number ? rec.talk.number + ". " : ""}${rec.talk?.theme || ""}` },
      { icon: "mic", label: L("பேச்சாளர்", "Speaker"), value: displayName(rec.talk?.speaker) + (rec.talk?.speakerCong ? ` (${rec.talk.speakerCong})` : "") },
      { icon: "book", label: L("காவற்கோபுரம்", "Watchtower"), value: displayName(rec.wt?.conductor) },
      { icon: "reader", label: L("வாசிப்பு", "Reader"), value: displayName(rec.wt?.reader) },
    ];
  } else if (kind === "fsm") {
    fields = kindFields("fsm", prefs).filter((f) => f.type !== "check")
      .map((f) => ({ icon: f.icon, label: f.label, value: f.key === "loc" ? (rec.loc || "") + (rec.zoom ? " + Zoom" : "") : fieldValue(kind, rec, f) }));
  } else {
    fields = kindFields(kind, prefs).map((f) => ({ icon: f.icon, label: f.label, value: fieldValue(kind, rec, f) }));
  }
  return renderBoardCard({
    kind, theme: boardTheme(prefs), lang: lang(),
    title: meta.title, icon: meta.icon,
    date: fullDate(rec[dateField]),
    fields: fields.filter((f) => f.value),
    guideline: undefined,
  });
}
