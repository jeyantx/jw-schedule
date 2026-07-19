// ============================================================================
// DASHBOARD — at-a-glance overview: the signed-in member's own assignments this
// month, the full schedule for THIS week and NEXT week across every department,
// plus pending-schedule progress per month.
// ============================================================================
import { store } from "../store.js";
import { getLang, getContentLang, t } from "../i18n.js";
import { el, icon } from "../ui.js";
import { S, monthName, monthKey, fmtDate, monthDates } from "../state.js";
import { roleLabel } from "../config.js";
import { collectAssignments } from "../features/intelligence.js";
import { displayName, kindFields, groupLabel, kindMeetingDays } from "../features/boards.js";

// Schedules shown in the "pending" section, with their dashboard icons.
const PENDING_KINDS = { clm: "gem", weekend: "calendar", av: "volume", cleaning: "broom", fsm: "briefcase", attendant: "door" };
// Cleaning records key their date on `weekOf`; everything else on `date`.
const dateFieldOf = (kind) => (kind === "cleaning" ? "weekOf" : "date");

// Pure, DOM-free: how many of each kind's expected meeting dates in `monthDate`
// already have a saved record. Exported so it stays unit-testable.
export function pendingForMonth(monthDate) {
  // Dates the congregation marked "no meeting" (memorial/convention) — stored on
  // meta.sheet.clmSkip by the midweek view. They aren't expected midweek meetings.
  const clmSkip = ((store.get("meta") || {}).sheet || {}).clmSkip || [];
  return Object.keys(PENDING_KINDS).map((kind) => {
    let expected = [...new Set(kindMeetingDays(kind).flatMap((wd) => monthDates(wd, monthDate)))];
    // Drop skipped dates from the clm count ONLY — av still expects that date for
    // its own board, so its expected total is left unchanged.
    if (kind === "clm") expected = expected.filter((d) => !clmSkip.includes(d));
    const field = dateFieldOf(kind);
    const saved = new Set((store.get(kind) || []).map((r) => r[field]).filter(Boolean));
    return { kind, expected: expected.length, filled: expected.filter((d) => saved.has(d)).length };
  });
}

// Pure, DOM-free: map a signed-in member to a publisher id. Access records carry
// no publisher link, so we match the member's English name (Task 3) against the
// publisher's nameEn, then fall back to matching it against the (Tamil) name.
// Returns null when no confident match exists. Exported for unit tests.
export function resolveMemberPubId(member, publishers = store.get("publishers")) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const nameEn = norm(member && member.nameEn);
  if (!nameEn) return null;
  const hit = publishers.find((p) => norm(p.nameEn) === nameEn) || publishers.find((p) => norm(p.name) === nameEn);
  return hit ? hit.id : null;
}

