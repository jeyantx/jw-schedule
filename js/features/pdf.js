// ============================================================================
// PDF / IMAGE EXPORT — sends self-contained HTML to the backend SmartBrowz
// endpoints and downloads (or shares) the returned PDF / PNG. Every action
// shows a persistent spinner toast that stays up for the whole backend call
// (which can take several seconds) and only then swaps to success / error.
// PDF download falls back to the browser print dialog offline; images don't.
// ============================================================================
import { api } from "../api.js";
import { el, icon, modal, toast } from "../ui.js";
import { getLang, t } from "../i18n.js";

/* ---- shared helpers ----------------------------------------------------- */
// Persistent "working…" toast with a spinner; returns the toast handle so the
// caller can .update(...) it to a success/error state (auto-dismissing) or
// .dismiss() it (e.g. before handing off to the native share sheet).
function busy(message) {
  return toast(el("span", { class: "row", style: { gap: "10px", alignItems: "center" } },
    el("span", { class: "spinner", "aria-hidden": "true" }), message), "", { persist: true });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Offline / server error → open a print window of the same HTML as a fallback.
function pdfPrintFallback(html, e) {
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); toast("Using browser print (offline)"); }
  else toast((e && e.message) || "Export failed", "danger");
}

// Share a blob via the Web Share API level-2 (files). Falls back to a plain
// download when the platform can't share files, or when share fails for any
// reason other than the user cancelling (AbortError → silent). iOS requires
// share to run under transient user activation; if the pre-share network fetch
// exceeds that window and share throws, the fallback download covers it.
async function shareBlob(blob, filename, mime, title) {
  const ta = getLang() === "ta";
  const file = new File([blob], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; }
    catch (e) {
      if (e && e.name === "AbortError") return; // user cancelled — stay silent
      downloadBlob(blob, filename);
      toast(ta ? "பகிர்வு கிடைக்கவில்லை — பதிவிறக்கப்பட்டது" : "Sharing unavailable — downloaded instead");
      return;
    }
  }
  // Desktop browsers without file-share support → download the same blob.
  downloadBlob(blob, filename);
  toast(ta ? "பகிர்வு கிடைக்கவில்லை — பதிவிறக்கப்பட்டது" : "Sharing unavailable — downloaded instead");
}

/* ---- plain download paths ---------------------------------------------- */
export async function exportPdf(html, filename = "schedule", { landscape = true, marginMm = 6 } = {}) {
  const b = busy(t("saving"));
  try {
    const blob = await api.pdf(html, { landscape, marginMm, filename });
    downloadBlob(blob, `${filename}.pdf`);
    b.update(t("saved"), "ok");
  } catch (e) {
    b.dismiss();
    pdfPrintFallback(html, e);
  }
}

export async function exportImage(html, filename = "schedule", { width = 1120 } = {}) {
  const b = busy(t("saving"));
  try {
    const blob = await api.image(html, { width, fullPage: true, filename });
    downloadBlob(blob, `${filename}.png`);
    b.update(t("saved"), "ok");
  } catch (e) {
    b.update(e.message || "Export failed", "danger");
  }
}

/* ---- Download / Share menu --------------------------------------------- */
// Opens a small modal with four full-width actions (Download / Share × PDF /
// image). `getHtml` may be async (CLM builds its HTML with embedded icons) —
// it is awaited once per action under the spinner toast. The modal closes
// before the async work so the toast is visible; a running-guard + disabled
// rows stop a fast double-click firing twice. Image width follows orientation
// (landscape boards ≈ 1120px wide, portrait ≈ 800px).
export function exportMenu({ getHtml, filename = "schedule", landscape = true, marginMm = 6, title } = {}) {
  const ta = getLang() === "ta";
  const width = landscape ? 1120 : 800;

  const perform = async (kind) => {
    const b = busy(t("saving"));
    let html;
    try { html = await getHtml(); }
    catch (e) { b.update(e.message || "Export failed", "danger"); return; }
    try {
      if (kind === "pdf-dl") {
        const blob = await api.pdf(html, { landscape, marginMm, filename });
        downloadBlob(blob, `${filename}.pdf`); b.update(t("saved"), "ok");
      } else if (kind === "pdf-share") {
        const blob = await api.pdf(html, { landscape, marginMm, filename });
        b.dismiss(); await shareBlob(blob, `${filename}.pdf`, "application/pdf", title || filename);
      } else if (kind === "img-dl") {
        const blob = await api.image(html, { width, fullPage: true, filename });
        downloadBlob(blob, `${filename}.png`); b.update(t("saved"), "ok");
      } else if (kind === "img-share") {
        const blob = await api.image(html, { width, fullPage: true, filename });
        b.dismiss(); await shareBlob(blob, `${filename}.png`, "image/png", title || filename);
      }
    } catch (e) {
      if (kind === "pdf-dl") { b.dismiss(); pdfPrintFallback(html, e); }
      else b.update(e.message || "Export failed", "danger");
    }
  };

  const items = [
    { ic: "download", label: ta ? "PDF பதிவிறக்கு" : "Download PDF", kind: "pdf-dl" },
    { ic: "share", label: ta ? "PDF பகிர்" : "Share PDF", kind: "pdf-share" },
    { ic: "image", label: ta ? "படம் பதிவிறக்கு" : "Download image", kind: "img-dl" },
    { ic: "image", label: ta ? "படம் பகிர்" : "Share image", kind: "img-share" },
  ];

  let running = false, close;
  const btns = items.map((it) => el("button", { class: "btn export-row",
    onClick: () => {
      if (running) return;                       // guard against double-fire
      running = true;
      btns.forEach((b) => { b.disabled = true; });
      close(); perform(it.kind);
    } }, icon(it.ic, 18), el("span", {}, it.label)));

  ({ close } = modal({
    title: ta ? "பதிவிறக்கு / பகிர்" : "Download / Share",
    body: el("div", { class: "export-menu" }, btns),
  }));
}
