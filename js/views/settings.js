// ============================================================================
// SETTINGS — congregation info, language/theme, and full backup export/import.
// ============================================================================
import { store } from "../store.js";
import { KINDS } from "../config.js";
import { getLang, setLang, t } from "../i18n.js";
import { el, icon, toast, confirmDialog } from "../ui.js";

export function renderSettings() {
  const lang = getLang();
  const c = store.congregation || {};

  const infoCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, t("settings")),
    row(t("congName"), el("span", { class: "ta", style: { fontWeight: 700 } }, c.name || "—")),
    row("Code", el("span", { class: "chip accent" }, c.code || "—")),
    row(t("owner"), el("span", {}, c.ownerEmail || "—")));

  const langBtn = el("button", { class: "btn", onClick: () => { setLang(lang === "ta" ? "en" : "ta"); location.reload(); } },
    icon("globe", 16), lang === "ta" ? "தமிழ் / English" : "English / தமிழ்");
  const themeBtn = el("button", { class: "btn", onClick: () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; localStorage.setItem("jw_theme", next);
  } }, icon("moon", 16), t("theme"));

  const prefCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, `${t("language")} · ${t("theme")}`),
    el("div", { class: "row wrap" }, langBtn, themeBtn));

  const exportBtn = el("button", { class: "btn", onClick: doExport }, icon("download", 16), "Export backup");
  const importInput = el("input", { type: "file", accept: "application/json", style: { display: "none" }, onchange: doImport });
  const importBtn = el("button", { class: "btn", onClick: () => importInput.click() }, icon("copy", 16), "Import backup");

  const backupCard = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, t("backup")),
    el("p", { class: "hint", style: { marginBottom: "12px" } }, "Download every schedule document as one JSON file, or restore from one."),
    el("div", { class: "row wrap" }, exportBtn, importBtn, importInput));

  return el("div", { class: "view" },
    el("div", { class: "view-head" }, el("h2", {}, t("settings"))),
    el("div", { style: { display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" } }, infoCard, prefCard, backupCard));

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
