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

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_TA = ["ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்","ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்"];
export const monthName = (d, lang) => `${(lang === "ta" ? MONTHS_TA : MONTHS_EN)[d.getMonth()]} ${d.getFullYear()}`;
export function fmtDate(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  const m = (lang === "ta" ? MONTHS_TA : MONTHS_EN)[d.getMonth()];
  return `${m} ${d.getDate()}, ${d.getFullYear()}`;
}
