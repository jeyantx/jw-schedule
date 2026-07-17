// ============================================================================
// WEEKEND — Public Talk (own or visiting speaker) + Watchtower study.
// ============================================================================
import { store, uid } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, modal, combo, confirmDialog } from "../ui.js";
import { S, inMonth, monthName, fmtDate } from "../state.js";
import { weekendBoardHtml, weeklyCardHtml } from "../features/boards.js";
import { exportPdf } from "../features/pdf.js";

export function renderWeekend() {
  const lang = getLang();
  const canEdit = store.canEditKind("weekend");
  const pubs = store.get("publishers");
  const pubName = (id) => pubs.find((p) => p.id === id)?.name || id || "";

  const rows = store.get("weekend").filter((w) => inMonth(w.date)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const tbody = el("tbody");
  rows.forEach((w) => {
    const speaker = w.talk?.speaker ? (pubs.find((p) => p.id === w.talk.speaker)?.name || w.talk.speaker) : "";
    tbody.append(el("tr", { class: canEdit ? "row-click" : "", onClick: canEdit ? () => openEditor(w) : null },
      el("td", {}, fmtDate(w.date, lang)),
      el("td", { class: "ta" }, w.talk?.theme || "—"),
      el("td", { class: "ta" }, el("div", {}, el("div", {}, speaker || "—"), w.talk?.speakerCong ? el("div", { class: "hint ta" }, w.talk.speakerCong) : null)),
      el("td", { class: "ta" }, w.wt?.conductor ? pubName(w.wt.conductor) : "—"),
      el("td", { class: "ta" }, w.wt?.reader ? pubName(w.wt.reader) : "—"),
      el("td", { style: { whiteSpace: "nowrap" } },
        el("button", { class: "btn btn-icon", title: lang === "ta" ? "வார அட்டை (WhatsApp)" : "Weekly card", onClick: (e) => { e.stopPropagation(); exportPdf(weeklyCardHtml("weekend", w), `weekend-week-${w.date}`, { landscape: false }); } }, icon("share", 14)),
        canEdit ? icon("pencil", 15) : null)));
  });

  const table = rows.length ? el("div", { class: "tbl-wrap" },
    el("table", { class: "tbl" }, el("thead", {}, el("tr", {},
      el("th", {}, t("date")), el("th", {}, lang === "ta" ? "தலைப்பு" : "Public Talk"),
      el("th", {}, lang === "ta" ? "பேச்சாளர்" : "Speaker"),
      el("th", {}, lang === "ta" ? "நடத்துபவர்" : "WT Conductor"), el("th", {}, t("reader")), el("th", {}, ""))), tbody))
    : el("div", { class: "empty" }, icon("calendar", 40), el("p", {}, monthName(S.month, lang)), canEdit ? el("p", { class: "hint" }, `${t("add")} ↑`) : null);

  const head = el("div", { class: "view-head spread wrap" },
    el("div", {}, el("h2", {}, t("weekend")), el("p", {}, monthName(S.month, lang))),
    el("div", { class: "row wrap" },
      rows.length ? el("button", { class: "btn", onClick: () => exportPdf(
        weekendBoardHtml(rows, { congName: store.congregation?.name || "", month: monthName(S.month, lang) }),
        `weekend-${monthName(S.month, "en").replace(" ", "-").toLowerCase()}`, { landscape: true }) }, icon("download", 16), "PDF") : null,
      canEdit ? el("button", { class: "btn btn-primary", onClick: () => openEditor(null) }, icon("plus", 16), t("add")) : null));

  return el("div", { class: "view" }, head, table);

  function openEditor(rec) {
    const isNew = !rec;
    const d = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid("wk"), talk: {}, wt: {} };
    d.talk = d.talk || {}; d.wt = d.wt || {};

    const dateI = el("input", { class: "input", type: "date", value: d.date || monthFirst() });
    const themeI = el("input", { class: "input ta", value: d.talk.theme || "", placeholder: lang === "ta" ? "பேச்சின் தலைப்பு" : "Talk theme" });
    const numI = el("input", { class: "input", type: "number", value: d.talk.number || "", placeholder: "#", style: { width: "90px" } });
    const congI = el("input", { class: "input ta", value: d.talk.speakerCong || "", placeholder: lang === "ta" ? "சபை (வெளியிலிருந்து)" : "Congregation (if visiting)" });

    const opts = (role) => pubs.filter((p) => p.active !== false && (p.roles || []).includes(role)).map((p) => ({ value: p.id, label: p.name }));
    const speakerC = combo({ options: opts("weekend.talk"), value: d.talk.speaker || null, placeholder: lang === "ta" ? "பேச்சாளர்" : "Speaker", allowFree: true, onSelect: (v) => { d.talk.speaker = v; } });
    const chairC = combo({ options: opts("weekend.chairman"), value: d.chairman || null, placeholder: t("chairman"), onSelect: (v) => { d.chairman = v; } });
    const condC = combo({ options: opts("weekend.wt.conductor"), value: d.wt.conductor || null, placeholder: lang === "ta" ? "நடத்துபவர்" : "Conductor", onSelect: (v) => { d.wt.conductor = v; } });
    const readC = combo({ options: opts("weekend.wt.reader"), value: d.wt.reader || null, placeholder: t("reader"), onSelect: (v) => { d.wt.reader = v; } });

    const F = (label, node) => el("div", { class: "field" }, el("label", {}, label), node);
    modal({
      title: isNew ? t("add") : t("edit"),
      body: el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
        F(t("date"), dateI),
        el("div", { class: "side-group", style: { padding: "4px 0 0" } }, lang === "ta" ? "பொது பேச்சு" : "Public Talk"),
        el("div", { class: "row", style: { gap: "12px" } }, el("div", { style: { width: "90px" } }, F("#", numI)), el("div", { class: "grow" }, F(lang === "ta" ? "தலைப்பு" : "Theme", themeI))),
        F(lang === "ta" ? "பேச்சாளர்" : "Speaker", speakerC), F(lang === "ta" ? "சபை" : "Congregation", congI), F(t("chairman"), chairC),
        el("div", { class: "side-group", style: { padding: "4px 0 0" } }, lang === "ta" ? "காவற்கோபுர படிப்பு" : "Watchtower"),
        F(lang === "ta" ? "நடத்துபவர்" : "Conductor", condC), F(t("reader"), readC)),
      actions: [
        !isNew ? { label: t("delete"), class: "btn-danger", onClick: async (close) => { if (!(await confirmDialog(t("confirmDelete")))) return; store.set("weekend", store.get("weekend").filter((x) => x.id !== d.id)); close(); toast(t("saved"), "ok"); } } : null,
        { label: t("cancel"), onClick: (c) => c() },
        { label: t("save"), class: "btn-primary", onClick: (close) => {
          d.date = dateI.value; d.talk.theme = themeI.value.trim(); d.talk.number = numI.value ? parseInt(numI.value) : null; d.talk.speakerCong = congI.value.trim();
          if (!d.date) { toast(t("required"), "danger"); return; }
          const arr = store.get("weekend").slice(); const i = arr.findIndex((x) => x.id === d.id);
          if (i >= 0) arr[i] = d; else arr.push(d); store.set("weekend", arr); close(); toast(t("saved"), "ok");
        } },
      ].filter(Boolean),
    });
  }
}
const monthFirst = () => `${S.month.getFullYear()}-${String(S.month.getMonth() + 1).padStart(2, "0")}-01`;
