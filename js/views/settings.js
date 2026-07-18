// ============================================================================
// SETTINGS — congregation info, language/theme, and full backup export/import.
// ============================================================================
import { store } from "../store.js";
import { KINDS } from "../config.js";
import { getLang, getStoredLang, setLang, t } from "../i18n.js";
import { el, icon, toast, confirmDialog } from "../ui.js";
import { THEMES } from "../features/boardTemplate.js";
import { sheetPrefs } from "../features/boards.js";
import { S } from "../state.js";

export function renderSettings() {
  const lang = getLang();
  const c = store.congregation || {};

  const infoCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, t("settings")),
    row(t("congName"), el("span", { class: "ta", style: { fontWeight: 700 } }, c.name || "—")),
    row("Code", el("span", { class: "chip accent" }, c.code || "—")),
    row(t("owner"), el("span", {}, c.ownerEmail || "—")));

  const stored = getStoredLang();
  const langChoice = (value, label) => el("button", {
    class: `chip ${stored === value ? "accent" : ""}`, type: "button",
    style: { display: "inline-flex", gap: "7px", alignItems: "center", padding: "8px 12px" },
    onClick: () => { if (stored !== value) { setLang(value); location.reload(); } },
  }, icon("globe", 16), label);
  const langRow = el("div", { class: "row wrap", style: { gap: "8px" } },
    langChoice("ta", "தமிழ்"),
    langChoice("en", "English"),
    langChoice("mixed", "Mixed — English app · தமிழ் அட்டவணை"));

  const themeBtn = el("button", { class: "btn", onClick: () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("jw_theme", next);
  } }, icon("moon", 16), t("theme"));

  const prefCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, `${t("language")} · ${t("theme")}`),
    el("div", { class: "field" }, el("label", {}, t("language")), langRow),
    el("div", { class: "row wrap", style: { marginTop: "10px" } }, themeBtn));

  const exportBtn = el("button", { class: "btn", onClick: doExport }, icon("download", 16), "Export backup");
  const importInput = el("input", { type: "file", accept: "application/json", style: { display: "none" }, onchange: doImport });
  const importBtn = el("button", { class: "btn", onClick: () => importInput.click() }, icon("copy", 16), "Import backup");

  const backupCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, t("backup")),
    el("p", { class: "hint", style: { marginBottom: "12px" } }, "Download every schedule document as one JSON file, or restore from one."),
    el("div", { class: "row wrap" }, exportBtn, importBtn, importInput));

  /* ---- sheet appearance & formats (per congregation, stored in meta.sheet) ---- */
  const canEditMeta = store.canEditKind("meta");
  const prefs = sheetPrefs();
  const savePrefs = (patch) => {
    const meta = { ...(store.get("meta") || {}) };
    meta.sheet = { ...(meta.sheet || {}), ...patch };
    store.set("meta", meta); toast(t("saved"), "ok");
  };

  const themeRow = el("div", { class: "row wrap", style: { gap: "10px" } },
    ...Object.entries(THEMES).map(([key, th]) => {
      const on = (prefs.theme || "light-1") === key;
      return el("button", { class: `chip ${on ? "accent" : ""}`, disabled: !canEditMeta, style: { display: "inline-flex", gap: "7px", alignItems: "center", padding: "8px 12px" },
        onClick: () => { savePrefs({ theme: key }); location.reload(); } },
        el("span", { style: { display: "inline-flex", gap: "3px" } },
          ...["av", "cleaning", "weekend", "fsm"].map((k) => el("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: th.accents[k], display: "inline-block" } }))),
        th.name);
    }));

  const select = (value, opts, onChange) => {
    const s = el("select", { class: "select", disabled: !canEditMeta, onchange: (e) => onChange(e.target.value) },
      ...opts.map(([v, label]) => el("option", { value: v, selected: value === v }, label)));
    return s;
  };
  const textIn = (value, placeholder, onBlur) => {
    const i = el("input", { class: "input ta", value: value || "", placeholder, disabled: !canEditMeta });
    i.addEventListener("blur", () => onBlur(i.value.trim()));
    return i;
  };

  const ta = lang === "ta";
  const fmtCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, icon("palette", 16), " ", ta ? "அட்டவணை வடிவமைப்பு" : "Sheet appearance"),
    el("div", { class: "field" }, el("label", {}, ta ? "வண்ணத் தீம்" : "Colour theme"), themeRow),
    el("div", { class: "row wrap", style: { gap: "14px", marginTop: "10px" } },
      el("div", { class: "field grow" }, el("label", {}, ta ? "சுத்தம் — வடிவம்" : "Cleaning — format"),
        select(prefs.cleaningFormat, [
          ["group", ta ? "தேதி + குழு" : "Date + group"],
          ["group-incharge", ta ? "தேதி + குழு + பொறுப்பாளர்" : "Date + group + in-charge"],
          ["parts", ta ? "தேதி + பகுதி A + பகுதி B" : "Date + part A + part B"],
          ["parts-incharge", ta ? "தேதி + பகுதி A + B + பொறுப்பாளர்" : "Date + parts + in-charge"],
        ], (v) => { savePrefs({ cleaningFormat: v }); S.refresh && S.refresh(); })),
      el("div", { class: "field grow" }, el("label", {}, ta ? "வரவேற்பாளர் — வடிவம்" : "Attendants — format"),
        select(prefs.attendantFormat, [
          ["2", ta ? "மண்டபம் + நுழைவாயில்" : "Hall + entrance"],
          ["3", ta ? "மண்டபம் + நுழைவாயில் + வீடியோ" : "Hall + entrance + video conf"],
        ], (v) => { savePrefs({ attendantFormat: v }); S.refresh && S.refresh(); })),
      el("div", { class: "field grow" }, el("label", {}, ta ? "பொது பேச்சு அட்டவணை" : "Public talk board"),
        select(String(prefs.weekendExportMonths), [
          ["1", ta ? "1 மாதம்" : "1 month"],
          ["2", ta ? "2 மாதங்கள்" : "2 months"],
          ["3", ta ? "3 மாதங்கள்" : "3 months"],
        ], (v) => { savePrefs({ weekendExportMonths: Number(v) }); S.refresh && S.refresh(); }))),
    el("div", { class: "row wrap", style: { gap: "14px" } },
      el("div", { class: "field grow" }, el("label", {}, ta ? "சுத்தம் பகுதி A பெயர்" : "Cleaning part A label"),
        textIn(prefs.cleaningPartA, ta ? "பெருக்குதல் & கழிவறை" : "Brooming & Toilet", (v) => savePrefs({ cleaningPartA: v || undefined }))),
      el("div", { class: "field grow" }, el("label", {}, ta ? "சுத்தம் பகுதி B பெயர்" : "Cleaning part B label"),
        textIn(prefs.cleaningPartB, ta ? "துடைத்தல் & மேடை" : "Mopping & Stage", (v) => savePrefs({ cleaningPartB: v || undefined })))),
    el("p", { class: "hint", style: { marginTop: "6px" } },
      ta ? "வண்ணங்களும் லேபிள்களும் எல்லா PDF அட்டவணைகளுக்கும் பொருந்தும்." : "Theme colours and labels apply to every exported sheet."));

  return el("div", { class: "view" },
    el("div", { class: "view-head" }, el("h2", {}, t("settings"))),
    el("div", { style: { display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" } }, infoCard, prefCard, fmtCard, backupCard));

  function row(k, v) { return el("div", { class: "spread", style: { padding: "8px 0", borderBottom: "1px solid var(--border)" } }, el("span", { class: "muted" }, k), v); }

  function doExport() {
    const data = {}; KINDS.forEach((k) => (data[k] = store.get(k)));
    const blob = new Blob([JSON.stringify({ congregation: store.congregation, data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(c.name || "congregation").replace(/\s+/g, "-").toLowerCase()}-backup.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast(t("saved"), "ok");
  }
  async function doImport(e) {
    const file = e.target.files[0]; if (!file) return;
    if (!(await confirmDialog("Import will overwrite the current schedules. Continue?", { danger: false }))) { e.target.value = ""; return; }
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed.data || parsed;
      KINDS.forEach((k) => { if (k in data) store.set(k, data[k]); });
      toast(t("saved"), "ok"); store._emit && store._emit();
    } catch (err) { toast("Invalid file", "danger"); }
    e.target.value = "";
  }
}
