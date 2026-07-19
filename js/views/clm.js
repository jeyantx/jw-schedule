// ============================================================================
// CLM (midweek) — the pixel-matched month sheet, inline-editable, with conflict
// + qualification highlighting and one-click PDF export via the backend.
// ============================================================================
import { store, uid } from "../store.js";
import { api } from "../api.js";
import { CLM_SECTIONS, ROLES } from "../config.js";
import { getLang, getContentLang, t, tc } from "../i18n.js";
import { el, icon, toast, combo, confirmDialog, drawer, modal } from "../ui.js";
import { S, inMonth, monthName, fmtDate, monthDates } from "../state.js";
import { kindMeetingDays, pubLabel } from "../features/boards.js";
import { missingSince, recentRepeats, statsFor, collectAssignments } from "../features/intelligence.js";
import { fetchWeekImages, matchWeekImage, fetchMonthPrograms, fetchWeekProgram, matchWeek, pendingWeekDates, workbookMonthPath } from "../features/wol.js";
import { buildClmHtml, buildClmWeekHtml } from "../features/clmSheet.js";
import { toPastel, spreadDistinct, sampleImageColor, hexToRgb, hslToHex } from "../features/weekTint.js";
import { exportMenu } from "../features/pdf.js";
import { assetDataUri } from "../features/assets.js";
import { clmIcon } from "../features/clmIcons.js";

let editing = null; // { weekId, path, type }
// BUG 6: one auto-fill at a time. Module-level so the flag survives re-renders;
// the auto-fill buttons render disabled and the actions no-op while it is set.
let autofillRunning = false;
// BUG 9: the remote PDF/image renderer can't hotlink wol thumbnails, so at export
// each week's wol image is fetched through the proxy and embedded as a data: URI.
// Cached per session (keyed by the wol URL) so repeat exports don't re-fetch.
const _imgUriCache = new Map(); // wol image URL -> Promise<dataUri | "">
function wolImageDataUri(url) {
  if (!url) return Promise.resolve("");
  if (_imgUriCache.has(url)) return _imgUriCache.get(url);
  const p = api.wolImage(url)
    .then((blob) => new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    }))
    .catch(() => "");   // fetch failed → "" → template renders no image cell content
  _imgUriCache.set(url, p);
  return p;
}
// Same session cache as export (data URI) reused as a Blob for canvas colour
// sampling, so recommending a tint never triggers a second proxy round-trip for
// an image the export already fetched. Fetching a data: URI is local (no network).
async function wolImageBlobCached(url) {
  const uri = await wolImageDataUri(url);
  if (!uri) return null;
  return (await fetch(uri)).blob();
}
// Return clones of the weeks with each wol image URL swapped for an embedded data
// URI (or removed on failure — the frozen template renders nothing for a falsy image).
async function embedWeekImages(weeks) {
  return Promise.all((weeks || []).map(async (w) => {
    if (!w.image) return w;
    const uri = await wolImageDataUri(w.image);
    return { ...w, image: uri || undefined };
  }));
}
// Ministry-portion type codes (apply section) — feed the Student Portions matrix.
export const PORTION_TYPES = ["SC", "FU", "MD", "EB", "T"];

// Eight evenly-spread pale pastels offered in the week-colour picker. Built via
// hslToHex (high L / modest S) so every preset is guaranteed light enough for
// black text — same colour band the auto/recommend paths produce.
const PRESET_TINTS = [0, 40, 90, 140, 190, 240, 290, 330].map((h) => hslToHex({ h, s: 0.4, l: 0.92 }));

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) {
  const keys = path.split("."); const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
  target[last] = val;
}

