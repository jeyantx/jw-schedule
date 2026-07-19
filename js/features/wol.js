// ============================================================================
// WOL — pulls the weekly meeting-workbook thumbnails from wol.jw.org (through
// the backend proxy, since the listing page blocks cross-origin fetches). The
// parser is regex-based so it runs unchanged in the browser AND under node:test.
// The image URLs themselves render in-app straight from the wol CDN (no CORS).
// ============================================================================
import { api } from "../api.js";

const WOL_BASE = "https://wol.jw.org";
const MONTHS = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];

// The workbook is BIMONTHLY: one page per cover month (Jan, Mar, May, Jul, Sep,
// Nov) carries BOTH that month and the next (e.g. the "july" page lists every
// week of July AND August). So an August/April date must resolve to its cover
// month, else wol 307-redirects to the workbook root and nothing parses.
const coverMonthIndex = (m) => m - (m % 2);   // 7(Aug)->6(Jul), 3(Apr)->2(Mar)

// Path under wol.jw.org for a workbook month page (cover month lowercase english;
// workbook year = the date's year). 2026 pattern confirmed; template reusable.
export function workbookMonthPath(date, lang = "en") {
  const y = date.getFullYear();
  const month = MONTHS[coverMonthIndex(date.getMonth())];
  return `${lang}/wol/library/r1/lp-e/all-publications/meeting-workbooks/life-and-ministry-meeting-workbook-${y}/${month}`;
}

