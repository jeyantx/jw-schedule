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

/* ---- image tight-crop + sharpen ----------------------------------------- */
// The backend /image endpoint screenshots the HTML at a viewport `width`
// (clamped 320..2400) and captures the FULL page. The board/card templates
// render a small element centred inside an A4-ish body, so a plain screenshot
// is mostly empty margin and — being 1× — soft. For the image path only we:
//   1. wrap the body content in a zoom div (SmartBrowz honours CSS `zoom`, same
//      as the CLM print-fit) so text is rasterised `zoom`× sharper, and
//   2. strip page margins + the board's auto-centering so the full-page capture
//      hugs the content with no empty band.
// Then we ask for width = contentWidth × zoom so the viewport equals the scaled
// content exactly → a tight crop. Never applied on the PDF path.
//
// Zoom is 3×, not 2×: the backend screenshot height is max(contentHeight, 800px
// viewport floor) — measured live. At 2× a typical weekly card (~330px tall)
// renders ~660px < 800 → padded with an empty band (exactly the whitespace the
// user reported). At 3× a multi-field card clears 800px so the capture hugs it,
// and the extra sharpness helps small WhatsApp thumbnails. Wide boards just clamp
// to IMG_MAX_W (recomputing zoom), so 3× never overflows the backend limit.
const IMG_ZOOM = 3;       // 3× rasterisation + clears the 800px height floor for cards
const IMG_MAX_W = 2400;   // backend viewport clamp (width)
const IMG_PAD = 6;        // a few px of white on the right so a border is never clipped

// Pure string transform (exported for unit tests). Injects an override <style>
// before </head> and wraps the <body> content in <div id="__imgzoom">.
export function imageWrapHtml(html, zoom = IMG_ZOOM) {
  const css = `<style id="__imgfit">`
    + `html,body{margin:0!important;padding:0!important;background:#fff!important;text-align:left!important}`
    + `#__imgzoom{zoom:${zoom};display:inline-block;background:#fff}`
    + `#__imgzoom>*{margin:0!important}`
    + `</style>`;
  let out = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, css + "</head>") : css + html;
  out = out.replace(/<body([^>]*)>/i, `<body$1><div id="__imgzoom">`);
  out = out.replace(/<\/body>/i, `</div></body>`);
  return out;
}

// Given the content's CSS px width, return { html (wrapped), width (viewport) }.
// Falls to the legacy path (no wrap) when contentWidth is unknown.
export function imagePlan(html, contentWidth) {
  if (!contentWidth || !(contentWidth > 0)) return { html, width: undefined };
  let zoom = IMG_ZOOM;
  let width = Math.round(contentWidth * zoom) + IMG_PAD;
  if (width > IMG_MAX_W) { width = IMG_MAX_W; zoom = +((IMG_MAX_W - IMG_PAD) / contentWidth).toFixed(4); }
  return { html: imageWrapHtml(html, zoom), width };
}

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

export async function exportImage(html, filename = "schedule", { width = 1120, contentWidth } = {}) {
  const b = busy(t("saving"));
  try {
    const plan = imagePlan(html, contentWidth);
    const blob = await api.image(plan.html, { width: plan.width ?? width, fullPage: true, filename });
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
// rows stop a fast double-click firing twice. For images, `contentWidth` (a
// number, or a fn(html)→number for the variable-width CLM sheet) drives the
// tight-crop + 2× sharpening via imagePlan; without it, image width falls back
// to orientation (landscape ≈ 1120px, portrait ≈ 800px).
export function exportMenu({ getHtml, filename = "schedule", landscape = true, marginMm = 6, title, contentWidth } = {}) {
  const ta = getLang() === "ta";
  const width = landscape ? 1120 : 800;

  const perform = async (kind) => {
    const b = busy(t("saving"));
    let html;
    try { html = await getHtml(); }
    catch (e) { b.update(e.message || "Export failed", "danger"); return; }
    // Resolve the content width once (may parse the freshly built html for CLM).
    const cw = typeof contentWidth === "function" ? contentWidth(html) : contentWidth;
    try {
      if (kind === "pdf-dl") {
        const blob = await api.pdf(html, { landscape, marginMm, filename });
        downloadBlob(blob, `${filename}.pdf`); b.update(t("saved"), "ok");
      } else if (kind === "pdf-share") {
        const blob = await api.pdf(html, { landscape, marginMm, filename });
        b.dismiss(); await shareBlob(blob, `${filename}.pdf`, "application/pdf", title || filename);
      } else if (kind === "img-dl") {
        const plan = imagePlan(html, cw);
        const blob = await api.image(plan.html, { width: plan.width ?? width, fullPage: true, filename });
        downloadBlob(blob, `${filename}.png`); b.update(t("saved"), "ok");
      } else if (kind === "img-share") {
        const plan = imagePlan(html, cw);
        const blob = await api.image(plan.html, { width: plan.width ?? width, fullPage: true, filename });
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