export function renderClm() {
  const lang = getLang();          // app chrome (buttons, drawers, toasts, editor)
  const clang = getContentLang();  // schedule content — week cards + exported sheet
  const canEdit = store.canEditKind("clm");
  const weeks = store.get("clm").filter((w) => inMonth(w.date)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const pubs = store.get("publishers");
  // Names shown on the week cards / exported sheet → content language.
  const pubName = (id) => { const p = pubs.find((x) => x.id === id); return p ? pubLabel(p, clang) : (id || ""); };

  const commit = (next) => {
    const all = store.get("clm").slice();
    const i = all.findIndex((w) => w.id === next.id);
    if (i >= 0) all[i] = next; else all.push(next);
    store.set("clm", all);
  };

  // Intelligence computed ONCE per render (not per cell): last-assigned date +
  // count-this-year per publisher, used to rank + annotate the combo options.
  const memoAll = collectAssignments();
  const thisYear = String(S.month.getFullYear());
  const lastOverall = {}, countYear = {};
  for (const a of memoAll) {
    if (a.date && (!lastOverall[a.pubId] || a.date > lastOverall[a.pubId])) lastOverall[a.pubId] = a.date;
    if ((a.date || "").startsWith(thisYear)) countYear[a.pubId] = (countYear[a.pubId] || 0) + 1;
  }
  const L = (ta, en) => (lang === "ta" ? ta : en);
  const shortIso = (iso) => fmtDate(iso, lang).replace(/,\s*\d{4}$/, "");
  const metaFor = (p) => {
    const parts = [];
    if (lastOverall[p.id]) parts.push(shortIso(lastOverall[p.id]));
    if (countYear[p.id]) parts.push(String(countYear[p.id]));
    return parts.join(" · ");
  };

  /* -- toolbar -- */
  const datePick = el("input", { class: "input", type: "date", style: { width: "170px" }, value: defaultDate() });
  const addBtn = el("button", { class: "btn btn-primary", onClick: () => {
    const d = datePick.value; if (!d) return toast(t("date"), "danger");
    if (store.get("clm").some((w) => w.date === d)) return toast(L("இந்த வாரம் ஏற்கெனவே உள்ளது", "Week exists"), "danger");
    chooseAdd(d);
  } }, icon("plus", 16), t("addWeek"));
  const dupBtn = el("button", { class: "btn", onClick: duplicateLast }, icon("copy", 16), t("duplicate"));
  const helperBtn = el("button", { class: "btn", onClick: openHelper }, icon("userCheck", 16), t("helper"));
  const imgBtn = el("button", { class: "btn", onClick: loadImages }, icon("calendar", 16), t("images"));
  const autoBtn = el("button", { class: "btn", disabled: autofillRunning,
    onClick: () => { if (autofillRunning) return toast(L("ஏற்கனவே இயங்குகிறது", "Already running"), "danger"); autoFillMonth(); } },
    icon("globe", 16), t("autoFillMonth"));
  const colorBtn = el("button", { class: "btn", disabled: autofillRunning,
    onClick: () => { if (autofillRunning) return toast(L("ஏற்கனவே இயங்குகிறது", "Already running"), "danger"); autoColorMonth(); } },
    icon("palette", 16), L("மாதம் வண்ணமிடு", "Auto-color month"));
  const notesBtn = el("button", { class: "btn", onClick: openNotes }, icon("pencil", 16), L("குறிப்பு", "Notes"));
  const pdfBtn = el("button", { class: "btn", onClick: doExport }, icon("share", 16), lang === "ta" ? "ஏற்றுமதி" : "Export");

  const toolbar = el("div", { class: "clm-toolbar" },
    canEdit ? el("div", { class: "row" }, datePick, addBtn) : null,
    canEdit && weeks.length ? dupBtn : null,
    canEdit ? helperBtn : null,
    canEdit ? autoBtn : null,
    canEdit && weeks.length ? imgBtn : null,
    canEdit && weeks.length ? colorBtn : null,
    canEdit ? notesBtn : null,
    el("div", { class: "grow" }),
    weeks.length ? pdfBtn : null);

  /* -- grid: saved weeks + ghost placeholders for the month's midweek dates -- */
  // Skipped dates (memorial / convention) the congregation marked "no meeting".
  const skip = clmSkipDates();
  // Expected midweek dates that have no saved week AND no saved week already in
  // the SAME Mon–Sun calendar week. The second guard fixes Issue 2: after the
  // midweek default moved Wed→Thu, a saved Wed July 1 week would otherwise sprout
  // a duplicate Thu July 2 ghost that can't be deleted (ghosts aren't records).
  const expectedDates = canEdit
    ? [...new Set(kindMeetingDays("clm").flatMap((wd) => monthDates(wd)))]
        .filter((d) => !weeks.some((w) => w.date === d || sameIsoWeek(w.date, d)))
    : [];
  // A skipped date is a slim "no meeting" strip; the rest are full ghost cards.
  // A saved week always wins over a skip (skip only suppresses ghosts/auto-fill).
  const ghostDates = expectedDates.filter((d) => !skip.includes(d));
  const skipStrips = canEdit
    ? skip.filter((d) => inMonth(d) && !weeks.some((w) => w.date === d || sameIsoWeek(w.date, d)))
    : [];
  const items = [
    ...weeks.map((w) => ({ date: w.date || "", node: () => weekCard(w) })),
    ...ghostDates.map((d) => ({ date: d, node: () => ghostCard(d) })),
    ...skipStrips.map((d) => ({ date: d, node: () => skipStrip(d) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let gridInner;
  if (!items.length) {
    gridInner = el("div", { class: "empty" }, clmIcon("treasures", 40) || icon("gem", 40),
      el("p", {}, `${monthName(S.month, lang)} — ${t("noCong") ? "no weeks yet" : ""}`),
      canEdit ? el("p", { class: "hint" }, `${t("addWeek")} ↑`) : null);
  } else {
    gridInner = el("div", { class: "clm-grid" }, items.map((it) => it.node()));
  }

  const head = el("div", { class: "view-head" }, el("h2", {}, t("clm")), el("p", {}, monthName(S.month, lang)));
  return el("div", { class: "view" }, head, toolbar, notesStrip(), el("div", { class: "clm-scroll" }, gridInner));

  /* ---------- week card ---------- */
  function weekCard(w) {
    // conflict detection: a publisher in two teaching parts in one week. Prayers are excluded —
    // a chairman commonly gives the closing prayer, which is not a conflict.
    const used = {};
    conflictIds(w).forEach((id) => { if (id) used[id] = (used[id] || 0) + 1; });

    const card = el("div", { class: "clm-week" });
    // The week's theme colour tints the header in-app exactly as it will in the
    // exported sheet (it is a pale pastel). The `tinted` class then forces a fixed
    // dark ink on the whole head (css/clm.css) so the date/icons stay readable in
    // BOTH themes — in dark mode the theme text colour is light, which would be
    // invisible on a light pastel (Issue 1, reported on mobile).
    card.append(el("div", { class: "clm-week-head" + (w.tint ? " tinted" : ""), ...(w.tint ? { style: { background: w.tint } } : {}) },
      w.image ? el("img", { class: "wk-thumb", src: w.image, alt: "", loading: "lazy" }) : null,
      el("button", { class: "clm-date", type: "button",
        title: lang === "ta" ? "தேதி விருப்பங்கள்" : "Date options",
        "aria-label": lang === "ta" ? "தேதி விருப்பங்கள்" : "Date options",
        onClick: () => weekDateMenu(w) }, fmtDate(w.date, clang)),
      canEdit ? el("button", { class: "clm-swatch", type: "button",
        title: L("வார வண்ணம்", "Week color"), "aria-label": L("வார வண்ணம்", "Week color"),
        ...(w.tint ? { style: { background: w.tint } } : {}),
        onClick: () => openTintPicker(w) }, w.tint ? null : icon("palette", 13)) : null,
      el("span", { class: "row", style: { gap: "2px" } },
        el("button", { class: "btn btn-icon btn-ghost btn-sm", title: lang === "ta" ? "வார அட்டவணை (WhatsApp)" : "Weekly sheet",
          onClick: () => doExportWeek(w) }, icon("share", 14)),
        canEdit ? el("button", { class: "btn btn-icon btn-ghost btn-sm", title: t("delete"),
          onClick: async () => { if (await confirmDialog(t("confirmDelete"))) { store.set("clm", store.get("clm").filter((x) => x.id !== w.id)); toast(t("saved"), "ok"); } } }, icon("trash", 15)) : null)));

    card.append(labelLine(tc("chairman"), personCell(w, "chairman", "clm.chairman", "brother", used)));
    card.append(labelLine(tc("prayer"), personCell(w, "openingPrayer", "clm.prayer", "brother", used)));

    let n = 0;
    CLM_SECTIONS.forEach((sec) => {
      card.append(el("div", { class: `clm-sec ${sec.cls}` }, clmIcon(sec.key, 15) || icon(sec.icon, 15), sec[clang] || sec.en));
      const parts = (w.sections && w.sections[sec.key]) || [];
      parts.forEach((p, i) => {
        n++; card.append(partRow(w, sec.key, i, p, n, used));
        // insert affordance BETWEEN parts — splices a blank part after index i
        if (canEdit && i < parts.length - 1) card.append(insertLine(w, sec.key, i));
      });
      if (canEdit) card.append(el("button", { class: "btn btn-ghost btn-sm", style: { margin: "4px 8px 8px", color: "var(--text-3)" },
        onClick: () => { p_add(w, sec.key); } }, icon("plus", 14), sec[lang] || sec.en));
    });

    card.append(labelLine(tc("prayer"), personCell(w, "closingPrayer", "clm.prayer", "brother", used)));
    return card;
  }

  // Placeholder for a midweek date with no saved week yet — UI-only (never
  // exported); one click creates the real blank week for that date. The ✕ marks
  // the date "no meeting" (memorial/convention) instead — Issue 3.
  function ghostCard(date) {
    return el("div", { class: "clm-week ghost", role: "button", tabIndex: 0,
      onClick: () => chooseAdd(date),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseAdd(date); } } },
      el("div", { class: "clm-week-head" }, fmtDate(date, clang),
        el("button", { class: "ghost-skip", type: "button",
          title: L("கூட்டம் இல்லை (நினைவு/மாநாடு)", "No meeting (memorial/convention)"),
          "aria-label": L("கூட்டம் இல்லை", "No meeting"),
          onClick: (e) => { e.stopPropagation(); addSkip(date); } }, icon("x", 13))),
      el("div", { class: "ghost-add" }, icon("plus", 16), el("span", {}, t("addWeek"))));
  }

  // Slim muted strip for a date the congregation marked "no meeting". A restore
  // (+) action removes it from clmSkip so the ghost card comes back — Issue 3.
  function skipStrip(date) {
    return el("div", { class: "clm-skip-strip" },
      el("span", {}, fmtDate(date, clang)),
      el("span", { class: "clm-skip-note" }, L("· கூட்டம் இல்லை (நினைவு/மாநாடு)", "· No meeting (memorial/convention)")),
      el("div", { class: "grow" }),
      canEdit ? el("button", { class: "btn btn-icon btn-ghost btn-sm", type: "button",
        title: L("மீட்டமை", "Restore"), "aria-label": L("மீட்டமை", "Restore"),
        onClick: () => removeSkip(date) }, icon("plus", 15)) : null);
  }

  // clmSkip is stored on meta.sheet (same per-congregation store as clmNotes /
  // clmIcons); store.set re-emits so the view re-renders without an explicit call.
  function clmSkipDates() { return ((store.get("meta") || {}).sheet || {}).clmSkip || []; }
  function writeSheet(patch) {
    const meta = { ...(store.get("meta") || {}) };
    meta.sheet = { ...(meta.sheet || {}), ...patch };
    store.set("meta", meta);
  }
  function addSkip(date) {
    const cur = clmSkipDates();
    if (!cur.includes(date)) writeSheet({ clmSkip: [...cur, date].sort() });
    toast(L("கூட்டம் இல்லை என குறிக்கப்பட்டது", "Marked: no meeting"), "ok");
  }
  function removeSkip(date) {
    writeSheet({ clmSkip: clmSkipDates().filter((d) => d !== date) });
    toast(t("saved"), "ok");
  }

  function labelLine(label, valueNode) {
    return el("div", { class: "clm-line" }, el("span", { class: "lbl" }, label), valueNode);
  }

  // Thin hover-reveal insert line between two parts → adds a blank part after idx.
  function insertLine(w, secKey, idx) {
    return el("div", { class: "clm-insert", role: "button", tabIndex: 0,
      title: lang === "ta" ? "இங்கே பகுதி சேர்" : "Insert part here",
      "aria-label": lang === "ta" ? "இங்கே பகுதி சேர்" : "Insert part here",
      onClick: () => p_insert(w, secKey, idx),
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); p_insert(w, secKey, idx); } } },
      el("span", { class: "clm-insert-btn" }, icon("plus", 12)));
  }

  // Click the week date → small modal: change the date (dup-guarded) or open the
  // matching wol.jw.org workbook page. No per-week doc URL is stored, so this
  // opens the workbook MONTH page for the week's date.
  function weekDateMenu(w) {
    const dateInp = el("input", { class: "input", type: "date", value: w.date || "" });
    const base = (w.date || firstOfMonthIso()) + "T00:00:00";
    const wolUrl = `https://wol.jw.org/${workbookMonthPath(new Date(base), "en")}`;
    const body = el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } });
    let close = () => {};
    if (canEdit) {
      body.append(el("div", { class: "field" },
        el("label", {}, L("தேதியை மாற்று", "Change date")),
        el("div", { class: "row", style: { gap: "8px" } }, dateInp,
          el("button", { class: "btn btn-primary", onClick: () => {
            const d = dateInp.value;
            if (!d) return toast(t("date"), "danger");
            if (d !== w.date && store.get("clm").some((x) => x.date === d))
              return toast(L("இந்த வாரம் ஏற்கெனவே உள்ளது", "Week exists"), "danger");
            const next = clone(w); next.date = d; editing = null; commit(next);
            toast(t("saved"), "ok"); close();
          } }, L("சேமி", "Save")))));
    }
    body.append(el("button", { class: "btn", style: { justifyContent: "flex-start" },
      onClick: () => window.open(wolUrl, "_blank", "noopener") },
      icon("globe", 16), L("wol.jw.org பக்கம் திற", "Open wol.jw.org")));
    close = modal({ title: fmtDate(w.date, lang), body }).close;
  }

  // Per-week theme colour picker. A row of light presets + a native colour input
  // (whatever the user picks is run through toPastel so it can never come out
  // dark), plus a "recommend from image" action enabled only when a thumbnail
  // exists. A manual pick is respected as-is — only the month pass spreads hues.
  function openTintPicker(w) {
    const body = el("div", { style: { display: "flex", flexDirection: "column", gap: "16px" } });
    let close = () => {};
    const apply = (hex) => {
      const next = clone(w);
      if (hex) next.tint = hex; else delete next.tint;
      editing = null; commit(next); toast(t("saved"), "ok"); close();
    };
    const isSel = (hex) => w.tint && w.tint.toLowerCase() === hex.toLowerCase();

    const presetRow = el("div", { class: "tint-presets" },
      ...PRESET_TINTS.map((hex) => el("button", {
        class: "tint-swatch" + (isSel(hex) ? " sel" : ""), type: "button", title: hex,
        style: { background: hex }, onClick: () => apply(hex),
      })));
    body.append(el("div", { class: "field" }, el("label", {}, L("வண்ணங்கள்", "Colors")), presetRow));

    const colorInp = el("input", { type: "color", class: "input",
      value: w.tint || "#eef3fb", style: { width: "56px", height: "34px", padding: "2px" } });
    body.append(el("div", { class: "field" }, el("label", {}, L("சொந்த வண்ணம்", "Custom color")),
      el("div", { class: "row", style: { gap: "8px" } }, colorInp,
        el("button", { class: "btn", onClick: () => apply(toPastel(hexToRgb(colorInp.value))) },
          L("இந்த வண்ணத்தைப் பயன்படுத்து", "Use this color")))));

    const recBtn = el("button", { class: "btn", disabled: !w.image,
      title: w.image ? "" : L("முதலில் படம் ஏற்றவும்", "Load an image first"),
      onClick: async () => {
        recBtn.disabled = true; const orig = recBtn.textContent;
        recBtn.textContent = L("மாதிரி எடுக்கிறது…", "Sampling…");
        const hex = await sampleImageColor(w.image, wolImageBlobCached);
        if (hex) apply(hex);
        else { toast(L("படத்திலிருந்து வண்ணம் எடுக்க முடியவில்லை", "Couldn't read a color from the image"), "danger");
          recBtn.disabled = false; recBtn.textContent = orig; }
      } }, icon("image", 15), L("படத்திலிருந்து பரிந்துரை", "Recommend from image"));

    const clearBtn = el("button", { class: "btn btn-ghost", disabled: !w.tint,
      onClick: () => apply(null) }, icon("x", 15), L("நீக்கு", "Clear"));

    body.append(el("div", { class: "row", style: { gap: "8px", flexWrap: "wrap" } }, recBtn, clearBtn));
    close = modal({ title: L("வார வண்ணம்", "Week color"), body }).close;
  }

  function partRow(w, secKey, idx, part, no, used) {
    const base = `sections.${secKey}.${idx}`;
    // CBS detection stays true even after the reader is cleared: the `cbs` flag
    // and the conductor role persist, so the add-reader affordance never vanishes.
    const isCbs = !!part.cbs || part.reader === true || typeof part.reader === "string" || part.role === "clm.cbs.conductor";
    const who = el("div", { class: "who" });
    who.append(personCell(w, `${base}.assignee`, part.role || "clm.student", part.gender, used, secKey === "living"));
    if (secKey === "apply") who.append(assistantCell(w, `${base}.assistant`, part.role || "clm.student", part.gender, used));
    if (isCbs) who.append(readerCell(w, base, used, tc("reader")));

    const minCell = el("span", { class: "min cell", onClick: canEdit ? () => startEdit(w, `${base}.min`, "min") : null },
      editing && editing.weekId === w.id && editing.path === `${base}.min`
        ? minInput(w, `${base}.min`)
        : (part.min ? `${part.min} ${clang === "ta" ? "நிமி" : "min"}` : "—"));

    // Apply-section portion type (SC/FU/MD/EB/T) — feeds the portions matrix.
    const typeSel = (canEdit && secKey === "apply")
      ? el("select", { class: "type-chip", title: lang === "ta" ? "பகுதி வகை" : "Portion type",
          onChange: (e) => { const next = clone(w); setPath(next, `${base}.type`, e.target.value || null); editing = null; commit(next); } },
          el("option", { value: "" }, "—"),
          ...PORTION_TYPES.map((c) => el("option", { value: c, selected: part.type === c }, c)))
      : (secKey === "apply" && part.type ? el("span", { class: "type-chip static" }, part.type) : null);
    const col2 = el("div", { class: "min-col" }, minCell, typeSel);

    const row = el("div", { class: "clm-part" }, el("span", { class: "no" }, no), col2, who);
    if (canEdit) row.append(el("button", { class: "rm", title: t("delete"), onClick: () => p_remove(w, secKey, idx) }, "✕"));
    return row;
  }

  /* ---------- editable cells ---------- */
  function personCell(w, path, role, gender, used, allowFree = false) {
    const val = getPath(w, path);
    const isEditingHere = editing && editing.weekId === w.id && editing.path === path;
    if (canEdit && isEditingHere) {
      return combo({
        options: optionsFor(role, gender),
        value: pubs.some((p) => p.id === val) ? val : null,
        placeholder: t("unassigned"),
        allowFree, autofocus: true,
        onSelect: (v) => {
          const next = clone(w);
          if (allowFree && v && !pubs.some((p) => p.id === v)) { setPath(next, path.replace(".assignee", ".title"), v); setPath(next, path, null); }
          else { setPath(next, path, v); if (allowFree) setPath(next, path.replace(".assignee", ".title"), null); }
          editing = null; commit(next);
        },
      });
    }
    const title = allowFree ? getPath(w, path.replace(".assignee", ".title")) : null;
    const display = val ? pubName(val) : (title || "");
    const warn = val && role && !pubs.find((p) => p.id === val && (p.roles || []).includes(role));
    const conflict = val && used[val] > 1;
    return el("span", {
      class: `cell part-title ${display ? "" : "empty"} ${conflict ? "conflict" : warn ? "warn" : ""} ${title ? "ta" : "ta"}`,
      onClick: canEdit ? () => startEdit(w, path, "person") : null,
    }, display || tc("unassigned"));
  }

  function assistantCell(w, path, role, gender, used, prefix) {
    const val = getPath(w, path);
    const isEditingHere = editing && editing.weekId === w.id && editing.path === path;
    if (canEdit && isEditingHere) {
      return combo({ options: optionsFor(role, gender), value: val || null, placeholder: t("assistant"), autofocus: true,
        onSelect: (v) => { const next = clone(w); setPath(next, path, v); editing = null; commit(next); } });
    }
    if (!val && !canEdit) return el("span", {});
    return el("span", { class: `assistant cell ta ${val ? "" : "empty"}`, onClick: canEdit ? () => startEdit(w, path, "person") : null },
      val ? `${prefix ? prefix + ": " : "· "}${pubName(val)}` : (canEdit ? `+ ${prefix || t("assistant")}` : ""));
  }

  // CBS reader cell. Kept separate from assistantCell so clearing the reader
  // preserves the part's CBS status (reader -> `true` sentinel + cbs flag),
  // meaning the "+ Reader" affordance is always re-offered and the exported
  // sheet (clmSheet.js treats reader===true as CBS-with-empty-reader) stays CBS.
  function readerCell(w, base, used, prefix) {
    const path = `${base}.reader`;
    const raw = getPath(w, path);
    const assigned = typeof raw === "string" ? raw : null; // reader===true => CBS but no person
    const isEditingHere = editing && editing.weekId === w.id && editing.path === path;
    if (canEdit && isEditingHere) {
      return combo({ options: optionsFor("clm.cbs.reader", "brother"), value: assigned || null, placeholder: t("reader"), autofocus: true,
        onSelect: (v) => {
          const next = clone(w);
          setPath(next, `${base}.cbs`, true);   // keep this part marked CBS
          setPath(next, path, v || true);        // person id, or the CBS sentinel
          editing = null; commit(next);
        } });
    }
    if (!assigned && !canEdit) return el("span", {});
    return el("span", { class: `assistant cell ta ${assigned ? "" : "empty"}`, onClick: canEdit ? () => startEdit(w, path, "person") : null },
      assigned ? `${prefix}: ${pubName(assigned)}` : (canEdit ? `+ ${prefix}` : ""));
  }

  function minInput(w, path) {
    // 20px tall: nested inside the padded .min.cell (5+20+4 ≈ the 28px display box) so the row doesn't jump
    const inp = el("input", { class: "input", type: "number", min: 1, max: 90, value: getPath(w, path) || "", style: { width: "44px", height: "20px", padding: "0 4px", fontSize: "var(--fs-xs)" } });
    const done = () => { const next = clone(w); setPath(next, path, parseInt(inp.value) || null); editing = null; commit(next); };
    inp.addEventListener("blur", done);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); if (e.key === "Escape") { editing = null; S.refresh(); } });
    setTimeout(() => inp.focus({ preventScroll: true }), 0);
    return inp;
  }

  function startEdit(w, path, type) { editing = { weekId: w.id, path, type }; S.refresh(); }

  function optionsFor(role, gender) {
    // role-specific last-assigned, for least-recently-used ranking
    const roleLast = {};
    for (const a of memoAll) if (a.role === role && a.date && (!roleLast[a.pubId] || a.date > roleLast[a.pubId])) roleLast[a.pubId] = a.date;
    const eligible = pubs.filter((p) => p.active !== false && (!role || (p.roles || []).includes(role)) && (!gender || p.gender === gender));
    const active = eligible.filter((p) => !p.exempt)
      .sort((a, b) => (roleLast[a.id] || "").localeCompare(roleLast[b.id] || "") || pubLabel(a, lang).localeCompare(pubLabel(b, lang)))
      .map((p) => ({ value: p.id, label: pubLabel(p, lang), meta: metaFor(p) }));
    // exempt publishers stay pickable, but sink to the bottom flagged as such
    const exempt = eligible.filter((p) => p.exempt)
      .sort((a, b) => pubLabel(a, lang).localeCompare(pubLabel(b, lang)))
      .map((p) => ({ value: p.id, label: pubLabel(p, lang), meta: t("exempt") }));
    return [...active, ...exempt];
  }

  /* ---------- part add/remove ---------- */
  function p_add(w, secKey) {
    const next = clone(w);
    next.sections[secKey] = next.sections[secKey] || [];
    next.sections[secKey].push(newPart(secKey));
    editing = null; commit(next);
  }
  // Insert a blank part BETWEEN existing parts, right after `idx` in the section.
  function p_insert(w, secKey, idx) {
    const next = clone(w);
    next.sections[secKey] = next.sections[secKey] || [];
    next.sections[secKey].splice(idx + 1, 0, newPart(secKey));
    editing = null; commit(next);
  }
  // Same shape as an appended part (min + role); a titled "Local Needs"-style
  // part is produced by the editor when the user types a free-text title.
  function newPart(secKey) {
    const role = secKey === "treasures" ? "clm.treasures" : secKey === "apply" ? "clm.student" : "clm.living";
    return { min: 4, role };
  }
  function p_remove(w, secKey, idx) {
    const next = clone(w); next.sections[secKey].splice(idx, 1); editing = null; commit(next);
  }

  function duplicateLast() {
    const prev = store.get("clm").filter((w) => (w.date || "") < firstOfMonthIso()).sort((a, b) => b.date.localeCompare(a.date))[0]
      || store.get("clm").slice(-1)[0];
    if (!prev) return toast("Nothing to copy", "danger");
    const d = defaultDate();
    if (store.get("clm").some((w) => w.date === d)) return toast("Week exists", "danger");
    const copy = clone(prev); copy.id = uid("w"); copy.date = d;
    commit(copy); toast(t("saved"), "ok");
  }

  function doExport() {
    exportMenu({
      getHtml: async () => buildClmHtml(await embedWeekImages(weeks), { congName: store.congregation?.name || "", month: S.month, lang: clang, name: pubName, pubs, ...(await clmPrefs()) }),
      filename: `clm-${monthName(S.month, "en").replace(" ", "-").toLowerCase()}`,
      landscape: true, title: `${t("clm")} — ${monthName(S.month, lang)}`,
    });
  }
  function doExportWeek(w) {
    exportMenu({
      getHtml: async () => buildClmWeekHtml((await embedWeekImages([w]))[0], { lang: clang, name: pubName, pubs, ...(await clmPrefs()) }),
      filename: `clm-week-${w.date}`,
      landscape: false, title: `${t("clm")} — ${fmtDate(w.date, lang)}`,
    });
  }
  // Section icons: per-congregation override (meta.sheet.clmIcons) else the
  // bundled defaults, embedded as data: URIs (the remote PDF backend can't
  // fetch relative asset URLs). Missing assets resolve to "" → export still works.
  async function clmPrefs() {
    const sheet = (store.get("meta") || {}).sheet || {};
    const icons = sheet.clmIcons || await loadDefaultIcons();
    return { tints: sheet.tints, notes: sheet.clmNotes, icons };
  }
  async function loadDefaultIcons() {
    const [treasures, ministry, living] = await Promise.all([
      assetDataUri("assets/clm/treasures.jpg"),
      assetDataUri("assets/clm/ministry.jpg"),
      assetDataUri("assets/clm/living.jpg"),
    ]);
    return { treasures, ministry, living };
  }

  /* ---------- notes (குறிப்பு) — Issue 4 ---------- */
  // The notes that will print on the exported sheet (0–3 lines). clmPrefs() reads
  // the same meta.sheet.clmNotes and feeds it to buildClmHtml, so what's edited
  // here is exactly what prints.
  function clmNotesList() { return (((store.get("meta") || {}).sheet || {}).clmNotes || []).slice(0, 3); }

  // Read-only preview shown on the page (everyone sees what will print).
  function notesStrip() {
    const notes = clmNotesList();
    if (!notes.length) return null;
    return el("div", { class: "clm-notes-view" },
      el("span", { class: "clm-notes-lbl" }, L("குறிப்பு", "Notes") + ":"),
      ...notes.map((n, i) => el("span", { class: "clm-note-item" }, `${i + 1}. ${n}`)));
  }

  // Compact editor (up to 3 lines) → writes meta.sheet.clmNotes. canEdit-gated
  // (the button is only rendered for editors).
  function openNotes() {
    const rows = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
    const draft = () => [...rows.querySelectorAll("input")].map((i) => i.value.trim()).filter(Boolean).slice(0, 3);
    const addBtn = el("button", { class: "btn btn-sm", type: "button", onClick: () => addRow() }, icon("plus", 14), L("வரி சேர்", "Add line"));
    const syncAdd = () => { addBtn.disabled = rows.children.length >= 3; };
    const addRow = (val = "") => {
      if (rows.children.length >= 3) return;
      const inp = el("input", { class: "input", value: val, maxLength: 200, placeholder: L("குறிப்பு வரி", "Note line") });
      const row = el("div", { class: "row", style: { gap: "8px" } }, inp,
        el("button", { class: "btn btn-icon btn-ghost btn-sm", type: "button", title: t("delete"),
          onClick: () => { row.remove(); syncAdd(); } }, icon("x", 15)));
      rows.append(row); syncAdd(); inp.focus();
    };
    clmNotesList().forEach((n) => addRow(n));
    syncAdd();
    const body = el("div", { style: { display: "flex", flexDirection: "column", gap: "14px" } },
      el("p", { class: "hint", style: { fontSize: "var(--fs-md)" } },
        L("ஏற்றுமதி செய்யப்படும் அட்டவணையின் கீழே 3 குறிப்பு வரிகள் வரை அச்சிடப்படும்.",
          "Up to 3 note lines print at the bottom of the exported sheet.")),
      rows, el("div", { class: "row" }, addBtn));
    modal({ title: L("குறிப்பு", "Notes"), body, actions: [
      { label: L("ரத்து", "Cancel"), onClick: (c) => c() },
      { label: L("சேமி", "Save"), class: "btn-primary", onClick: (c) => { writeSheet({ clmNotes: draft() }); toast(t("saved"), "ok"); c(); } },
    ] });
  }

  /* ---------- assignment helper drawer ---------- */
  function openHelper() {
    // Helper drawer is app chrome → names follow the UI language.
    const nm = (id) => { const p = pubs.find((x) => x.id === id); return p ? pubLabel(p, lang) : (id || "—"); };
    const L = (ta, en) => (lang === "ta" ? ta : en);
    const rowLine = (main, meta) => el("div", { class: "spread", style: { padding: "7px 0", borderBottom: "1px solid var(--border)" } },
      el("span", { class: "ta" }, main), el("span", { class: "hint" }, meta || ""));
    const section = (title, nodes) => el("div", { style: { marginTop: "18px" } },
      el("div", { class: "side-group", style: { padding: "0 0 6px" } }, title), ...nodes);

    // a) Missing longest — top 10 active, non-exempt, sorted by days-since-last
    const missing = missingSince(null, memoAll).slice(0, 10).map((m) =>
      rowLine(nm(m.p.id), m.days == null ? t("never") : L(`${m.days} நாட்கள்`, `${m.days} days`)
        + (m.last ? ` · ${shortIso(m.last)}` : "")));
    // b) Frequent recently — recentRepeats(8)
    const frequent = recentRepeats(8, memoAll).map((r) => rowLine(nm(r.p.id), `×${r.count}`));
    // c) Pair history — pick a person, show their partners
    const pairBox = el("div", { style: { marginTop: "6px" } });
    const pairCombo = combo({
      options: pubs.filter((p) => p.active !== false).sort((a, b) => pubLabel(a, lang).localeCompare(pubLabel(b, lang)))
        .map((p) => ({ value: p.id, label: pubLabel(p, lang) })),
      placeholder: L("நபரைத் தேர்வுசெய்", "Choose a person"),
      onSelect: (v) => {
        pairBox.replaceChildren();
        if (!v) return;
        const s = statsFor(v, memoAll);
        if (!s.partners.length) { pairBox.append(el("p", { class: "muted" }, "—")); return; }
        s.partners.forEach(([id, n]) => {
          const last = s.history.find((h) => h.partnerId === id);
          pairBox.append(rowLine(nm(id), `×${n}${last ? " · " + shortIso(last.date) : ""}`));
        });
      },
    });

    drawer({ title: t("helper"), body: el("div", {},
      section(L("நீண்ட நாட்களாக இல்லாதவர்கள்", "Missing longest"), missing.length ? missing : [el("p", { class: "muted" }, "—")]),
      section(L("அடிக்கடி வருபவர்கள்", "Frequent recently"), frequent.length ? frequent : [el("p", { class: "muted" }, "—")]),
      section(L("ஜோடி வரலாறு", "Pair history"), [pairCombo, pairBox])) });
  }

  /* ---------- wol weekly thumbnails ---------- */
  async function loadImages() {
    try {
      toast(lang === "ta" ? "படங்கள் ஏற்றப்படுகிறது…" : "Loading images…");
      const wolWeeks = await fetchWeekImages(S.month, "en");
      let count = 0;
      // re-read saved weeks fresh each commit (commit mutates the store doc)
      for (const w of store.get("clm").filter((x) => inMonth(x.date))) {
        const img = matchWeekImage(wolWeeks, w.date);
        if (img) { const next = clone(w); next.image = img; commit(next); count++; }
      }
      toast(count
        ? (lang === "ta" ? `${count} படங்கள் சேர்க்கப்பட்டன` : `${count} images added`)
        : (lang === "ta" ? "பொருந்தும் படங்கள் இல்லை" : "No matching images"), count ? "ok" : "danger");
    } catch (e) {
      toast((lang === "ta" ? "படங்கள் ஏற்ற முடியவில்லை: " : "Could not load images: ") + (e.message || ""), "danger");
    }
  }

  /* ---------- intelligent pre-fill from wol.jw.org ---------- */
  // Chooser: every "add week" entry point (button, ghost card) offers Manual
  // (blank week, the old behaviour) or Auto-fill (parse the wol program).
  function chooseAdd(date) {
    if (store.get("clm").some((w) => w.date === date)) return toast(L("இந்த வாரம் ஏற்கெனவே உள்ளது", "Week exists"), "danger");
    const { close } = modal({
      title: `${t("addWeek")} · ${fmtDate(date, lang)}`,
      body: el("p", { class: "hint", style: { fontSize: "var(--fs-md)" } },
        L("wol.jw.org இலிருந்து நிரலை (பகுதிகள், நேரம், வகை) தானாக நிரப்பவா, அல்லது காலி வாரமாகத் தொடங்கவா? எதுவானாலும் பிறகு திருத்தலாம்.",
          "Auto-fill the program (parts, durations, types) from wol.jw.org, or start a blank week? Either way you can edit afterwards.")),
      actions: [
        { label: t("manual"), onClick: (c) => { c(); commit(blankWeek(date)); toast(t("saved"), "ok"); } },
        { label: t("autoFill"), class: "btn-primary", onClick: (c) => { c(); autoFillWeek(date); } },
      ],
    });
    return close;
  }

  // Build the app's week record from a parsed wol program. Names/assignees stay
  // empty; durations, part types, titles, CBS flag + week image are prefilled.
  function weekFromProgram(date, program, image) {
    const treasures = program.treasures.map((p) => ({
      min: p.min || undefined, title: p.title || undefined, gender: "brother",
      role: p.kind === "gems" ? "clm.gems" : p.kind === "reading" ? "clm.student" : "clm.treasures",
    }));
    const apply = program.apply.map((p) => ({ min: p.min || undefined, role: "clm.student", type: p.type || null }));
    const living = program.living.map((p) => p.cbs
      // reader:true is the CBS sentinel (clm.js/clmSheet.js) → keeps the part CBS
      // and shows the "+ Reader" affordance even with no reader assigned yet.
      ? { min: p.min || 30, title: p.title || undefined, role: "clm.cbs.conductor", gender: "brother", cbs: true, reader: true }
      : { min: p.min || undefined, title: p.title || undefined, role: "clm.living", gender: "brother" });
    return { id: uid("w"), date, chairman: null, openingPrayer: null, closingPrayer: null,
      image: image || undefined, sections: { treasures, apply, living } };
  }

  // Resolve ONE date against pre-fetched month weeks → {status, week?, msg}.
  // status: "ok" (week built), "skip" (memorial / unpublished / unparseable).
  async function planWeek(date, weeks, hasMemorial) {
    const hit = matchWeek(weeks, date);
    if (!hit) return { status: "skip", msg: hasMemorial
      ? L("நினைவு ஆசரிப்பு வாரம் — நடு வார கூட்டம் இல்லை", "Memorial week — no midweek meeting")
      : L("இந்த வாரத்திற்கு நிரல் கிடைக்கவில்லை (இன்னும் வெளியிடப்படவில்லை)", "No program for this week (not published yet)") };
    // Titles prefill in the schedule-content language (mixed mode → Tamil);
    // fetchWeekProgram falls back to English when the ta edition is missing.
    const { program } = await fetchWeekProgram(hit.docPath, clang);
    // Guard against a partially-published / non-meeting page: never write a
    // malformed week — require all three sections to have parsed at least once.
    if (!program || !program.treasures.length || !program.apply.length || !program.living.length)
      return { status: "skip", msg: L("இந்த வாரத்தைப் பகுப்பாய்வு செய்ய முடியவில்லை — தவிர்க்கப்பட்டது", "Couldn't read this week's program — skipped") };
    return { status: "ok", week: weekFromProgram(date, program, hit.img) };
  }

  async function autoFillWeek(date) {
    if (autofillRunning) return toast(L("ஏற்கனவே இயங்குகிறது", "Already running"), "danger");
    if (store.get("clm").some((w) => w.date === date)) return toast(L("இந்த வாரம் ஏற்கெனவே உள்ளது", "Week exists"), "danger");
    autofillRunning = true; S.refresh();   // re-render → auto-fill buttons show disabled
    const tst = toast(L("wol.jw.org இலிருந்து ஏற்றுகிறது…", "Fetching from wol.jw.org…"), "", { persist: true });
    try {
      const { weeks, hasMemorial } = await fetchMonthPrograms(S.month, "en");
      const r = await planWeek(date, weeks, hasMemorial);
      if (r.status === "ok") { commit(r.week); tst.update(L("வாரம் நிரப்பப்பட்டது", "Week pre-filled"), "ok"); }
      else tst.update(r.msg, "danger");
    } catch (e) {
      tst.update(L("தானாக நிரப்ப முடியவில்லை: ", "Auto-fill failed: ") + (e.message || ""), "danger");
    } finally {
      autofillRunning = false; S.refresh();
    }
  }

  // Month-level: pre-create every MISSING midweek week of the current month.
  // Existing weeks are never overwritten; skipped weeks (memorial/unpublished)
  // are counted and reported.
  async function autoFillMonth() {
    if (autofillRunning) return toast(L("ஏற்கனவே இயங்குகிறது", "Already running"), "danger");
    const existing = store.get("clm").map((w) => w.date).filter(Boolean);
    const skip = clmSkipDates();
    // Never create a week for a skipped (no-meeting) date, nor a second week in a
    // calendar week that already has one (same Wed→Thu default-shift guard as the
    // ghost list — Issues 2 & 3).
    const dates = pendingWeekDates(existing, kindMeetingDays("clm").flatMap((wd) => monthDates(wd)))
      .filter((d) => !skip.includes(d) && !existing.some((e) => sameIsoWeek(e, d)));
    if (!dates.length) return toast(L("சேர்க்க வேண்டிய வாரங்கள் இல்லை", "No missing weeks to add"), "danger");
    autofillRunning = true; S.refresh();   // re-render → auto-fill buttons show disabled
    const tst = toast(L("wol.jw.org இலிருந்து ஏற்றுகிறது…", "Fetching from wol.jw.org…"), "", { persist: true });
    try {
      // prefetchDocs batches every week's doc page through the background job
      // (survives Catalyst's ~60s request cap); onProgress drives the "3/9 …" toast.
      const { weeks, hasMemorial } = await fetchMonthPrograms(S.month, "en", {
        prefetchDocs: true,
        onProgress: (done, total) =>
          tst.update(L(`${done}/${total} ஏற்றுகிறது…`, `Loading ${done}/${total}…`), "", { persist: true }),
      });
      let created = 0, skipped = 0, memorial = 0;
      for (const d of dates) {
        if (store.get("clm").some((w) => w.date === d)) { skipped++; continue; } // never overwrite
        const r = await planWeek(d, weeks, hasMemorial);
        if (r.status === "ok") { commit(r.week); created++; }
        else { skipped++; if (/memorial|நினைவு/i.test(r.msg)) memorial++; }
      }
      // Colour the whole month (including the weeks just created) — distinct per
      // month. Best-effort: a colouring failure never fails the auto-fill.
      const monthWeeks = monthWeeksInOrder();
      if (monthWeeks.length) {
        tst.update(L("வண்ணம் தேர்ந்தெடுக்கிறது…", "Choosing colors…"), "", { persist: true });
        try { await applyMonthTints(monthWeeks); } catch { /* colour is a bonus */ }
      }
      const note = memorial ? L(` (${memorial} நினைவு வாரம்)`, ` (${memorial} memorial)`) : "";
      tst.update(L(`${created} வாரம் நிரப்பப்பட்டது · ${skipped} தவிர்க்கப்பட்டது${note}`,
        `${created} weeks pre-filled · ${skipped} skipped${note}`), created ? "ok" : "danger");
    } catch (e) {
      tst.update(L("தானாக நிரப்ப முடியவில்லை: ", "Auto-fill failed: ") + (e.message || ""), "danger");
    } finally {
      autofillRunning = false; S.refresh();
    }
  }

  /* ---------- per-month theme colours ---------- */
  // The month's saved weeks in date order (re-read fresh — commit mutates store).
  // A function declaration (not a const arrow): this sits AFTER renderClm's
  // return, so a const would stay uninitialized (TDZ) — the hoisted auto-fill/
  // auto-color handlers call it, so it must be reachable regardless of position.
  function monthWeeksInOrder() {
    return store.get("clm").filter((x) => inMonth(x.date)).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  }

  // Sample each week's thumbnail (date order); a week with no image / a failed
  // sample falls back to an evenly-spread pastel by position. spreadDistinct then
  // guarantees no two weeks in the month share a hue. Returns hexes aligned to `weeks`.
  async function sampleMonthTints(weeks) {
    const raw = [];
    for (let i = 0; i < weeks.length; i++) {
      let hex = weeks[i].image ? await sampleImageColor(weeks[i].image, wolImageBlobCached) : null;
      if (!hex) hex = hslToHex({ h: (i * 360) / weeks.length, s: 0.4, l: 0.92 });
      raw.push(hex);
    }
    return spreadDistinct(raw);
  }

  // Compute + commit a distinct pastel for every week of the month. Does NOT touch
  // autofillRunning (callers own the lock) so it can be reused inside autoFillMonth.
  async function applyMonthTints(weeks) {
    const hexes = await sampleMonthTints(weeks);
    weeks.forEach((w, i) => {
      const cur = store.get("clm").find((x) => x.id === w.id);
      if (cur) { const next = clone(cur); next.tint = hexes[i]; commit(next); }
    });
    return weeks.length;
  }

  // Toolbar action: colour the current month's weeks (distinct per month), reusing
  // the one-at-a-time lock so it can't overlap an auto-fill.
  async function autoColorMonth() {
    if (autofillRunning) return toast(L("ஏற்கனவே இயங்குகிறது", "Already running"), "danger");
    const weeks = monthWeeksInOrder();
    if (!weeks.length) return toast(L("வண்ணமிட வாரங்கள் இல்லை", "No weeks to color"), "danger");
    autofillRunning = true; S.refresh();
    const tst = toast(L("வண்ணம் தேர்ந்தெடுக்கிறது…", "Choosing colors…"), "", { persist: true });
    try {
      const n = await applyMonthTints(weeks);
      tst.update(L(`${n} வாரம் வண்ணமிடப்பட்டது`, `${n} weeks colored`), "ok");
    } catch (e) {
      tst.update(L("வண்ணமிட முடியவில்லை: ", "Auto-color failed: ") + (e.message || ""), "danger");
    } finally {
      autofillRunning = false; S.refresh();
    }
  }
}

