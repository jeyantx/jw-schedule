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
  for (const r of store.get("av")) { push(r.console, r.date, "av", "av.console"); push(r.stage, r.date, "av", "av.stage"); push(r.roving, r.date, "av", "av.roving"); }
  // FSM
  for (const r of store.get("fsm")) push(r.conductor, r.date, "fsm", "fsm.conductor");
  // Attendant
  for (const r of store.get("attendant")) (r.attendants || []).forEach((id) => push(id, r.date, "attendant", "attendant.attendant"));

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
// (so the UI can suggest a fair next pick).
export function suggestFor(role, gender, all = collectAssignments()) {
  const last = {};
  for (const a of all) if (a.role === role) if (!last[a.pubId] || a.date > last[a.pubId]) last[a.pubId] = a.date;
  return store.get("publishers")
    .filter((p) => p.active !== false && (p.roles || []).includes(role) && (!gender || p.gender === gender))
    .map((p) => ({ p, last: last[p.id] || "" }))
    .sort((a, b) => (a.last || "").localeCompare(b.last || ""));
}
