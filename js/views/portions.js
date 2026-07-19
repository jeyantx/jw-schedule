// ============================================================================
// STUDENT PORTIONS — a UI-only matrix (publishers × months) mirroring the
// congregation's ministry-portion tracking sheet. Codes are derived from every
// CLM doc of the selected year. Not printable/exportable.
//
// Code system:
//   BR  Bible reading  (treasures part index 2, the 4-min student reading)
//   SC  Starting a Conversation      FU  Following Up
//   MD  Making Disciples             EB  Explaining your Beliefs
//   T   Talk            S   generic student (apply part with no type set)
// Each apply chip carries a role suffix: .m = student (assignee), .a = assistant.
// ============================================================================
import { store } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon } from "../ui.js";
import { S } from "../state.js";
import { pubLabel, groupLabel, contentLangFor } from "../features/boards.js";

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_TA = ["ஜன", "பிப்", "மார்", "ஏப்", "மே", "ஜூன்", "ஜூலை", "ஆக", "செப்", "அக்", "நவ", "டிச"];

// Build pubId -> [12 arrays of {code, role}] for the given year.
export function portionMatrix(year, clm = store.get("clm")) {
  const cells = {};
  const add = (pubId, mi, code, role) => {
    if (!pubId) return;
    (cells[pubId] || (cells[pubId] = Array.from({ length: 12 }, () => [])))[mi].push({ code, role });
  };
  for (const w of clm) {
    if (!w.date || !w.date.startsWith(String(year))) continue;
    const mi = new Date(w.date + "T00:00:00").getMonth();
    const tr = (w.sections && w.sections.treasures) || [];
    if (tr[2] && tr[2].assignee) add(tr[2].assignee, mi, "BR", "m");
    for (const p of (w.sections && w.sections.apply) || []) {
      const code = p.type || "S";
      if (p.assignee) add(p.assignee, mi, code, "m");
      if (p.assistant) add(p.assistant, mi, code, "a");
    }
  }
  return cells;
}

export function renderPortions() {
  const lang = getLang();               // app chrome
  const clang = contentLangFor("clm");  // publisher / group names — the midweek matrix follows the CLM override
  const months = lang === "ta" ? MONTHS_TA : MONTHS_EN;
  const L = (ta, en) => (lang === "ta" ? ta : en);

  let year = S.month.getFullYear();
  const filters = { gender: "all", studentsOnly: false, includeInactive: false, unbaptised: false };

  const yearLabel = el("span", { class: "label", style: { minWidth: "64px", textAlign: "center", fontWeight: 700 } }, `${year}`);
  const yearNav = el("div", { class: "month-nav" },
    el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => { year--; yearLabel.textContent = `${year}`; paint(); } }, icon("chevronLeft", 18)),
    yearLabel,
    el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => { year++; yearLabel.textContent = `${year}`; paint(); } }, icon("chevronRight", 18)));

  // filter chip toggles
  const filterBar = el("div", { class: "row wrap", style: { gap: "6px", margin: "4px 0 12px" } });
  const mkToggle = (label, get, set) => {
    const b = el("button", { class: `chip ${get() ? "accent" : ""} ta`, type: "button",
      onClick: () => { set(!get()); paint(); } }, label);
    return b;
  };
  const mkRadio = (label, val) => el("button", { class: `chip ${filters.gender === val ? "accent" : ""} ta`, type: "button",
    onClick: () => { filters.gender = val; paint(); } }, label);

  const tbody = el("tbody");
  const table = el("div", { class: "tbl-wrap portions-wrap" },
    el("table", { class: "tbl portions-tbl" },
      el("thead", {}, el("tr", {},
        el("th", { class: "sticky-col" }, t("name")),
        el("th", { style: { textAlign: "center" } }, t("count")),
        ...months.map((m) => el("th", { style: { textAlign: "center", minWidth: "42px" } }, m)))),
      tbody));

  function paint() {
    // rebuild filter bar (reflect active states)
    filterBar.replaceChildren(
      mkRadio(t("all"), "all"), mkRadio(t("brother"), "brother"), mkRadio(t("sister"), "sister"),
      mkToggle(t("studentsOnly"), () => filters.studentsOnly, (v) => (filters.studentsOnly = v)),
      mkToggle(t("unbaptised"), () => filters.unbaptised, (v) => (filters.unbaptised = v)),
      mkToggle(t("includeInactive"), () => filters.includeInactive, (v) => (filters.includeInactive = v)));

    const cells = portionMatrix(year);
    const pubs = store.get("publishers").filter((p) => {
      if (!filters.includeInactive && p.active === false) return false;
      if (filters.gender === "brother" && p.gender === "sister") return false;
      if (filters.gender === "sister" && p.gender !== "sister") return false;
      if (filters.studentsOnly && !(p.roles || []).includes("clm.student")) return false;
      if (filters.unbaptised && p.baptized !== false) return false;
      return true;
    });

    // group rows by field-service group (grouped view), ungrouped last
    const groups = store.get("groups");
    const order = [...groups.map((g) => ({ id: g.id, label: groupLabel(g, clang) })), { id: "", label: L("குழு இல்லை", "No group") }];
    tbody.replaceChildren();
    let shown = 0;
    order.forEach((grp) => {
      const rows = pubs.filter((p) => (p.groupId || "") === grp.id)
        .sort((a, b) => pubLabel(a, clang).localeCompare(pubLabel(b, clang)));
      if (!rows.length) return;
      tbody.append(el("tr", { class: "portions-group" },
        el("td", { class: "sticky-col ta", colSpan: 14 }, grp.label)));
      rows.forEach((p) => {
        shown++;
        const mine = cells[p.id] || Array.from({ length: 12 }, () => []);
        const total = mine.reduce((n, arr) => n + arr.length, 0);
        tbody.append(el("tr", {},
          el("td", { class: "sticky-col ta", style: { fontWeight: 600 } }, pubLabel(p, clang)),
          el("td", { style: { textAlign: "center" } }, total ? el("span", { class: "chip" }, total) : el("span", { class: "muted" }, "—")),
          ...mine.map((chips) => el("td", { style: { textAlign: "center", verticalAlign: "top" } },
            chips.length ? el("div", { class: "pcodes" }, chips.map(codeChip)) : el("span", { class: "muted" }, "")))));
      });
    });
    if (!shown) tbody.append(el("tr", {}, el("td", { class: "sticky-col", colSpan: 14 },
      el("div", { class: "empty" }, icon("grid", 34), el("p", {}, L("தரவு இல்லை", "No data"))))));
  }

  function codeChip({ code, role }) {
    return el("span", { class: `pcode pcode-${code}`, title: role === "a" ? t("assistant") : t("assignee") },
      code, role === "a" ? el("sub", {}, "a") : null);
  }

  paint();

  const head = el("div", { class: "view-head spread wrap" },
    el("div", {}, el("h2", {}, t("portions")), el("p", {}, `${year}`)),
    yearNav);

  return el("div", { class: "view" }, head, filterBar, table);
}
