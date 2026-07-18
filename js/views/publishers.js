// ============================================================================
// PUBLISHERS — shared people list + the profile drawer (history, partners,
// workload) that makes assigning the next person easy.
// ============================================================================
import { store, uid } from "../store.js";
import { ROLES, roleLabel } from "../config.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, modal, drawer, confirmDialog } from "../ui.js";
import { fmtDate, S } from "../state.js";
import { statsFor, workload, collectAssignments } from "../features/intelligence.js";
import { pubLabel, groupLabel } from "../features/boards.js";

export function renderPublishers() {
  const lang = getLang();
  const canEdit = store.canEditKind("publishers");
  const pubs = store.get("publishers");
  const groups = store.get("groups");
  const groupName = (id) => { const g = groups.find((x) => x.id === id); return g ? groupLabel(g, lang) : ""; };

  let query = "";
  const search = el("input", { class: "input", placeholder: t("search"), style: { maxWidth: "280px" },
    oninput: (e) => { query = e.target.value.toLowerCase(); paint(); } });

  const tbody = el("tbody");
  const table = el("div", { class: "tbl-wrap" },
    el("table", { class: "tbl" },
      el("thead", {}, el("tr", {},
        el("th", {}, t("name")), el("th", { class: "hide-sm" }, t("gender")),
        el("th", { class: "hide-sm" }, t("group")), el("th", {}, t("roles")),
        el("th", { style: { width: "60px" } }, ""))),
      tbody));

  function paint() {
    const rows = pubs
      .filter((p) => !query || (p.name || "").toLowerCase().includes(query) || (p.nameEn || "").toLowerCase().includes(query))
      .sort((a, b) => pubLabel(a, lang).localeCompare(pubLabel(b, lang)));
    tbody.replaceChildren();
    if (!rows.length) { tbody.append(el("tr", {}, el("td", { colSpan: 5 }, el("div", { class: "empty" }, icon("users", 36), el("p", {}, t("noCong") && "No publishers yet")))));
      return; }
    rows.forEach((p) => {
      const chips = (p.roles || []).slice(0, 3).map((r) => el("span", { class: "chip" }, roleLabel(r, lang)));
      if ((p.roles || []).length > 3) chips.push(el("span", { class: "chip" }, `+${p.roles.length - 3}`));
      tbody.append(el("tr", { class: "row-click", onClick: () => openProfile(p) },
        el("td", {}, el("div", { class: "row wrap" },
          el("span", { class: "ta", style: { fontWeight: 700 } }, pubLabel(p, lang)),
          p.active === false ? el("span", { class: "badge muted" }, t("inactive")) : null,
          p.exempt ? el("span", { class: "badge muted ta" }, t("exempt")) : null)),
        el("td", { class: "hide-sm" }, el("span", { class: "chip" }, p.gender === "sister" ? t("sister") : t("brother"))),
        el("td", { class: "hide-sm ta" }, groupName(p.groupId) || "—"),
        el("td", {}, el("div", { class: "row wrap" }, chips.length ? chips : el("span", { class: "muted" }, "—"))),
        el("td", {}, canEdit ? el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: (e) => { e.stopPropagation(); openEdit(p); } }, icon("pencil", 16)) : null)));
    });
  }
  paint();

  const head = el("div", { class: "view-head spread wrap" },
    el("div", {}, el("h2", {}, t("publishers")), el("p", {}, `${pubs.length}`)),
    el("div", { class: "row wrap" }, search,
      canEdit ? el("button", { class: "btn btn-primary", onClick: () => openEdit(null) }, icon("plus", 16), t("add")) : null));

  return el("div", { class: "view" }, head, table);
}

/* ---- Add / edit --------------------------------------------------------- */
function openEdit(pub) {
  const lang = getLang();
  const isNew = !pub;
  const draft = pub ? JSON.parse(JSON.stringify(pub)) : { id: uid("p"), name: "", nameEn: "", gender: "brother", groupId: "", roles: [], active: true, baptized: true };
  const groups = store.get("groups");

  const nameI = el("input", { class: "input ta", value: draft.name, placeholder: t("name") });
  const nameEnI = el("input", { class: "input", value: draft.nameEn || "", placeholder: t("nameEn") });
  const genderS = el("select", { class: "select" },
    el("option", { value: "brother", selected: draft.gender !== "sister" }, t("brother")),
    el("option", { value: "sister", selected: draft.gender === "sister" }, t("sister")));
  const groupS = el("select", { class: "select" },
    el("option", { value: "" }, "—"),
    ...groups.map((g) => el("option", { value: g.id, selected: draft.groupId === g.id }, groupLabel(g, lang))));
  const activeC = el("input", { type: "checkbox", checked: draft.active !== false });
  const baptizedC = el("input", { type: "checkbox", checked: draft.baptized !== false });
  const exemptC = el("input", { type: "checkbox", checked: draft.exempt === true });

  // Role chips grouped by area
  const roleBox = el("div", { class: "row wrap", style: { gap: "6px" } });
  ROLES.forEach((r) => {
    const on = draft.roles.includes(r.key);
    const chip = el("button", { class: `chip ${on ? "accent" : ""}`, type: "button",
      onClick: () => { const i = draft.roles.indexOf(r.key); if (i >= 0) draft.roles.splice(i, 1); else draft.roles.push(r.key); chip.className = `chip ${draft.roles.includes(r.key) ? "accent" : ""}`; } },
      roleLabel(r.key, lang));
    roleBox.append(chip);
  });

  const body = el("div", { class: "modal-body", style: { padding: 0 } },
    el("div", { class: "field" }, el("label", {}, t("name")), nameI),
    el("div", { class: "field" }, el("label", {}, t("nameEn")), nameEnI),
    el("div", { class: "row", style: { gap: "12px" } },
      el("div", { class: "field grow" }, el("label", {}, t("gender")), genderS),
      el("div", { class: "field grow" }, el("label", {}, t("group")), groupS)),
    el("div", { class: "field" }, el("label", {}, t("roles")), roleBox),
    el("div", { class: "row wrap", style: { gap: "16px" } },
      el("label", { class: "row", style: { gap: "8px", cursor: "pointer" } }, activeC, el("span", {}, t("active"))),
      el("label", { class: "row", style: { gap: "8px", cursor: "pointer" } }, baptizedC, el("span", { class: "ta" }, t("baptized"))),
      el("label", { class: "row", style: { gap: "8px", cursor: "pointer" } }, exemptC, el("span", { class: "ta" }, t("exempt")))));

  modal({
    title: isNew ? t("add") : t("edit"),
    body,
    actions: [
      !isNew ? { label: t("delete"), class: "btn-danger", onClick: async (close) => {
        if (!(await confirmDialog(t("confirmDelete")))) return;
        store.set("publishers", store.get("publishers").filter((x) => x.id !== draft.id)); close(); toast(t("saved"), "ok");
      } } : null,
      { label: t("cancel"), onClick: (c) => c() },
      { label: t("save"), class: "btn-primary", onClick: (close) => {
        draft.name = nameI.value.trim(); draft.nameEn = nameEnI.value.trim(); draft.gender = genderS.value; draft.groupId = groupS.value;
        draft.active = activeC.checked; draft.baptized = baptizedC.checked; draft.exempt = exemptC.checked;
        if (!draft.name) { toast(t("required"), "danger"); return; }
        const arr = store.get("publishers").slice();
        const i = arr.findIndex((x) => x.id === draft.id);
        if (i >= 0) arr[i] = draft; else arr.push(draft);
        store.set("publishers", arr); close(); toast(t("saved"), "ok");
      } },
    ].filter(Boolean),
  });
  setTimeout(() => nameI.focus(), 50);
}

