// ============================================================================
// ROSTER — month table + editor for the simple schedules (Audio/Video,
// Cleaning, Field Service, Attendants). Field definitions come from
// features/boards.js so the editor, the app table and the printed boards
// always agree (including the congregation's cleaning/attendant format).
// ============================================================================
import { store, uid } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, modal, combo, confirmDialog } from "../ui.js";
import { S, inMonth, monthName, fmtDate, monthDates } from "../state.js";
import { kindFields, kindMeetingDays, kindMeta, roleBoardHtml, fsmBoardHtml, weeklyCardHtml, displayName } from "../features/boards.js";
import { exportPdf } from "../features/pdf.js";

export function makeRoster(kind) {
  return function renderRoster() {
    const lang = getLang();
    const canEdit = store.canEditKind(kind);
    const pubs = store.get("publishers");
    const groups = store.get("groups");
    const dateField = kind === "cleaning" ? "weekOf" : "date";
    const fields = kindFields(kind);

    const rows = store.get(kind).filter((r) => inMonth(r[dateField])).sort((a, b) => (a[dateField] || "").localeCompare(b[dateField] || ""));
    // ghost rows: every meeting date of the month is laid out even when unsaved
    const ghostDates = [...new Set(kindMeetingDays(kind).flatMap((wd) => monthDates(wd)))]
      .filter((d) => !rows.some((r) => r[dateField] === d));
    const lines = [
      ...rows.map((r) => ({ date: r[dateField] || "", rec: r })),
      ...ghostDates.map((d) => ({ date: d, rec: null })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const display = (f, r) => {
      const v = r[f.key];
      if (f.type === "person") return v ? el("span", { class: "ta" }, displayName(v, pubs)) : el("span", { class: "muted" }, "—");
      if (f.type === "group") return el("span", { class: "ta" }, (groups.find((g) => g.id === v) || {}).name || "—");
      if (f.type === "check") return v ? el("span", { class: "chip accent" }, "Zoom") : el("span", { class: "muted" }, "—");
      return el("span", { class: "ta" }, v || "—");
    };

    const tbody = el("tbody");
    lines.forEach(({ date, rec: r }) => {
      if (!r) {
        tbody.append(el("tr", { class: `ghost ${canEdit ? "row-click" : ""}`, onClick: canEdit ? () => openEditor(null, date) : null },
          el("td", {}, fmtDate(date, lang)),
          ...fields.map(() => el("td", { class: "muted" }, "—")),
          el("td", { style: { whiteSpace: "nowrap" } }, canEdit ? icon("plus", 15) : "")));
        return;
      }
      tbody.append(el("tr", { class: canEdit ? "row-click" : "", onClick: canEdit ? () => openEditor(r) : null },
        el("td", {}, fmtDate(r[dateField], lang)),
        ...fields.map((f) => el("td", {}, display(f, r))),
        el("td", { style: { whiteSpace: "nowrap" } },
          el("button", { class: "btn btn-icon", title: lang === "ta" ? "வார அட்டை (WhatsApp)" : "Weekly card", onClick: (e) => { e.stopPropagation(); exportWeek(r); } }, icon("share", 14)),
          canEdit ? icon("pencil", 15) : null)));
    });

    const table = lines.length ? el("div", { class: "tbl-wrap" },
      el("table", { class: "tbl" },
        el("thead", {}, el("tr", {}, el("th", {}, t("date")), ...fields.map((f) => el("th", {}, f.label)), el("th", {}, ""))),
        tbody))
      : el("div", { class: "empty" }, icon(kind === "cleaning" ? "broom" : kind === "av" ? "volume" : kind === "fsm" ? "briefcase" : "door", 40),
          el("p", {}, `${monthName(S.month, lang)}`), canEdit ? el("p", { class: "hint" }, `${t("add")} ↑`) : null);

    const head = el("div", { class: "view-head spread wrap" },
      el("div", {}, el("h2", {}, t(kind)), el("p", {}, monthName(S.month, lang))),
      el("div", { class: "row wrap" },
        rows.length ? el("button", { class: "btn", onClick: exportMonth }, icon("download", 16), "PDF") : null,
        canEdit ? el("button", { class: "btn btn-primary", onClick: () => openEditor(null) }, icon("plus", 16), t("add")) : null));

    return el("div", { class: "view" }, head, table);

    /* ---- exports ---- */
    async function exportMonth() {
      const opts = { congName: store.congregation?.name || "", month: monthName(S.month, lang) };
      const html = kind === "fsm" ? fsmBoardHtml(rows, opts) : roleBoardHtml(kind, rows, opts);
      await exportPdf(html, `${kind}-${monthName(S.month, "en").replace(" ", "-").toLowerCase()}`, { landscape: true });
    }
    async function exportWeek(r) {
      await exportPdf(weeklyCardHtml(kind, r), `${kind}-week-${r[dateField]}`, { landscape: false });
    }

    /* ---- editor modal ---- */
    function openEditor(rec, presetDate) {
      const isNew = !rec;
      const draft = rec ? JSON.parse(JSON.stringify(rec)) : { id: uid(kind[0]) };
      const dateI = el("input", { class: "input", type: "date", value: draft[dateField] || presetDate || monthFirst() });
      const fieldEls = [el("div", { class: "field" }, el("label", {}, t("date")), dateI)];

      fields.forEach((f) => {
        let control;
        if (f.type === "text") { control = el("input", { class: "input ta", value: draft[f.key] || "" }); control.dataset.k = f.key; }
        else if (f.type === "check") {
          control = el("label", { class: "row", style: { gap: "8px", alignItems: "center" } },
            Object.assign(el("input", { type: "checkbox" }), { checked: !!draft[f.key], onchange: (e) => { draft[f.key] = e.target.checked; } }),
            el("span", { class: "hint" }, getLang() === "ta" ? "உண்டு" : "Yes"));
        }
        else if (f.type === "group") control = el("select", { class: "select", onchange: (e) => { draft[f.key] = e.target.value || null; } },
          el("option", { value: "" }, "—"),
          ...groups.map((g) => el("option", { value: g.id, selected: draft[f.key] === g.id }, g.name)));
        else control = combo({ options: personOpts(f.role), value: draft[f.key] || null, placeholder: f.label, onSelect: (v) => { draft[f.key] = v; } });
        fieldEls.push(el("div", { class: "field" }, el("label", {}, f.label), control));
      });

      modal({
        title: isNew ? t("add") : t("edit"),
        body: el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } }, fieldEls),
        actions: [
          !isNew ? { label: t("delete"), class: "btn-danger", onClick: async (close) => {
            if (!(await confirmDialog(t("confirmDelete")))) return;
            store.set(kind, store.get(kind).filter((x) => x.id !== draft.id)); close(); toast(t("saved"), "ok");
          } } : null,
          { label: t("cancel"), onClick: (c) => c() },
          { label: t("save"), class: "btn-primary", onClick: (close) => {
            draft[dateField] = dateI.value;
            fieldEls.forEach((fe) => { const inp = fe.querySelector("[data-k]"); if (inp) draft[inp.dataset.k] = inp.value.trim(); });
            if (!draft[dateField]) { toast(t("required"), "danger"); return; }
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
  };
}
const monthFirst = () => `${S.month.getFullYear()}-${String(S.month.getMonth() + 1).padStart(2, "0")}-01`;
