// ============================================================================
// INTELLIGENCE — derives per-publisher insight from every schedule document:
// assignment history, who they've partnered with, last-assigned, workload.
// Pure functions over the store's docs (no network).
// ============================================================================
import { store } from "../store.js";

// Flatten every assignment across all areas into { pubId, date, area, role, partnerId }.
export function collectAssignments() {
  const out = [];
  const push = (pubId, date, area, role, partnerId = null) => {
    if (pubId) out.push({ pubId, date: date || "", area, role, partnerId });
  };

  // CLM
  for (const w of store.get("clm")) {
    push(w.chairman, w.date, "clm", "clm.chairman");
    push(w.openingPrayer, w.date, "clm", "clm.prayer");
    push(w.closingPrayer, w.date, "clm", "clm.prayer");
    const secs = w.sections || {};
    (secs.treasures || []).forEach((p) => push(p.assignee, w.date, "clm", "clm.treasures"));
    (secs.apply || []).forEach((p) => {
      push(p.assignee, w.date, "clm", "clm.student", p.assistant);
      push(p.assistant, w.date, "clm", "clm.student", p.assignee);
    });
    (secs.living || []).forEach((p) => {
      const rid = typeof p.reader === "string" ? p.reader : null;
      const cbs = p.cbs === true || p.reader === true || rid != null;
      push(p.assignee, w.date, "clm", cbs ? "clm.cbs.conductor" : "clm.living", rid);
      if (rid) push(rid, w.date, "clm", "clm.cbs.reader", p.assignee);
    });
  }
  // Weekend
  for (const w of store.get("weekend")) {
    push(w.chairman, w.date, "weekend", "weekend.chairman");
    if (w.talk) push(w.talk.speaker, w.date, "weekend", "weekend.talk");
    if (w.wt) { push(w.wt.conductor, w.date, "weekend", "weekend.wt.conductor", w.wt.reader); push(w.wt.reader, w.date, "weekend", "weekend.wt.reader", w.wt.conductor); }
  }
  // AV
  for (const r of store.get("av")) { push(r.mixer, r.date, "av", "av.mixer"); push(r.media, r.date, "av", "av.media"); push(r.micLeft, r.date, "av", "av.mic"); push(r.micRight, r.date, "av", "av.mic"); }
  // FSM
  for (const r of store.get("fsm")) push(r.conductor, r.date, "fsm", "fsm.conductor");
  // Cleaning in-charge
  for (const r of store.get("cleaning")) push(r.incharge, r.weekOf, "cleaning", "cleaning.incharge");
  // Attendant
  for (const r of store.get("attendant")) { push(r.hall, r.date, "attendant", "attendant.attendant"); push(r.entrance, r.date, "attendant", "attendant.attendant"); push(r.video, r.date, "attendant", "attendant.attendant"); }

  return out;
}

export function statsFor(pubId, all = collectAssignments()) {
  const mine = all.filter((a) => a.pubId === pubId).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const partners = {};
  const byRole = {};
  for (const a of mine) {
    byRole[a.role] = (byRole[a.role] || 0) + 1;
    if (a.partnerId) partners[a.partnerId] = (partners[a.partnerId] || 0) + 1;
  }
  return {
    total: mine.length,
    history: mine,
    lastDate: mine[0]?.date || null,
    byRole,
    partners: Object.entries(partners).sort((a, b) => b[1] - a[1]),
  };
}

// Workload map pubId -> count, plus the average, for fairness comparisons.
export function workload(all = collectAssignments()) {
  const map = {};
  for (const a of all) map[a.pubId] = (map[a.pubId] || 0) + 1;
  const counts = Object.values(map);
  const avg = counts.length ? counts.reduce((x, y) => x + y, 0) / counts.length : 0;
  return { map, avg, max: Math.max(1, ...counts) };
}

// For a role + optional gender, rank qualified publishers least-recently-used first
// (so the UI can suggest a fair next pick). Exempt publishers (attend rarely) are
// excluded by default; pass { includeExempt: true } to keep them.
export function suggestFor(role, gender, { includeExempt = false, all = collectAssignments() } = {}) {
  const last = {};
  for (const a of all) if (a.role === role) if (!last[a.pubId] || a.date > last[a.pubId]) last[a.pubId] = a.date;
  return store.get("publishers")
    .filter((p) => p.active !== false && (p.roles || []).includes(role) && (!gender || p.gender === gender) && (includeExempt || !p.exempt))
    .map((p) => ({ p, last: last[p.id] || "" }))
    .sort((a, b) => (a.last || "").localeCompare(b.last || ""));
}

const daysBetween = (isoA, isoB) => Math.round((new Date(isoA + "T00:00:00") - new Date(isoB + "T00:00:00")) / 86400000);

// Active, non-exempt, (optionally role-)qualified publishers ranked by how long
// they've gone without ANY assignment — never-assigned first. days = null → never.
export function missingSince(role = null, all = collectAssignments()) {
  const last = {};
  for (const a of all) if (!last[a.pubId] || a.date > last[a.pubId]) last[a.pubId] = a.date;
  const today = new Date().toISOString().slice(0, 10);
  return store.get("publishers")
    .filter((p) => p.active !== false && !p.exempt && (!role || (p.roles || []).includes(role)))
    .map((p) => ({ p, last: last[p.id] || null, days: last[p.id] ? Math.max(0, daysBetween(today, last[p.id])) : null }))
    .sort((a, b) => (a.days == null ? -1 : b.days == null ? 1 : b.days - a.days));
}

// Publishers with ≥2 assignments within the last `windowWeeks` weeks, with counts,
// sorted busiest-first — surfaces who is being leaned on too heavily lately.
export function recentRepeats(windowWeeks = 8, all = collectAssignments()) {
  const cutoff = new Date(Date.now() - windowWeeks * 7 * 86400000).toISOString().slice(0, 10);
  const count = {};
  for (const a of all) if (a.date && a.date >= cutoff) count[a.pubId] = (count[a.pubId] || 0) + 1;
  const pubs = store.get("publishers");
  return Object.entries(count).filter(([, n]) => n >= 2)
    .map(([id, n]) => ({ p: pubs.find((x) => x.id === id) || { id }, count: n }))
    .sort((a, b) => b.count - a.count);
}
