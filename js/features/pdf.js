// ============================================================================
// PDF — sends self-contained HTML to the backend SmartBrowz endpoint and
// downloads the returned PDF. Falls back to the browser print dialog offline.
// ============================================================================
import { api } from "../api.js";
import { toast } from "../ui.js";
import { t } from "../i18n.js";

export async function exportPdf(html, filename = "schedule", { landscape = true } = {}) {
  toast(t("saving"));
  try {
    const blob = await api.pdf(html, { landscape, filename });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filename}.pdf`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(t("saved"), "ok");
  } catch (e) {
    // Offline / server error → open a print window of the same HTML as a fallback.
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); toast("Using browser print (offline)"); }
    else toast(e.message || "Export failed", "danger");
  }
}