// A workbook week always runs Monday–Sunday, so the range's *start* day IS the
// Monday. Resolve the ISO start date, nudging Dec/Jan across the year boundary.
function isoStart(monthName, day, monthDate) {
  const mi = MONTHS.indexOf(String(monthName).toLowerCase());
  if (mi < 0 || !day) return null;
  let year = monthDate.getFullYear();
  const pageMonth = monthDate.getMonth();
  if (mi === 11 && pageMonth === 0) year -= 1;   // December items on a January page
  if (mi === 0 && pageMonth === 11) year += 1;   // January items on a December page
  return `${year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
const absUrl = (src) => (/^https?:\/\//i.test(src) ? src : WOL_BASE + (src.startsWith("/") ? src : "/" + src));
const addDays = (iso, n) => new Date(new Date(iso + "T00:00:00").getTime() + n * 86400000).toISOString().slice(0, 10);

// Week-range matcher, e.g. "July 6-12" or "June 29–July 5" (hyphen or en-dash).
export const WEEK_RANGE_RE = /([A-Z][a-z]+)\s+(\d{1,2})\s*[–-]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2})/g;

// Pure parse: find each week-range label + its nearest <img>. One entry per
// unique start date. Liberal — labels without any nearby image are skipped.
export function parseWeekImages(html, monthDate) {
  const imgs = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((m) => ({ src: m[1], at: m.index }));
  const out = [], seen = new Set();
  const re = new RegExp(WEEK_RANGE_RE.source, "g");
  let m;
  while ((m = re.exec(html))) {
    const start = isoStart(m[1], +m[2], monthDate);
    if (!start || seen.has(start) || !imgs.length) continue;
    // In each card the thumbnail precedes its title, so bind to the closest
    // PRECEDING img; fall back to the overall nearest if none comes before.
    const before = imgs.filter((i) => i.at <= m.index);
    const near = before.length
      ? before[before.length - 1]
      : imgs.reduce((best, i) => Math.abs(i.at - m.index) < Math.abs(best.at - m.index) ? i : best);
    seen.add(start);
    out.push({ start, label: m[0].replace(/\s+/g, " ").trim(), img: absUrl(near.src) });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// Fetch the workbook month's weeks (with thumbnails) via the backend proxy.
// BUG 5 FIX: this now routes through fetchMonthPrograms, which merges the PREVIOUS
// cover page — so a July-1 date matches the "June 29–July 5" week carried on the
// May–June cover, instead of coming back empty. Each week has {start,range,docPath,img}
// and matchWeekImage works on w.start / w.img just as before.
export async function fetchWeekImages(monthDate, lang = "en") {
  const { weeks } = await fetchMonthPrograms(monthDate, lang);
  return weeks;
}

// The wol week (from fetchWeekImages) whose Mon–Sun range contains clmDate → its img.
export function matchWeekImage(weeks, clmDate) {
  for (const w of weeks || []) if (clmDate >= w.start && clmDate <= addDays(w.start, 6)) return w.img;
  return null;
}

// ============================================================================
// PROGRAM PARSING — turns a workbook *week* doc page into a structured program
// so the midweek view can pre-create a week (counts, durations, part types,
// CBS flag, titles). Regex-based like parseWeekImages so it runs under node.
// The Tamil edition shares the SAME doc ids under r122/lp-tl (verified live:
// /en/wol/d/r1/lp-e/202026242 ↔ /ta/wol/d/r122/lp-tl/202026242), so content-
// language prefill just swaps the path prefix — see tamilDocPath(). The Tamil
// markers below are the exact phrases from those live pages.
// ============================================================================

// Same workbook week, Tamil edition: en doc path → its r122/lp-tl counterpart.
export const tamilDocPath = (docPath) =>
  String(docPath).replace(/^\/?en\/wol\/d\/r1\/lp-e\//, "ta/wol/d/r122/lp-tl/");

const stripTags = (s) => String(s)
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&mdash;/g, "—")
  .replace(/&[a-z]+;/gi, " ")
  .replace(/\s+/g, " ").trim();

// Duration "(10 min.)" / "(10 நிமி.)" → 10. Flexible whitespace + entities.
const DURATION_RE = /\(\s*(\d+)\s*(?:min|நிமி)/i;
function firstDuration(chunk) { const m = DURATION_RE.exec(chunk); return m ? +m[1] : null; }

// Ministry (apply) part-kind → the app's portion codes. English phrases are
// exact; the Tamil ones are the live r122/lp-tl phrasings ("பேச ஆரம்பிப்பது" =
// Starting a Conversation, "மறுபடியும் சந்திப்பது" = Following Up, "சீஷர்களை
// உருவாக்குவது" = Making Disciples, "நம்பிக்கைகளை விளக்குவது" = Explaining Your
// Beliefs, "பேச்சு" = Talk). Unknown → null (user picks the chip manually).
function applyType(title) {
  const t = title.toLowerCase();
  if (/starting a conversation/.test(t) || /பேச ஆரம்பி/.test(title) || /உரையாடல/.test(title)) return "SC";
  if (/following up/.test(t) || /மறுபடியும் சந்திப்/.test(title) || /மறுசந்திப்/.test(title)) return "FU";
  if (/making disciples/.test(t) || /சீஷர்களை உருவாக்க?ு/.test(title)) return "MD";
  if (/explaining your beliefs/.test(t) || /நம்பிக்கைகளை விளக்க?ு/.test(title)) return "EB";
  if (/\btalk\b/.test(t) || /^பேச்சு/.test(title)) return "T";
  return null;
}
// Treasures part 2 — en "Spiritual Gems", ta "புதையல்களைத் தோண்டி எடுங்கள்".
const isGems = (title) => /spiritual gems/i.test(title) || /புதையல்களைத் தோண்டி/.test(title);
const isReading = (title) => /bible reading/i.test(title) || /பைபிள் வாசிப்/.test(title);
const isCbs = (title) => /congregation bible study/i.test(title) || /சபை பைபிள் படிப்/.test(title);
// Memorial / special weeks carry no meeting — flag the page so callers can say
// so instead of writing an empty week.
const MEMORIAL_RE = /\bmemorial\b/i;
const MEMORIAL_TA_RE = /நினைவு ?ஆசரிப்/;

// Pure parse of a workbook *week* doc page. Returns null when the page is not a
// regular meeting (no Treasures/Ministry/Living section markers) — e.g. the
// "Memorial Bible Reading Schedule" doc, or a special-event/unpublished page.
export function parseWeekProgram(html) {
  const art = sliceArticle(html);
  const gem = art.search(/dc-icon--gem/);
  const wheat = art.search(/dc-icon--wheat/);
  const sheep = art.search(/dc-icon--sheep/);
  if (gem < 0 || wheat < 0 || sheep < 0) return null;   // not a meeting page

  const weekRange = parseTitleRange(html);
  // Songs — en "Song 34", ta "பாட்டு 34" (opening / middle / closing). No \b
  // before the Tamil word: JS word boundaries are ASCII-only and never match there.
  const songs = [...art.matchAll(/(?:\bSong|பாட்டு)\s*(?:<[^>]*>)*\s*(\d{1,3})/gi)].map((m) => +m[1]);

  const treasures = [], apply = [], living = [];
  // Every real part is a NUMBERED <h3> heading ("1. …"); the duration sits in the
  // text that follows, up to the next heading. Non-numbered h3 (Song, Opening/
  // Concluding Comments) are chairman items, not section parts → skipped.
  const heads = [...art.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  for (let i = 0; i < heads.length; i++) {
    const at = heads[i].index;
    const text = stripTags(heads[i][1]);
    const nm = /^(\d+)\.\s*(.+)$/.exec(text);
    if (!nm) continue;
    const title = nm[2].trim();
    const follow = art.slice(heads[i].index, heads[i + 1] ? heads[i + 1].index : art.length);
    const min = firstDuration(follow);
    if (at < wheat) {          // TREASURES
      const kind = isGems(title) ? "gems" : isReading(title) ? "reading" : "talk";
      treasures.push({ title, min, kind });
    } else if (at < sheep) {   // APPLY YOURSELF TO THE FIELD MINISTRY
      apply.push({ title, min, type: applyType(title) });
    } else {                   // LIVING AS CHRISTIANS
      living.push({ title, min, cbs: isCbs(title) });
    }
  }
  return { weekRange, songs, treasures, apply, living };
}

// True when the month/week page belongs to a Memorial week (no midweek meeting).
export function isMemorialPage(html) {
  return MEMORIAL_RE.test(html) || MEMORIAL_TA_RE.test(html);
}

function sliceArticle(html) {
  const a = html.indexOf("<article");
  if (a < 0) return html;
  const end = html.indexOf("</article>", a);
  return end < 0 ? html.slice(a) : html.slice(a, end);
}
// <title>July 13-19 — Watchtower ONLINE LIBRARY</title> → "July 13-19";
// Tamil edition: "ஜூலை 13-19 — …" → "ஜூலை 13-19" (month word is Tamil, so fall
// back to any "<word> N–N" day-range shape rather than the English-month regex).
function parseTitleRange(html) {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const head = stripTags(m[1]).split(/—|\|/)[0].trim();
  if (new RegExp(WEEK_RANGE_RE.source).test(head)) return head;
  return /^\S{2,}\s+\d{1,2}\s*[–-]\s*(?:\S+\s+)?\d{1,2}$/.test(head) ? head : null;
}

// ---------------------------------------------------------------------------
// Month page → each week's { start, range, docPath, img }. Reuses the anchor
// blocks that already carry the thumbnail; the doc href is the anchor's own
// target. Cards without a Mon–Sun range (month overview, Memorial schedule) are
// skipped — they are not weekly meetings.
export function parseMonthWeeks(html, monthDate) {
  const out = [], seen = new Set();
  const rangeRe = new RegExp(WEEK_RANGE_RE.source);
  const re = /<a\b[^>]*\bhref=["'](\/[a-z]{2}\/wol\/d\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const docPath = m[1], inner = m[2];
    const rm = rangeRe.exec(inner);
    if (!rm) continue;
    const start = isoStart(rm[1], +rm[2], monthDate);
    if (!start || seen.has(start)) continue;
    const img = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(inner);
    seen.add(start);
    out.push({ start, range: stripTags(rm[0]), docPath, img: img ? absUrl(img[1]) : null });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// The week whose Mon–Sun window contains clmDate.
export function matchWeek(weeks, clmDate) {
  return (weeks || []).find((w) => clmDate >= w.start && clmDate <= addDays(w.start, 6)) || null;
}

// Candidate midweek dates minus any that already have a saved week — the set a
// month-level auto-fill may create. Encodes the "never overwrite" rule so it is
// unit-testable independently of the (DOM-bound) view.
export function pendingWeekDates(existingDates, candidates) {
  const have = new Set(existingDates || []);
  return [...new Set(candidates || [])].filter((d) => !have.has(d)).sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Fetchers (through the backend proxy). A tiny cache dedupes repeat fetches of
// the same path within a session (month auto-fill hits one month page + N docs).
// Keys are normalized to the backend's path form (no leading slash) so a body
// fetched via the batch endpoint and one fetched via /wol/fetch share a slot.
const _cache = new Map();   // normPath -> Promise<string html>
const norm = (p) => String(p).replace(/^\/+/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wolCached(path) {
  const key = norm(path);
  if (_cache.has(key)) return _cache.get(key);
  const p = api.wolFetch(key).catch((e) => { _cache.delete(key); throw e; });
  _cache.set(key, p);
  return p;
}

// Batch-fetch a set of paths through the backend job endpoint, populating _cache.
// Resolves once every requested path is cached (bodies) or has failed. onProgress
// (done, total) counts across the WHOLE requested set (already-cached paths count
// as done), so a re-run reports 100% instantly. Catalyst recycles an idle JVM after
// ~1 min; a poll that lands on a fresh instance gets a 410 (job map empty) → we
// transparently RESUBMIT the batch once (most paths are then L2-cache hits upstream
// and finish fast).
const BATCH_POLL_MS = 1500;
const BATCH_MAX_MS = 90000;

// Pure: classify a finished job's requested paths into fetched bodies vs failures.
// `results`/`errors` are the maps the backend returns; a path present in neither
// (shouldn't happen for a finished job) is treated as a failure.
export function assembleBatch(paths, results = {}, errors = {}) {
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const bodies = {}, failed = [];
  for (const p of paths || []) {
    if (has(results, p)) bodies[p] = results[p];
    else failed.push(p);
  }
  return { bodies, failed };
}

async function batchFetch(paths, onProgress) {
  const want = [...new Set((paths || []).map(norm))];
  const missing = [];
  const deferreds = {};
  for (const key of want) {
    if (_cache.has(key)) continue;
    let resolve, reject;
    const pr = new Promise((res, rej) => { resolve = res; reject = rej; });
    pr.catch(() => {});   // a failed-path promise may never be awaited → swallow to avoid warnings
    _cache.set(key, pr);
    deferreds[key] = { resolve, reject };
    missing.push(key);
  }
  const total = want.length;
  const already = total - missing.length;
  if (onProgress) onProgress(already, total);
  if (!missing.length) return;

  const submit = async () => {
    const { jobId } = await api.wolBatch(missing);
    return jobId;
  };
  try {
    let jobId = await submit();
    let resubmitted = false;
    const startedAt = Date.now();
    for (;;) {
      await sleep(BATCH_POLL_MS);
      let st;
      try {
        st = await api.wolBatchStatus(jobId);
      } catch (e) {
        if (e && e.status === 410 && !resubmitted) { resubmitted = true; jobId = await submit(); continue; }
        throw e;
      }
      if (onProgress) onProgress(already + (st.done || 0), total);
      if (st.finished) {
        const errors = st.errors || {};
        const { bodies, failed } = assembleBatch(missing, st.results, errors);
        for (const key of Object.keys(bodies)) deferreds[key].resolve(bodies[key]);
        for (const key of failed) {
          _cache.delete(key);   // failed path — let a later single fetch retry it
          deferreds[key].reject(new Error(errors[key] || "wol fetch failed"));
        }
        return;
      }
      if (Date.now() - startedAt > BATCH_MAX_MS) throw new Error("wol batch timed out");
    }
  } catch (e) {
    for (const key of missing) { _cache.delete(key); deferreds[key].reject(e); }
    throw e;
  }
}

// The doc path in the resolved content language (ta → aligned r122/lp-tl edition).
const docPathForLang = (docPath, lang) => (lang === "ta" ? tamilDocPath(docPath) : norm(docPath));

// Fetch + parse one week doc. lang "ta" fetches the Tamil edition of the SAME
// doc (aligned ids, see tamilDocPath) so titles/durations prefill in Tamil;
// if the Tamil page is missing or doesn't parse, silently falls back to English.
export async function fetchWeekProgram(docPath, lang = "en") {
  const enPath = docPath.replace(/^\//, "");   // proxy wants a bare path
  if (lang === "ta") {
    const taPath = tamilDocPath(enPath);
    if (taPath !== enPath) {
      try {
        const html = await wolCached(taPath);
        const program = parseWeekProgram(html);
        if (program) return { html, program, memorial: isMemorialPage(html) };
      } catch { /* Tamil edition unavailable → English below */ }
    }
  }
  const html = await wolCached(enPath);
  return { html, program: parseWeekProgram(html), memorial: isMemorialPage(html) };
}

// All weeks for the calendar month of `monthDate`, with doc paths + images.
// Merges the cover page (which spans two months) with the PREVIOUS cover page
// when a leading week straddles the month boundary (e.g. "June 29–July 5" lives
// on the May–June page, not the July page). Returns { weeks, hasMemorial }.
//
// The two cover pages are quick single fetches (kept off the batch so a per-week
// auto-fill stays snappy). With opts.prefetchDocs, every week's doc page is then
// pulled in ONE background batch job — surviving Catalyst's ~60s request cap —
// so the subsequent fetchWeekProgram() calls are instant cache hits. opts.onProgress
// (done, total) is wired to the persistent toast during that doc prefetch.
export async function fetchMonthPrograms(monthDate, lang = "en", opts = {}) {
  const { prefetchDocs = false, onProgress } = opts;
  const html = await wolCached(workbookMonthPath(monthDate, lang));
  let weeks = parseMonthWeeks(html, monthDate);
  let hasMemorial = isMemorialPage(html);

  // A midweek date earlier than the first parsed week means a cross-month week
  // is carried on the previous cover page — pull it and merge.
  const firstOfMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-01`;
  if (!weeks.length || weeks[0].start > firstOfMonth) {
    const prevCover = new Date(monthDate.getFullYear(), coverMonthIndex(monthDate.getMonth()) - 2, 1);
    try {
      const prevHtml = await wolCached(workbookMonthPath(prevCover, lang));
      hasMemorial = hasMemorial || isMemorialPage(prevHtml);
      const byStart = new Map(weeks.map((w) => [w.start, w]));
      for (const w of parseMonthWeeks(prevHtml, prevCover)) if (!byStart.has(w.start)) byStart.set(w.start, w);
      weeks = [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
    } catch { /* previous cover not published yet — carry on with what we have */ }
  }

  if (prefetchDocs && weeks.length) {
    // Best-effort: individual doc failures leave that path uncached (a later single
    // fetch retries), so never let the batch reject bubble up and abort the month.
    try {
      await batchFetch(weeks.map((w) => docPathForLang(w.docPath, lang)), onProgress);
    } catch { /* fall back to per-week single fetches below */ }
  }
  return { weeks, hasMemorial };
}
