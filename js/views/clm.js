// ============================================================================
// CLM (midweek) — the pixel-matched month sheet, inline-editable, with conflict
// + qualification highlighting and one-click PDF export via the backend.
// ============================================================================
import { store, uid } from "../store.js";
import { CLM_SECTIONS, ROLES } from "../config.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, combo, confirmDialog } from "../ui.js";
import { S, inMonth, monthName, fmtDate } from "../state.js";
import { buildClmHtml } from "../features/clmSheet.js";
import { exportPdf } from "../features/pdf.js";

let editing = null; // { weekId, path, type }

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const keys = path.split("."); const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
  target[last] = val;
}

export function renderClm() {
  const lang = getLang();
  const canEdit = store.canEditKind("clm");
  const weeks = store.get("clm").filter((w) => inMonth(w.date)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const pubs = store.get("publishers");
  const pubName = (id) => pubs.find((p) => p.id === id)?.name || id || "";

  const commit = (next) => {
    const all = store.get("clm").slice();
    const i = all.findIndex((w) => w.id === next.id);
    if (i >= 0) all[i] = next; else all.push(next);
    store.set("clm", all);
  };

  /* -- toolbar -- */
  const datePick = el("input", { class: "input", type: "date", style: { width: "170px" }, value: defaultDate() });
  const addBtn = el("button", { class: "btn btn-primary", onClick: () => {
    const d = datePick.value; if (!d) return toast(t("date"), "danger");
    if (store.get("clm").some((w) => w.date === d)) return toast("Week exists", "danger");
    commit(blankWeek(d)); toast(t("saved"), "ok");
  } }, icon("plus", 16), t("addWeek"));
  const dupBtn = el("button", { class: "btn", onClick: duplicateLast }, icon("copy", 16), t("duplicate"));
  const pdfBtn = el("button", { class: "btn", onClick: doExport }, icon("download", 16), t("exportPdf"));

  const toolbar = el("div", { class: "clm-toolbar" },
    canEdit ? el("div", { class: "row" }, datePick, addBtn) : null,
    canEdit && weeks.length ? dupBtn : null,
    el("div", { class: "grow" }),
    weeks.length ? pdfBtn : null);

  /* -- grid -- */
  let gridInner;
  if (!weeks.length) {
    gridInner = el("div", { class: "empty" }, icon("gem", 40),
      el("p", {}, `${monthName(S.month, lang)} — ${t("noCong") ? "no weeks yet" : ""}`),
      canEdit ? el("p", { class: "hint" }, `${t("addWeek")} ↑`) : null);
  } else {
    gridInner = el("div", { class: "clm-grid" }, weeks.map((w) => weekCard(w)));
  }

  const head = el("div", { class: "view-head" }, el("h2", {}, t("clm")), el("p", {}, monthName(S.month, lang)));
  return el("div", { class: "view" }, head, toolbar, el("div", { class: "clm-scroll" }, gridInner));

  /* ---------- week card ---------- */
  function weekCard(w) {
    // conflict detection: a publisher in two teaching parts in one week. Prayers are excluded —
    // a chairman commonly gives the closing prayer, which is not a conflict.
    const used = {};
    conflictIds(w).forEach((id) => { if (id) used[id] = (used[id] || 0) + 1; });

    const card = el("div", { class: "clm-week" });
    card.append(el("div", { class: "clm-week-head" }, fmtDate(w.date, lang),
      canEdit ? el("button", { class: "btn btn-icon btn-ghost btn-sm", title: t("delete"),
        onClick: async () => { if (await confirmDialog(t("confirmDelete"))) { store.set("clm", store.get("clm").filter((x) => x.id !== w.id)); toast(t("saved"), "ok"); } } }, icon("trash", 15)) : null));

    card.append(labelLine(t("chairman"), personCell(w, "chairman", "clm.chairman", "brother", used)));
    card.append(labelLine(t("prayer"), personCell(w, "openingPrayer", "clm.prayer", "brother", used)));

    let n = 0;
    CLM_SECTIONS.forEach((sec) => {
      card.append(el("div", { class: `clm-sec ${sec.cls}` }, icon(sec.icon, 15), sec[lang] || sec.en));
      const parts = (w.sections && w.sections[sec.key]) || [];
      parts.forEach((p, i) => { n++; card.append(partRow(w, sec.key, i, p, n, used)); });
      if (canEdit) card.append(el("button", { class: "btn btn-ghost btn-sm", style: { margin: "4px 8px 8px", color: "var(--text-3)" },
        onClick: () => { p_add(w, sec.key); } }, icon("plus", 14), sec[lang] || sec.en));
    });

    card.append(labelLine(t("prayer"), personCell(w, "closingPrayer", "clm.prayer", "brother", used)));
    return card;
  }

  function labelLine(label, valueNode) {
    return el("div", { class: "clm-line" }, el("span", { class: "lbl" }, label), valueNode);
  }

  function partRow(w, secKey, idx, part, no, used) {
    const base = `sections.${secKey}.${idx}`;
    const isCbs = !!part.reader;
    const who = el("div", { class: "who" });
    who.append(personCell(w, `${base}.assignee`, part.role || "clm.student", part.gender, used, secKey === "living"));
    if (secKey === "apply") who.append(assistantCell(w, `${base}.assistant`, part.role || "clm.student", part.gender, used));
    if (isCbs) who.append(assistantCell(w, `${base}.reader`, "clm.cbs.reader", "brother", used, t("reader")));

    const minCell = el("span", { class: "min cell", onClick: canEdit ? () => startEdit(w, `${base}.min`, "min") : null },
      editing && editing.weekId === w.id && editing.path === `${base}.min`
        ? minInput(w, `${base}.min`)
        : (part.min ? `${part.min} ${lang === "ta" ? "நிமி" : "min"}` : "—"));

    const row = el("div", { class: "clm-part" }, el("span", { class: "no" }, no), minCell, who);
    if (canEdit) row.append(el("button", { class: "rm", title: t("delete"), onClick: () => p_remove(w, secKey, idx) }, "✕"));
    return row;
  }

  /* ---------- editable cells ---------- */
  function personCell(w, path, role, gender, used, allowFree = false) {
    const val = getPath(w, path);
    const isEditingHere = editing && editing.weekId === w.id && editing.path === path;
    if (canEdit && isEditingHere) {
      return combo({
        options: optionsFor(role, gender),
        value: pubs.some((p) => p.id === val) ? val : null,
        placeholder: t("unassigned"),
        allowFree,
        onSelect: (v) => {
          const next = clone(w);
          if (allowFree && v && !pubs.some((p) => p.id === v)) { setPath(next, path.replace(".assignee", ".title"), v); setPath(next, path, null); }
          else { setPath(next, path, v); if (allowFree) setPath(next, path.replace(".assignee", ".title"), null); }
          editing = null; commit(next);
        },
      });
    }
    const title = allowFree ? getPath(w, path.replace(".assignee", ".title")) : null;
    const display = val ? pubName(val) : (title || "");
    const warn = val && role && !pubs.find((p) => p.id === val && (p.roles || []).includes(role));
    const conflict = val && used[val] > 1;
    return el("span", {
      class: `cell part-title ${display ? "" : "empty"} ${conflict ? "conflict" : warn ? "warn" : ""} ${title ? "ta" : "ta"}`,
      onClick: canEdit ? () => startEdit(w, path, "person") : null,
    }, display || t("unassigned"));
  }

  function assistantCell(w, path, role, gender, used, prefix) {
    const val = getPath(w, path);
    const isEditingHere = editing && editing.weekId === w.id && editing.path === path;
    if (canEdit && isEditingHere) {
      return combo({ options: optionsFor(role, gender), value: val || null, placeholder: t("assistant"),
        onSelect: (v) => { const next = clone(w); setPath(next, path, v); editing = null; commit(next); } });
    }
    if (!val && !canEdit) return el("span", {});
    return el("span", { class: `assistant cell ta ${val ? "" : "empty"}`, onClick: canEdit ? () => startEdit(w, path, "person") : null },
      val ? `${prefix ? prefix + ": " : "· "}${pubName(val)}` : (canEdit ? `+ ${prefix || t("assistant")}` : ""));
  }

  function minInput(w, path) {
    const inp = el("input", { class: "input", type: "number", min: 1, max: 90, value: getPath(w, path) || "", style: { width: "70px", height: "28px" } });
    const done = () => { const next = clone(w); setPath(next, path, parseInt(inp.value) || null); editing = null; commit(next); };
    inp.addEventListener("blur", done);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { editing = null; S.refresh(); } });
    setTimeout(() => inp.focus(), 0);
    return inp;
  }

  function startEdit(w, path, type) { editing = { weekId: w.id, path, type }; S.refresh(); }

  function optionsFor(role, gender) {
    return pubs
      .filter((p) => p.active !== false && (!role || (p.roles || []).includes(role)) && (!gender || p.gender === gender))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map((p) => ({ value: p.id, label: p.name, meta: "" }));
  }

  /* ---------- part add/remove ---------- */
  function p_add(w, secKey) {
    const next = clone(w);
    next.sections[secKey] = next.sections[secKey] || [];
    const role = secKey === "treasures" ? "clm.treasures" : secKey === "apply" ? "clm.student" : "clm.living";
    next.sections[secKey].push({ min: 4, role });
    editing = null; commit(next);
  }
  function p_remove(w, secKey, idx) {
    const next = clone(w); next.sections[secKey].splice(idx, 1); editing = null; commit(next);
  }

  function duplicateLast() {
    const prev = store.get("clm").filter((w) => (w.date || "") < firstOfMonthIso()).sort((a, b) => b.date.localeCompare(a.date))[0]
      || store.get("clm").slice(-1)[0];
    if (!prev) return toast("Nothing to copy", "danger");
    const d = defaultDate();
    if (store.get("clm").some((w) => w.date === d)) return toast("Week exists", "danger");
    const copy = clone(prev); copy.id = uid("w"); copy.date = d;
    commit(copy); toast(t("saved"), "ok");
  }

  async function doExport() {
    const html = buildClmHtml(weeks, { congName: store.congregation?.name || "", month: S.month, lang, name: pubName });
    await exportPdf(html, `clm-${monthName(S.month, "en").replace(" ", "-").toLowerCase()}`, { landscape: true });
  }
}

