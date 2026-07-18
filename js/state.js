// ============================================================================
// Shared app state — current month + hooks the shell wires up (nav + refresh).
// Kept dependency-free so both app.js and views can import it without cycles.
// ============================================================================
export const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const S = {
  month: firstOfMonth(new Date()),
  go: () => {},        // navigate to a route (set by app)
  refresh: () => {},   // re-render current view (set by app)
};

export function shiftMonth(n) {
  S.month = new Date(S.month.getFullYear(), S.month.getMonth() + n, 1);
  S.refresh();
}
export const monthKey = (d = S.month) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const inMonth = (iso, d = S.month) => typeof iso === "string" && iso.startsWith(monthKey(d));

// ISO dates of every occurrence of `weekday` (0=Sun..6=Sat) in the month.
export function monthDates(weekday, d = S.month) {
  const y = d.getFullYear(), m = d.getMonth(), out = [];
  const dt = new Date(y, m, 1);
  dt.setDate(1 + ((weekday - dt.getDay() + 7) % 7));
  while (dt.getMonth() === m) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
    dt.setDate(dt.getDate() + 7);
  }
  return out;
}

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_TA = ["ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்","ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்"];
export const monthName = (d, lang) => `${(lang === "ta" ? MONTHS_TA : MONTHS_EN)[d.getMonth()]} ${d.getFullYear()}`;
// A month or month-range label: single name when from/to share a month
// ("ஜூலை 2026"), else a range — year shown once when the span stays in one
// year ("ஜூலை – ஆகஸ்ட் 2026"), or on both ends when it crosses years
// ("டிசம்பர் 2026 – ஜனவரி 2027").
export function monthRangeLabel(from, to, lang) {
  const M = lang === "ta" ? MONTHS_TA : MONTHS_EN;
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) return monthName(from, lang);
  if (from.getFullYear() === to.getFullYear()) return `${M[from.getMonth()]} – ${M[to.getMonth()]} ${to.getFullYear()}`;
  return `${monthName(from, lang)} – ${monthName(to, lang)}`;
}
export function fmtDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  const m = (lang === "ta" ? MONTHS_TA : MONTHS_EN)[d.getMonth()];
  return `${m} ${d.getDate()}, ${d.getFullYear()}`;
}
