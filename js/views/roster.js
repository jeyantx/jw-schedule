// ============================================================================
// ROSTER — a reusable month table + editor that powers the simple schedules
// (Audio/Video, Cleaning, Field Service, Attendants). Config-driven per kind.
// ============================================================================
import { store, uid } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, modal, combo, confirmDialog } from "../ui.js";
import { S, inMonth, monthName, fmtDate } from "../state.js";

const SCHEMA = {
  av: { title: "av", dateField: "date", cols: [
    { key: "date", type: "date", en: "Date", ta: "தேதி" },
    { key: "console", type: "person", role: "av.console", en: "Console", ta: "கன்சோல்" },
    { key: "stage", type: "person", role: "av.stage", en: "Stage", ta: "மேடை" },
    { key: "roving", type: "person", role: "av.roving", en: "Roving", ta: "மைக்" },
  ]},
  cleaning: { title: "cleaning", dateField: "weekOf", cols: [
    { key: "weekOf", type: "date", en: "Week of", ta: "வாரம்" },
    { key: "groupId", type: "group", en: "Group", ta: "குழு" },
    { key: "area", type: "text", en: "Area", ta: "பகுதி" },
  ]},
  fsm: { title: "fsm", dateField: "date", cols: [
    { key: "date", type: "date", en: "Date", ta: "தேதி" },
    { key: "time", type: "text", en: "Time", ta: "நேரம்" },
    { key: "place", type: "text", en: "Place", ta: "இடம்" },
    { key: "conductor", type: "person", role: "fsm.conductor", en: "Conductor", ta: "நடத்துபவர்" },
  ]},
  attendant: { title: "attendant", dateField: "date", cols: [
    { key: "date", type: "date", en: "Date", ta: "தேதி" },
    { key: "attendants", type: "people", role: "attendant.attendant", en: "Attendants", ta: "வரவேற்பாளர்கள்" },
  ]},
};