/* ---- helpers ------------------------------------------------------------ */
const clone = (o) => JSON.parse(JSON.stringify(o));
function conflictIds(w) {
  const ids = [w.chairman]; // prayers intentionally excluded (chairman often prays)
  for (const sec of Object.values(w.sections || {})) for (const p of sec) { ids.push(p.assignee, p.assistant, p.reader); }
  return ids.filter(Boolean);
}
function defaultDate() {
  const d = new Date(S.month.getFullYear(), S.month.getMonth(), 1);
  // nudge to a Wednesday-ish default (midweek); keep simple: first of month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function firstOfMonthIso() { return `${S.month.getFullYear()}-${String(S.month.getMonth() + 1).padStart(2, "0")}-01`; }
function blankWeek(date) {
  return {
    id: uid("w"), date, chairman: null, openingPrayer: null, closingPrayer: null,
    sections: {
      treasures: [
        { no: 1, min: 10, role: "clm.treasures", gender: "brother" },
        { no: 2, min: 10, role: "clm.gems", gender: "brother" },
        { no: 3, min: 4, role: "clm.student", gender: "brother" },
      ],
      apply: [
        { min: 3, role: "clm.student" }, { min: 4, role: "clm.student" }, { min: 4, role: "clm.student" },
      ],
      living: [
        { min: 15, role: "clm.living", gender: "brother" },
        { min: 30, role: "clm.cbs.conductor", gender: "brother", reader: true },
      ],
    },
  };
}
