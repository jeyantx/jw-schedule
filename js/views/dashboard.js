// ============================================================================
// DASHBOARD — at-a-glance overview: stats, open assignments/conflicts, and the
// full schedule for THIS week and NEXT week across every department.
// ============================================================================
import { store } from "../store.js";
import { getLang, getContentLang, t } from "../i18n.js";
import { el, icon } from "../ui.js";
import { S, inMonth, monthName, fmtDate, monthDates } from "../state.js";
import { displayName, kindFields, groupLabel, kindMeetingDays } from "../features/boards.js";

// Schedules shown in the "pending" section, with their dashboard icons.
const PENDING_KINDS = { clm: "gem", weekend: "calendar", av: "volume", cleaning: "broom", fsm: "briefcase", attendant: "door" };
// Cleaning records key their date on `weekOf`; everything else on `date`.
const dateFieldOf = (kind) => (kind === "cleaning" ? "weekOf" : "date");

// Pure, DOM-free: how many of each kind's expected meeting dates in `monthDate`
// already have a saved record. Exported so it stays unit-testable.
export function pendingForMonth(monthDate) {
  return Object.keys(PENDING_KINDS).map((kind) => {
    const expected = [...new Set(kindMeetingDays(kind).flatMap((wd) => monthDates(wd, monthDate)))];
    const field = dateFieldOf(kind);
    const saved = new Set((store.get(kind) || []).map((r) => r[field]).filter(Boolean));
    return { kind, expected: expected.length, filled: expected.filter((d) => saved.has(d)).length };
  });
}

