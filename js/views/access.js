// ============================================================================
// MEMBERS & ACCESS (owner only) — grant per-area view/edit, revoke.
// Talks straight to the backend access API (not the cached docs).
// ============================================================================
import { store } from "../store.js";
import { api } from "../api.js";
import { AREAS } from "../config.js";
import { t } from "../i18n.js";
import { el, icon, toast, modal, confirmDialog } from "../ui.js";
import { S } from "../state.js";

export function renderAccess() {
  const container = el("div", { class: "view" });
  const head = el("div", { class: "view-head spread wrap" },
    el("div", {}, el("h2", {}, t("access")), el("p", {}, store.congregation?.name || "")),
    el("button", { class: "btn btn-primary", onClick: () => openGrant() }, icon("plus", 16), t("grant")));
  const body = el("div", { class: "tbl-wrap" }, el("div", { class: "empty" }, icon("clock", 28), el("p", { class: "muted" }, "Loading…")));
  container.append(head, body);

  api.listAccess(store.congId).then((list) => paint(list)).catch((e) => {
    body.replaceChildren(el("div", { class: "empty" }, icon("alert", 28), el("p", {}, e.message)));
  });

  return container;

  function paint(list) {
    const tbody = el("tbody");
    list.sort((a, b) => a.email.localeCompare(b.email)).forEach((a) => {
      const owner = a.email.toLowerCase() === (store.congregation?.ownerEmail || "").toLowerCase();
      const cells = AREAS.map((area) => {
        const p = a.permissions[area] || {};
        return el("td", {}, p.edit ? el("span", { class: "badge ok" }, t("editPerm")) : p.view ? el("span", { class: "badge muted" }, t("view")) : el("span", { class: "muted" }, "—"));
      });
      tbody.append(el("tr", {},
        el("td", {}, el("div", { class: "row" }, el("span", { style: { fontWeight: 600 } }, a.email), owner ? el("span", { class: "badge warn" }, t("owner")) : null)),
        el("td", {}, a.nameEn ? el("span", {}, a.nameEn) : el("span", { class: "muted" }, "—")),
        ...cells,
        el("td", {}, owner ? null : el("div", { class: "row" },
          el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => openGrant(a) }, icon("pencil", 15)),
          el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => revoke(a.email) }, icon("trash", 15))))));
    });
    body.replaceChildren(el("table", { class: "tbl" },
      el("thead", {}, el("tr", {}, el("th", {}, t("email")), el("th", {}, t("nameEn")), ...AREAS.map((a) => el("th", {}, t(a))), el("th", {}, ""))),
      tbody));
  }

  async function revoke(email) {
    if (!(await confirmDialog(`${t("revoke")} ${email}?`))) return;
    try { await api.revokeAccess(store.congId, email); toast(t("saved"), "ok"); S.refresh(); }
    catch (e) { toast(e.message, "danger"); }
  }

  function openGrant(existing) {
    const emailI = el("input", { class: "input", type: "email", value: existing?.email || "", placeholder: "person@example.com", disabled: !!existing });
    const nameEnI = el("input", { class: "input", value: existing?.nameEn || "", placeholder: "e.g. John Peter" });
    const perms = {};
    const grid = el("div", { style: { display: "grid", gridTemplateColumns: "1fr auto auto", gap: "8px 16px", alignItems: "center" } });
    grid.append(el("div", {}), el("div", { class: "hint", style: { textAlign: "center" } }, t("view")), el("div", { class: "hint", style: { textAlign: "center" } }, t("editPerm")));
    AREAS.forEach((area) => {
      const cur = existing?.permissions?.[area] || {};
      perms[area] = { view: !!cur.view, edit: !!cur.edit };
      const vC = el("input", { type: "checkbox", checked: perms[area].view });
      const eC = el("input", { type: "checkbox", checked: perms[area].edit });
      vC.addEventListener("change", () => { perms[area].view = vC.checked; if (!vC.checked) { eC.checked = false; perms[area].edit = false; } });
      eC.addEventListener("change", () => { perms[area].edit = eC.checked; if (eC.checked) { vC.checked = true; perms[area].view = true; } });
      grid.append(el("div", {}, t(area)), el("div", { class: "center" }, vC), el("div", { class: "center" }, eC));
    });

    modal({
      title: existing ? t("permissions") : t("grant"),
      body: el("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } },
        el("div", { class: "field" }, el("label", {}, t("email")), emailI),
        el("div", { class: "field" }, el("label", {}, t("nameEn")), nameEnI), grid),
      actions: [
        { label: t("cancel"), onClick: (c) => c() },
        { label: t("save"), class: "btn-primary", onClick: async (close) => {
          const email = emailI.value.trim().toLowerCase();
          if (!email) return toast(t("required"), "danger");
          const nameEn = nameEnI.value.trim();
          try { await api.grantAccess(store.congId, email, perms, nameEn); toast(t("saved"), "ok"); close(); S.refresh(); }
          catch (e) { toast(e.message, "danger"); }
        } },
      ],
    });
  }
}