/* ---- helpers ------------------------------------------------------------ */
const clone = (o) => JSON.parse(JSON.stringify(o));

// Mon–Sun calendar-week key for an ISO date ("YYYY-MM-DD" of that week's Monday).
// Two dates in the same week share a key. Pure + exported → unit-tested; used to
// suppress a duplicate ghost when a saved week already exists in the same week
// (the Wed→Thu midweek-default shift, Issue 2).
export function isoWeekKey(iso) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back up to Monday
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function sameIsoWeek(a, b) { return !!a && !!b && isoWeekKey(a) === isoWeekKey(b); }
function conflictIds(w) {
  const ids = [w.chairman]; // prayers intentionally excluded (chairman often prays)
  for (const sec of Object.values(w.sections || {})) for (const p of sec) { ids.push(p.assignee, p.assistant, p.reader); }
  return ids.filter(Boolean);
}
function defaultDate() {
  const d = new Date(S.month.getFullYear(), S.month.getMonth(), 1);
  // nudge to a Wednesday-ish default (midweek); keep simple: first of month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function firstOfMonthIso() { return `${S.month.getFullYear()}-${String(S.month.getMonth() + 1).padStart(2, "0")}-01`; }
function blankWeek(date) {
  return {
    id: uid("w"), date, chairman: null, openingPrayer: null, closingPrayer: null,
    sections: {
      treasures: [
        { no: 1, min: 10, role: "clm.treasures", gender: "brother" },
        { no: 2, min: 10, role: "clm.gems", gender: "brother" },
        { no: 3, min: 4, role: "clm.student", gender: "brother" },
      ],
      apply: [
        { min: 3, role: "clm.student" }, { min: 4, role: "clm.student" }, { min: 4, role: "clm.student" },
      ],
      living: [
        { min: 15, role: "clm.living", gender: "brother" },
        { min: 30, role: "clm.cbs.conductor", gender: "brother", cbs: true },
      ],
    },
  };
}
