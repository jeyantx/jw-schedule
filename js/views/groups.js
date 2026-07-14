// ============================================================================
// GROUPS — field-service groups with an overseer + optional assistant.
// ============================================================================
import { store, uid } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon, toast, modal, combo, confirmDialog } from "../ui.js";

export function renderGroups() {
  const canEdit = store.canEditKind("groups");
  const pubs = store.get("publishers");
  const pubName = (id) => pubs.find((p) => p.id === id)?.name || "—";
  const groups = store.get("groups");
  const memberCount = (gid) => pubs.filter((p) => p.groupId === gid).length;

  const cards = el("div", { class: "grid-cards" });
  groups.forEach((g) => {
    cards.append(el("div", { class: "card card-pad", style: { cursor: canEdit ? "pointer" : "default" }, onClick: canEdit ? () => openEditor(g) : null },
      el("div", { class: "spread" }, el("div", { class: "ta", style: { fontWeight: 800, fontSize: "var(--fs-lg)" } }, g.name),
        el("span", { class: "chip" }, `${memberCount(g.id)}`)),
      el("div", { style: { marginTop: "10px" } },
        el("div", { class: "hint" }, t("owner")), el("div", { class: "ta", style: { fontWeight: 600 } }, pubName(g.overseerId)),
        g.assistantId ? el("div", { class: "ta hint", style: { marginTop: "4px" } }, pubName(g.assistantId)) : null)));
  });
  if (!groups.length) cards.append(el("div", { class: "empty" }, icon("grid", 40), el("p", {}, "No groups yet")));

  const head = el("div", { class: "view-head spread wrap" },
    el("div", {}, el("h2", {}, t("groups")), el("p", {}, `${groups.length}`)),
    canEdit ? el("button", { class: "btn btn-primary", onClick: () => openEditor(null) }, icon("plus", 16), t("add")) : null);

  return el("div", { class: "view" }, head, cards);

  function openEditor(g) {
    const isNew = !g;
    const d = g ? { ...g } : { id: uid("g"), name: "", overseerId: "", assistantId: "" };
    const nameI = el("input", { class: "input ta", value: d.name, placeholder: t("name") });
    const opts = pubs.filter((p) => p.gender !== "sister" && p.active !== false).map((p) => ({ value: p.id, label: p.name }));
    const ovC = combo({ options: opts, value: d.overseerId || null, placeholder: t("owner"), onSelect: (v) => (d.overseerId = v) });
    const asC = combo({ options: opts, value: d.assistantId || null, placeholder: t("assistant"), onSelect: (v) => (d.assistantId = v) });
    const F = (l, n) => el("div", { class: "field" }, el("label", {}, l), n);
    modal({
      title: isNew ? t("add") : t("edit"),
      body: el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } }, F(t("name"), nameI), F(t("owner"), ovC), F(t("assistant"), asC)),
      actions: [
        !isNew ? { label: t("delete"), class: "btn-danger", onClick: async (c) => { if (!(await confirmDialog(t("confirmDelete")))) return; store.set("groups", store.get("groups").filter((x) => x.id !== d.id)); c(); toast(t("saved"), "ok"); } } : null,
        { label: t("cancel"), onClick: (c) => c() },
        { label: t("save"), class: "btn-primary", onClick: (c) => { d.name = nameI.value.trim(); if (!d.name) return toast(t("required"), "danger"); const arr = store.get("groups").slice(); const i = arr.findIndex((x) => x.id === d.id); if (i >= 0) arr[i] = d; else arr.push(d); store.set("groups", arr); c(); toast(t("saved"), "ok"); } },
      ].filter(Boolean),
    });
  }
}