export function renderDashboard() {
  const lang = getLang();          // app chrome
  const clang = getContentLang();  // schedule names (Tamil in mixed)
  const ta = lang === "ta";
  const pubs = store.get("publishers");
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

  const stats = el("div", { class: "grid-cards" },
    stat(t("publishers"), pubs.length, "users"),
    stat(t("clm"), `${weeks.length}`, "gem", monthName(S.month, lang)),
    stat(t("gaps"), gaps, "alert", "", gaps ? "warn" : "ok"),
    stat(t("conflicts"), conflicts, "alert", "", conflicts ? "danger" : "ok"));

  const nextMonth = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1);

  return el("div", { class: "view" },
    el("div", { class: "view-head" }, el("h2", {}, t("dashboard")), el("p", {}, store.congregation?.name || "")),
    stats,
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }, class: "dash-2" },
      weekCard(t("thisWeek"), weekRange(0)), weekCard(t("nextWeek"), weekRange(1))),
    el("div", { class: "side-group", style: { padding: "20px 0 4px" } }, ta ? "நிலுவையில் உள்ள அட்டவணைகள்" : "Pending schedules"),
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }, class: "dash-2" },
      pendingCard(ta ? "இந்த மாதம்" : "This month", S.month), pendingCard(ta ? "அடுத்த மாதம்" : "Next month", nextMonth)));

  function stat(k, v, ic, sub, tone) {
    return el("div", { class: "card stat" },
      el("div", { class: "spread" }, el("div", { class: "k" }, k), el("span", { style: { color: "var(--text-3)" } }, icon(ic, 18))),
      el("div", { class: "v", style: tone === "warn" ? { color: "var(--warn)" } : tone === "danger" ? { color: "var(--danger)" } : {} }, v),
      sub ? el("div", { class: "hint" }, sub) : null);
  }

  /* ---- week schedule cards ---------------------------------------------- */
  function weekCard(title, range) {
    const entries = weekEntries(range);
    return el("div", { class: "card card-pad" },
      el("div", { class: "spread", style: { marginBottom: "8px" } },
        el("div", { class: "side-group", style: { padding: 0 } }, title),
        el("span", { class: "hint" }, `${fmtDate(range.from, lang)} – ${fmtDate(range.to, lang)}`)),
      entries.length
        ? el("div", {}, entries.map((e) => el("div", { style: { padding: "8px 0", borderBottom: "1px solid var(--border)" } },
            el("div", { class: "spread" },
              el("span", { class: "row", style: { gap: "7px", color: "var(--text-2)", fontSize: "12.5px", fontWeight: 600 } }, icon(e.icon, 14), e.kind),
              el("span", { class: "hint" }, fmtDate(e.date, lang).replace(/,\s*\d{4}$/, ""))),
            el("div", { class: "ta", style: { fontWeight: 600, marginTop: "2px" } }, e.main),
            e.sub ? el("div", { class: "hint ta" }, e.sub) : null)))
        : el("div", { class: "empty", style: { padding: "18px 0" } }, icon("calendar", 26), el("p", { class: "muted" }, ta ? "அட்டவணை இல்லை" : "Nothing scheduled")));
  }

  function weekEntries({ from, to }) {
    const inRange = (d) => d && d >= from && d <= to;
    const out = [];
    for (const w of store.get("clm")) if (inRange(w.date))
      out.push({ date: w.date, icon: "gem", kind: t("clm"), main: `${ta ? "சேர்மன்" : "Chairman"}: ${w.chairman ? displayName(w.chairman) : "—"}` });
    for (const w of store.get("weekend")) if (inRange(w.date))
      out.push({ date: w.date, icon: "calendar", kind: t("weekend"),
        main: w.talk?.theme || "—",
        sub: [displayName(w.talk?.speaker), w.talk?.speakerCong].filter(Boolean).join(" · ") });
    for (const r of store.get("av")) if (inRange(r.date))
      out.push({ date: r.date, icon: "volume", kind: t("av"), main: names(r, "av") });
    for (const r of store.get("cleaning")) if (inRange(r.weekOf))
      out.push({ date: r.weekOf, icon: "broom", kind: t("cleaning"), main: names(r, "cleaning") });
    for (const r of store.get("fsm")) if (inRange(r.date))
      out.push({ date: r.date, icon: "briefcase", kind: t("fsm"),
        main: [r.time, r.loc, r.zoom ? "Zoom" : ""].filter(Boolean).join(" · "), sub: displayName(r.conductor) });
    for (const r of store.get("attendant")) if (inRange(r.date))
      out.push({ date: r.date, icon: "door", kind: t("attendant"), main: names(r, "attendant") });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function names(rec, kind) {
    const groups = store.get("groups");
    return kindFields(kind).map((f) => {
      if (f.type === "group") { const g = groups.find((x) => x.id === rec[f.key]); return g ? groupLabel(g, clang) : null; }
      if (f.type === "person") return displayName(rec[f.key], undefined, clang);
      return null;
    }).filter(Boolean).join(" · ") || "—";
  }

  /* ---- pending schedules per month -------------------------------------- */
  function pendingCard(title, monthDate) {
    const items = pendingForMonth(monthDate);
    return el("div", { class: "card card-pad" },
      el("div", { class: "spread", style: { marginBottom: "8px" } },
        el("div", { class: "side-group", style: { padding: 0 } }, title),
        el("span", { class: "hint" }, monthName(monthDate, lang))),
      el("div", {}, items.map((it) => {
        const done = it.expected > 0 && it.filled >= it.expected;
        const color = it.expected === 0 ? "var(--text-3)" : done ? "var(--ok)" : "var(--warn)";
        return el("div", { class: "spread row-click", style: { padding: "8px 0", borderBottom: "1px solid var(--border)" },
          onClick: () => { location.hash = "#/" + it.kind; } },
          el("span", { class: "row", style: { gap: "7px", color: "var(--text-2)", fontSize: "12.5px", fontWeight: 600 } }, icon(PENDING_KINDS[it.kind], 14), t(it.kind)),
          el("span", { style: { fontWeight: 700, fontSize: "12.5px", color } }, it.expected === 0 ? "—" : `${it.filled}/${it.expected}`));
      })));
  }
}

// Monday-based week window, offset in weeks from the current one.
function weekRange(offset = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(start), to: iso(end) };
}