export function makeRoster(kind) {
  return function renderRoster() {
    const lang = getLang();
    const cfg = SCHEMA[kind];
    const canEdit = store.canEditKind(kind);
    const pubs = store.get("publishers");
    const groups = store.get("groups");
    const pubName = (id) => pubs.find((p) => p.id === id)?.name || id || "";
    const groupName = (id) => groups.find((g) => g.id === id)?.name || "";

    const rows = store.get(kind).filter((r) => inMonth(r[cfg.dateField])).sort((a, b) => (a[cfg.dateField] || "").localeCompare(b[cfg.dateField] || ""));

    const display = (col, r) => {
      const v = r[col.key];
      if (col.type === "date") return fmtDate(v, lang);
      if (col.type === "person") return v ? el("span", { class: "ta" }, pubName(v)) : el("span", { class: "muted" }, "—");
      if (col.type === "group") return el("span", { class: "ta" }, groupName(v) || "—");
      if (col.type === "people") return (v && v.length) ? el("div", { class: "row wrap" }, v.map((id) => el("span", { class: "chip ta" }, pubName(id)))) : el("span", { class: "muted" }, "—");
      return el("span", { class: "ta" }, v || "—");
    };

    const tbody = el("tbody");
    rows.forEach((r) => {
      tbody.append(el("tr", { class: canEdit ? "row-click" : "", onClick: canEdit ? () => openEditor(r) : null },
        ...cfg.cols.map((c) => el("td", {}, display(c, r))),
        el("td", {}, canEdit ? icon("pencil", 15) : null)));
    });

    const table = rows.length ? el("div", { class: "tbl-wrap" },
      el("table", { class: "tbl" },
        el("thead", {}, el("tr", {}, ...cfg.cols.map((c) => el("th", {}, c[lang] || c.en)), el("th", {}, ""))),
        tbody))
      : el("div", { class: "empty" }, icon(kind === "cleaning" ? "broom" : kind === "av" ? "volume" : kind === "fsm" ? "briefcase" : "door", 40),
          el("p", {}, `${monthName(S.month, lang)}`), canEdit ? el("p", { class: "hint" }, `${t("add")} ↑`) : null);

    const head = el("div", { class: "view-head spread wrap" },
      el("div", {}, el("h2", {}, t(cfg.title)), el("p", {}, monthName(S.month, lang))),
      canEdit ? el("button", { class: "btn btn-primary", onClick: () => openEditor(null) }, icon("plus", 16), t("add")) : null);

    return el("div", { class: "view" }, head, table);

    /* ---- editor modal ---- */
    function openEditor(rec) {
      const isNew = !rec;
      const draft = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid(kind[0]) };
      const fields = [];
      cfg.cols.forEach((c) => {
        let control;
        if (c.type === "date") control = el("input", { class: "input", type: "date", value: draft[c.key] || monthFirst() });
        else if (c.type === "text") control = el("input", { class: "input", value: draft[c.key] || "" });
        else if (c.type === "group") control = el("select", { class: "select" }, el("option", { value: "" }, "—"),
          ...groups.map((g) => el("option", { value: g.id, selected: draft[c.key] === g.id }, g.name)));
        else if (c.type === "person") control = combo({ options: personOpts(c.role), value: draft[c.key] || null, placeholder: c[lang] || c.en,
          onSelect: (v) => { draft[c.key] = v; } });
        else if (c.type === "people") { draft[c.key] = draft[c.key] || []; control = peoplePicker(draft, c); }
        control.dataset && (control.dataset.k = c.key);
        fields.push(el("div", { class: "field" }, el("label", {}, c[lang] || c.en), control));
      });

      modal({
        title: isNew ? t("add") : t("edit"),
        body: el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } }, fields),
        actions: [
          !isNew ? { label: t("delete"), class: "btn-danger", onClick: async (close) => {
            if (!(await confirmDialog(t("confirmDelete")))) return;
            store.set(kind, store.get(kind).filter((x) => x.id !== draft.id)); close(); toast(t("saved"), "ok");
          } } : null,
          { label: t("cancel"), onClick: (c) => c() },
          { label: t("save"), class: "btn-primary", onClick: (close) => {
            // pull plain inputs (date/text/group) from DOM
            fields.forEach((f) => { const inp = f.querySelector("[data-k]"); if (inp && (inp.tagName === "INPUT" || inp.tagName === "SELECT")) draft[inp.dataset.k] = inp.value || (inp.type === "date" ? "" : inp.value); });
            if (!draft[cfg.dateField]) { toast(t("required"), "danger"); return; }
            const arr = store.get(kind).slice();
            const i = arr.findIndex((x) => x.id === draft.id);
            if (i >= 0) arr[i] = draft; else arr.push(draft);
            store.set(kind, arr); close(); toast(t("saved"), "ok");
          } },
        ].filter(Boolean),
      });
    }

    function personOpts(role) {
      return pubs.filter((p) => p.active !== false && (!role || (p.roles || []).includes(role)))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((p) => ({ value: p.id, label: p.name }));
    }
    function peoplePicker(draft, c) {
      const box = el("div", { class: "row wrap", style: { gap: "6px" } });
      const paint = () => { box.replaceChildren(); pubs.filter((p) => (p.roles || []).includes(c.role) && p.active !== false).forEach((p) => {
        const on = draft[c.key].includes(p.id);
        box.append(el("button", { type: "button", class: `chip ta ${on ? "accent" : ""}`, onClick: () => {
          const i = draft[c.key].indexOf(p.id); if (i >= 0) draft[c.key].splice(i, 1); else draft[c.key].push(p.id); paint();
        } }, p.name)); }); };
      paint(); return box;
    }
  };
}
const monthFirst = () => `${S.month.getFullYear()}-${String(S.month.getMonth() + 1).padStart(2, "0")}-01`;
