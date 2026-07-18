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

// Path under wol.jw.org for a workbook month page (month name lowercase english;
// workbook year = the date's year). 2026 pattern confirmed; template reusable.
export function workbookMonthPath(date, lang = "en") {
  const y = date.getFullYear();
  const month = MONTHS[date.getMonth()];
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

// Fetch + parse the workbook month page for `monthDate` via the backend proxy.
export async function fetchWeekImages(monthDate, lang = "en") {
  const html = await api.wolFetch(workbookMonthPath(monthDate, lang));
  return parseWeekImages(html, monthDate);
}

// The wol week (from fetchWeekImages) whose Mon–Sun range contains clmDate → its img.
export function matchWeekImage(weeks, clmDate) {
  for (const w of weeks || []) if (clmDate >= w.start && clmDate <= addDays(w.start, 6)) return w.img;
  return null;
}