/* ---- Profile drawer (history / partners / workload) -------------------- */
function openProfile(pub) {
  const lang = getLang();
  const all = collectAssignments();
  const s = statsFor(pub.id, all);
  const wl = workload(all);
  const name = (id) => { const p = store.get("publishers").find((x) => x.id === id); return p ? pubLabel(p, lang) : id; };

  const pct = Math.round((wl.map[pub.id] || 0) / wl.max * 100);
  const vsAvg = s.total - wl.avg;

  const roleRows = Object.entries(s.byRole).sort((a, b) => b[1] - a[1]).map(([r, n]) =>
    el("div", { class: "spread", style: { padding: "6px 0", borderBottom: "1px solid var(--border)" } },
      el("span", { class: "ta" }, roleLabel(r, lang)), el("span", { class: "chip accent" }, n)));

  const partnerRows = s.partners.length
    ? s.partners.map(([id, n]) => el("div", { class: "spread", style: { padding: "6px 0", borderBottom: "1px solid var(--border)" } },
        el("span", { class: "ta" }, name(id)), el("span", { class: "chip" }, `×${n}`)))
    : [el("p", { class: "muted" }, "—")];

  const historyRows = s.history.length
    ? s.history.slice(0, 40).map((a) => el("div", { class: "spread", style: { padding: "7px 0", borderBottom: "1px solid var(--border)" } },
        el("div", {}, el("div", { class: "ta", style: { fontWeight: 600 } }, roleLabel(a.role, lang)),
          el("div", { class: "hint" }, t(a.area))),
        el("span", { class: "hint" }, fmtDate(a.date, lang))))
    : [el("p", { class: "muted" }, "—")];

  const section = (title, nodes) => el("div", { style: { marginTop: "18px" } },
    el("div", { class: "side-group", style: { padding: "0 0 6px" } }, title), ...nodes);

  const body = el("div", {},
    el("div", { class: "row", style: { gap: "12px" } },
      el("div", { class: "avatar", style: { width: "48px", height: "48px", fontSize: "1.1rem" } }, (pubLabel(pub, lang) || "?")[0]),
      el("div", {}, el("div", { class: "ta", style: { fontWeight: 800, fontSize: "var(--fs-lg)" } }, pubLabel(pub, lang)),
        el("div", { class: "hint ta" }, `${pub.gender === "sister" ? t("sister") : t("brother")}`))),

    el("div", { class: "grid-cards", style: { gridTemplateColumns: "1fr 1fr", marginTop: "16px", gap: "10px" } },
      el("div", { class: "card stat" }, el("div", { class: "k" }, t("fairness")), el("div", { class: "v" }, s.total),
        el("div", { class: "hint" }, vsAvg >= 0 ? `+${vsAvg.toFixed(1)} vs avg` : `${vsAvg.toFixed(1)} vs avg`)),
      el("div", { class: "card stat" }, el("div", { class: "k" }, t("lastAssigned")), el("div", { class: "v", style: { fontSize: "var(--fs-md)", fontWeight: 700 } }, s.lastDate ? fmtDate(s.lastDate, lang) : t("never")))),

    el("div", { style: { height: "8px" } }),
    el("div", { class: "skeleton", style: { height: "8px", borderRadius: "999px", background: "var(--surface-3)", overflow: "hidden" } },
      el("div", { style: { width: pct + "%", height: "100%", background: "var(--accent)", borderRadius: "999px" } })),

    section(t("roles"), roleRows.length ? roleRows : [el("p", { class: "muted" }, "—")]),
    section(t("partners"), partnerRows),
    section(t("history"), historyRows),
  );

  drawer({ title: t("publishers"), body });
}