// Pure, DOM-free: this member's assignments (across every schedule) for the app
// month, sorted by date. Exported for unit tests.
export function myAssignmentsForMonth(pubId, monthDate, all = collectAssignments()) {
  if (!pubId) return [];
  const prefix = monthKey(monthDate);
  return all
    .filter((a) => a.pubId === pubId && a.date && a.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function renderDashboard() {
  const lang = getLang();          // app chrome
  const clang = getContentLang();  // schedule names (Tamil in mixed)
  const ta = lang === "ta";
  const L = (taStr, enStr) => (ta ? taStr : enStr);
  const nm = (id) => displayName(id, undefined, clang);

  const nextMonth = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1);

  return el("div", { class: "view dash-view" },
    el("div", { class: "view-head" }, el("h2", {}, t("dashboard")), el("p", {}, store.congregation?.name || "")),
    myPortionsCard(),
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }, class: "dash-2" },
      weekCard(t("thisWeek"), weekRange(0)), weekCard(t("nextWeek"), weekRange(1))),
    el("div", { class: "side-group", style: { padding: "4px 0 0" } }, ta ? "நிலுவையில் உள்ள அட்டவணைகள்" : "Pending schedules"),
    el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }, class: "dash-2" },
      pendingCard(ta ? "இந்த மாதம்" : "This month", S.month), pendingCard(ta ? "அடுத்த மாதம்" : "Next month", nextMonth)));

  /* ---- "my assignments this month" -------------------------------------- */
  function myPortionsCard() {
    const title = ta ? "என் பகுதிகள்" : "My assignments";
    const pubId = resolveMemberPubId({ nameEn: store.memberNameEn });
    const mine = pubId ? myAssignmentsForMonth(pubId, S.month) : [];

    // Nothing to list (name not linked, or no assignments this month) → a slim
    // one-line card instead of a tall empty block.
    if (!pubId || !mine.length) {
      const msg = !pubId
        ? L("உங்கள் பெயரை உறுப்பினர்கள் பக்கத்தில் இணைக்கவும்", "Link your name in Members & Access")
        : L("இந்த மாதம் உங்களுக்கு நியமனம் இல்லை", "No assignments this month");
      return el("div", { class: "card dash-slim" }, icon(pubId ? "calendar" : "user", 18),
        el("span", { class: "dash-slim-title" }, title),
        el("span", { class: "muted dash-slim-msg" }, msg));
    }

    const head = el("div", { class: "spread", style: { marginBottom: "8px" } },
      el("div", { class: "side-group", style: { padding: 0 } }, title),
      el("span", { class: "hint" }, monthName(S.month, lang)));
    return el("div", { class: "card card-pad" }, head,
      el("div", {}, mine.map((a) => el("div", { class: "row dash-mine", style: { gap: "8px" } },
        el("span", { class: "hint" }, fmtDate(a.date, lang).replace(/,\s*\d{4}$/, "")),
        el("span", { class: "muted" }, "·"),
        el("span", { class: "dash-mine-area" }, t(a.area)),
        el("span", { class: "muted" }, "·"),
        el("span", { class: "ta", style: { fontWeight: 600 } }, roleLabel(a.role, lang))))));
  }

  /* ---- week schedule cards ---------------------------------------------- */
  function weekCard(title, range) {
    const entries = weekEntries(range);
    return el("div", { class: "card card-pad" },
      el("div", { class: "spread", style: { marginBottom: "8px" } },
        el("div", { class: "side-group", style: { padding: 0 } }, title),
        el("span", { class: "hint" }, `${fmtDate(range.from, lang)} – ${fmtDate(range.to, lang)}`)),
      entries.length
        ? el("div", {}, entries.map((e) => el("div", { class: "dash-entry" },
            el("div", { class: "spread", style: { marginBottom: "3px" } },
              el("span", { class: "row dash-entry-kind" }, icon(e.icon, 14), e.kind),
              el("span", { class: "hint" }, fmtDate(e.date, lang).replace(/,\s*\d{4}$/, ""))),
            ...e.lines.map(lineRow))))
        : el("div", { class: "dash-empty" }, icon("calendar", 16), ta ? "அட்டவணை இல்லை" : "Nothing scheduled"));
  }

  // One assignment line. Three shapes:
  //  • { label:null, value } → a bold heading (talk theme, fsm time/loc)
  //  • { muted:true, value } → a single muted note (e.g. unassigned-count summary)
  //  • { label, value }      → "Label : Value"; the label ellipsizes (title= full)
  //                            so long portion titles stay on one line.
  function lineRow(ln) {
    if (!ln) return null;
    if (ln.muted) return el("div", { class: "ta dash-note" }, ln.value);
    if (ln.label == null) return el("div", { class: "ta dash-head" }, ln.value);
    return el("div", { class: "ta dash-line" },
      el("span", { class: "dash-k", title: ln.label }, ln.label),
      el("span", { class: "dash-v" }, ln.value));
  }

  function weekEntries({ from, to }) {
    const inRange = (d) => d && d >= from && d <= to;
    const out = [];
    // Per-kind READ gating (Task 2): only surface a schedule the member may read.
    if (store.canReadKind("clm")) for (const w of store.get("clm")) if (inRange(w.date))
      out.push({ date: w.date, icon: "gem", kind: t("clm"), lines: clmLines(w) });
    if (store.canReadKind("weekend")) for (const w of store.get("weekend")) if (inRange(w.date))
      out.push({ date: w.date, icon: "calendar", kind: t("weekend"), lines: weekendLines(w) });
    if (store.canReadKind("av")) for (const r of store.get("av")) if (inRange(r.date))
      out.push({ date: r.date, icon: "volume", kind: t("av"), lines: fieldLines(r, "av") });
    if (store.canReadKind("cleaning")) for (const r of store.get("cleaning")) if (inRange(r.weekOf))
      out.push({ date: r.weekOf, icon: "broom", kind: t("cleaning"), lines: fieldLines(r, "cleaning") });
    if (store.canReadKind("fsm")) for (const r of store.get("fsm")) if (inRange(r.date))
      out.push({ date: r.date, icon: "briefcase", kind: t("fsm"), lines: fsmLines(r) });
    if (store.canReadKind("attendant")) for (const r of store.get("attendant")) if (inRange(r.date))
      out.push({ date: r.date, icon: "door", kind: t("attendant"), lines: fieldLines(r, "attendant") });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Declared as a hoisted function: the line helpers above call it during the
  // initial render, which runs before a `const` at this position would init.
  function withFallback(lines) { return lines.length ? lines : [{ label: null, value: "—" }]; }

  // AV / Cleaning / Attendant: one line per role, driven by kindFields.
  function fieldLines(rec, kind) {
    const groups = store.get("groups");
    const lines = kindFields(kind).map((f) => {
      let val = null;
      if (f.type === "group") { const g = groups.find((x) => x.id === rec[f.key]); val = g ? groupLabel(g, clang) : null; }
      else if (f.type === "person") val = nm(rec[f.key]) || null;
      else if (f.type === "text") val = rec[f.key] || null;
      else if (f.type === "check") val = rec[f.key] ? "Zoom" : null;
      return val ? { label: f.label, value: val } : null;
    }).filter(Boolean);
    return withFallback(lines);
  }

  function fsmLines(r) {
    const lines = [];
    const head = [r.time, r.loc, r.zoom ? "Zoom" : ""].filter(Boolean).join(" · ");
    if (head) lines.push({ label: null, value: head });
    const cond = nm(r.conductor);
    if (cond) lines.push({ label: L("நடத்துபவர்", "Conductor"), value: cond });
    return withFallback(lines);
  }

  function weekendLines(w) {
    const lines = [{ label: null, value: (w.talk && w.talk.theme) || "—" }];
    const spk = [nm(w.talk && w.talk.speaker), w.talk && w.talk.speakerCong].filter(Boolean).join(" · ");
    if (spk) lines.push({ label: L("பேச்சாளர்", "Speaker"), value: spk });
    if (w.chairman) lines.push({ label: L("சேர்மன்", "Chairman"), value: nm(w.chairman) });
    if (w.wt && w.wt.conductor) lines.push({ label: L("காவற்கோபுரம்", "Watchtower"), value: nm(w.wt.conductor) });
    if (w.wt && w.wt.reader) lines.push({ label: L("வாசிப்பு", "Reader"), value: nm(w.wt.reader) });
    return lines;
  }

  // Midweek: chairman + prayer, then each ASSIGNED portion as "portion title or
  // number: assignee (+ assistant / reader)". Unassigned portions (a title but no
  // assignee) are collapsed into a single muted count line so the card stays calm
  // and scannable; truly empty student parts are ignored. Chairman/prayer always show.
  function clmLines(w) {
    const lines = [{ label: L("சேர்மன்", "Chairman"), value: w.chairman ? nm(w.chairman) : "—" }];
    if (w.openingPrayer) lines.push({ label: L("ஜெபம்", "Prayer"), value: nm(w.openingPrayer) });
    const secs = w.sections || {};
    let n = 0, unassigned = 0;
    for (const key of ["treasures", "apply", "living"]) {
      for (const p of (secs[key] || [])) {
        n++;
        const who = nm(p.assignee);
        const title = p.title && String(p.title).trim();
        if (!who) { if (title) unassigned++; continue; }   // has a title but nobody → summarize
        const extras = [];
        if (p.assistant) { const a = nm(p.assistant); if (a) extras.push(a); }
        if (typeof p.reader === "string") { const rd = nm(p.reader); if (rd) extras.push(rd); }
        lines.push({ label: title || `#${n}`, value: [who, ...extras].join(" + ") });
      }
    }
    if (unassigned) lines.push({ muted: true,
      value: ta ? `${unassigned} பகுதிகள் நியமிக்கப்படவில்லை` : `${unassigned} portion${unassigned > 1 ? "s" : ""} unassigned` });
    if (w.closingPrayer && w.closingPrayer !== w.openingPrayer)
      lines.push({ label: L("ஜெபம்", "Prayer"), value: nm(w.closingPrayer) });
    return lines;
  }

  /* ---- pending schedules per month -------------------------------------- */
  function pendingCard(title, monthDate) {
    // Read gating (Task 2): only count schedules the member may read.
    const items = pendingForMonth(monthDate).filter((it) => store.canReadKind(it.kind));
    return el("div", { class: "card card-pad" },
      el("div", { class: "spread", style: { marginBottom: "8px" } },
        el("div", { class: "side-group", style: { padding: 0 } }, title),
        el("span", { class: "hint" }, monthName(monthDate, lang))),
      items.length ? el("div", {}, items.map((it) => {
        const done = it.expected > 0 && it.filled >= it.expected;
        const color = it.expected === 0 ? "var(--text-3)" : done ? "var(--ok)" : "var(--warn)";
        return el("div", { class: "spread row-click", style: { padding: "8px 0", borderBottom: "1px solid var(--border)" },
          onClick: () => { location.hash = "#/" + it.kind; } },
          el("span", { class: "row", style: { gap: "7px", color: "var(--text-2)", fontSize: "12.5px", fontWeight: 600 } }, icon(PENDING_KINDS[it.kind], 14), t(it.kind)),
          el("span", { style: { fontWeight: 700, fontSize: "12.5px", color } }, it.expected === 0 ? "—" : `${it.filled}/${it.expected}`));
      })) : el("div", { class: "dash-empty" }, icon("lock", 16), ta ? "பார்வை அனுமதி இல்லை" : "No read access"));
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
