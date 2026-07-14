// ============================================================================
// DASHBOARD — at-a-glance overview: stats, open assignments, conflicts, workload.
// ============================================================================
import { store } from "../store.js";
import { getLang, t } from "../i18n.js";
import { el, icon } from "../ui.js";
import { S, inMonth, monthName, fmtDate } from "../state.js";
import { collectAssignments, workload } from "../features/intelligence.js";

export function renderDashboard() {
  const lang = getLang();
  const pubs = store.get("publishers");
  const pubName = (id) => pubs.find((p) => p.id === id)?.name || id || "";
  const weeks = store.get("clm").filter((w) => inMonth(w.date)).sort((a, b) => a.date.localeCompare(b.date));

  // gaps + conflicts within this month's CLM
  let gaps = 0, conflicts = 0;
  weeks.forEach((w) => {
    const ids = [];
    const slots = [w.chairman, w.openingPrayer, w.closingPrayer];
    Object.values(w.sections || {}).forEach((sec) => sec.forEach((p) => {
      if (p.title) return; // local needs — not a person slot
      slots.push(p.assignee || null); if ("assistant" in p) slots.push(p.assistant || null); if (p.reader !== undefined && p.reader !== true) slots.push(p.reader || null);
    }));
    slots.forEach((s) => { if (!s) gaps++; else ids.push(s); });
    const seen = {}; ids.forEach((id) => { seen[id] = (seen[id] || 0) + 1; }); conflicts += Object.values(seen).filter((n) => n > 1).length;
  });

  const wl = workload();
  const named = Object.entries(wl.map).map(([id, n]) => ({ name: pubName(id), n })).sort((a, b) => b.n - a.n);
  const top = named.slice(0, 5);
  const activePubs = pubs.filter((p) => p.active !== false);
  const bottom = activePubs.map((p) => ({ name: p.name, n: wl.map[p.id] || 0 })).sort((a, b) => a.n - b.n).slice(0, 5);

  const stats = el("div", { class: "grid-cards" },
    stat(t("publishers"), pubs.length, "users"),
    stat(t("clm"), `${weeks.length}`, "gem", monthName(S.month, lang)),
    stat(t("gaps"), gaps, "alert", "", gaps ? "warn" : "ok"),
    stat(t("conflicts"), conflicts, "alert", "", conflicts ? "danger" : "ok"));

  const thisWeek = weeks[0]
    ? el("div", { class: "card card-pad" },
        el("div", { class: "spread", style: { marginBottom: "10px" } }, el("div", { class: "side-group", style: { padding: 0 } }, t("thisWeek")), el("span", { class: "hint" }, fmtDate(weeks[0].date, lang))),
        summaryLines(weeks[0], pubName, lang))
    : el("div", { class: "card card-pad empty" }, icon("calendar", 32), el("p", {}, monthName(S.month, lang)));

  const fairness = el("div", { class: "card card-pad" },
    el("div", { class: "side-group", style: { padding: "0 0 10px" } }, t("fairness")),
    el("div", { class: "row", style: { gap: "24px", alignItems: "flex-start", flexWrap: "wrap" } },
      col("Most", top), col("Least", bottom)));

  return el("div", { class: "view" },
    el("div", { class: "view-head" }, el("h2", {}, t("dashboard")), el("p", {}, store.congregation?.name || "")),
    stats,
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }, class: "dash-2" }, thisWeek, fairness));

  function stat(k, v, ic, sub, tone) {
    return el("div", { class: "card stat" },
      el("div", { class: "spread" }, el("div", { class: "k" }, k), el("span", { style: { color: "var(--text-3)" } }, icon(ic, 18))),
      el("div", { class: "v", style: tone === "warn" ? { color: "var(--warn)" } : tone === "danger" ? { color: "var(--danger)" } : tone === "ok" ? {} : {} }, v),
      sub ? el("div", { class: "hint" }, sub) : null);
  }
  function col(title, rows) {
    return el("div", { class: "grow" }, el("div", { class: "hint", style: { marginBottom: "6px" } }, title),
      rows.length ? rows.map((r) => el("div", { class: "spread", style: { padding: "5px 0" } }, el("span", { class: "ta" }, r.name || "—"), el("span", { class: "chip" }, r.n))) : el("p", { class: "muted" }, "—"));
  }
}

function summaryLines(w, pubName, lang) {
  const line = (label, id) => el("div", { class: "spread", style: { padding: "5px 0", borderBottom: "1px solid var(--border)" } },
    el("span", { class: "muted" }, label), el("span", { class: "ta", style: { fontWeight: 600 } }, id ? pubName(id) : "—"));
  return el("div", {}, line(lang === "ta" ? "சேர்மன்" : "Chairman", w.chairman),
    line(lang === "ta" ? "ஜெபம்" : "Prayer", w.openingPrayer),
    ...(w.sections?.living || []).filter((p) => p.reader).map((p) => line(lang === "ta" ? "பைபிள் படிப்பு" : "Bible Study", p.assignee)));
}
