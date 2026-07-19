// ============================================================================
// UI TOOLKIT — DOM builder, inline SVG icons (no CDN), toast, modal, drawer,
// confirm, and a searchable combobox. Everything self-contained.
// ============================================================================

/* ---- DOM builder -------------------------------------------------------- */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== "list") { try { node[k] = v; } catch { node.setAttribute(k, v); } }
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}
export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const mount = (parent, ...nodes) => { clear(parent); parent.append(...nodes.flat(Infinity).filter(Boolean)); return parent; };

/* ---- Icons (feather-style, MIT) ---------------------------------------- */
const PATHS = {
  menu: "M3 12h18M3 6h18M3 18h18",
  x: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  chevronLeft: "M15 18l-6-6 6-6", chevronRight: "M9 18l6-6-6-6",
  chevronDown: "M6 9l6 6 6-6", check: "M20 6 9 17l-5-5",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  palette: "M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2a2 2 0 0 0-2 2c0 .6.2 1 .6 1.4.4.4.6.9.6 1.4 0 1.2-1 2.2-2.2 2.2zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM11 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  userCheck: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M11 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M16 11l2 2 4-4",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  grid: "M3 3h8v8H3zM13 3h8v8h-8zM13 13h8v8h-8zM3 13h8v8H3z",
  volume: "M11 5 6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07",
  broom: "M19 3 9 13M13 5l6 6M8 14l-4 7 7-4 4-4-3-3z",
  briefcase: "M20 7H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  door: "M14 4h4a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2h4M14 4v16M4 20h16M11 12h.01",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
  gem: "M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M12 3 8 9l4 12 4-12-4-6",
  sprout: "M7 20h10M12 20v-8M12 12C12 8 9 6 4 6c0 5 3 6 8 6zM12 12c0-3 2-5 6-5 0 4-2 5-6 5z",
  flame: "M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s3 1 4-6z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM8 11V7a4 4 0 0 1 8 0v4",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  layout: "M3 3h18v18H3zM3 9h18M9 21V9",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  copy: "M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  image: "M3 5h18v14H3zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M21 16l-5-5L7 19",
};
export function icon(name, size = 20) {
  const p = PATHS[name] || PATHS.grid;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${
    p.split("M").filter(Boolean).map((seg) => `<path d="M${seg}"/>`).join("")
  }</svg>`;
  const span = document.createElement("i");
  span.style.display = "inline-flex";
  span.innerHTML = svg;
  return span;
}

/* ---- Toast -------------------------------------------------------------- */
// Returns a handle: .update(msg,type) swaps content in place (re-arming the
// auto-dismiss unless {persist:true}); .dismiss() closes now. Pass
// {persist:true} to keep it visible until the caller updates/dismisses it —
// used by long backend exports so the spinner doesn't vanish mid-request.
export function toast(message, type = "", { persist = false } = {}) {
  let host = document.getElementById("toasts");
  if (!host) { host = el("div", { id: "toasts" }); document.body.append(host); }
  const node = el("div", { class: `toast ${type}` }, message);
  host.append(node);
  let timer = null, gone = false;
  const dismiss = () => {
    if (gone) return; gone = true; if (timer) clearTimeout(timer);
    node.style.transition = "opacity .3s, transform .3s"; node.style.opacity = "0"; node.style.transform = "translateY(8px)";
    setTimeout(() => node.remove(), 300);
  };
  const arm = () => { timer = setTimeout(dismiss, 2600); };
  if (!persist) arm();
  return {
    node,
    update(msg, ty = "", { persist: keep = false } = {}) {
      if (gone) return this;
      node.className = `toast ${ty}`;
      node.replaceChildren(msg && msg.nodeType ? msg : document.createTextNode(String(msg)));
      if (timer) clearTimeout(timer);
      if (!keep) arm();
      return this;
    },
    dismiss,
  };
}

/* ---- Overlay-based modal / drawer -------------------------------------- */
function overlayHost() {
  let h = document.getElementById("overlays");
  if (!h) { h = el("div", { id: "overlays" }); document.body.append(h); }
  return h;
}
function openLayer(buildInner) {
  const host = overlayHost();
  const overlay = el("div", { class: "overlay" });
  const close = () => { layer.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  overlay.addEventListener("click", close);
  const inner = buildInner(close);
  const layer = el("div", {}, overlay, inner);
  host.append(layer);
  document.addEventListener("keydown", onKey);
  return { close, inner };
}

export function modal({ title, body, actions = [], size }) {
  return openLayer((close) => {
    const foot = actions.length
      ? el("div", { class: "modal-foot" }, actions.map((a) =>
          el("button", { class: `btn ${a.class || ""}`, onClick: () => a.onClick ? a.onClick(close) : close() }, a.label)))
      : null;
    const m = el("div", { class: "modal", style: size === "lg" ? { width: "min(760px, calc(100vw - 32px))" } : {} },
      el("div", { class: "modal-head" }, el("h3", {}, title || ""), el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: close, "aria-label": "Close" }, icon("x", 18))),
      el("div", { class: "modal-body" }, body),
      foot,
    );
    m.addEventListener("click", (e) => e.stopPropagation());
    return m;
  });
}

export function drawer({ title, body }) {
  return openLayer((close) => {
    const d = el("div", { class: "drawer" },
      el("div", { class: "drawer-head" }, el("h3", {}, title || ""), el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: close, "aria-label": "Close" }, icon("x", 18))),
      el("div", { class: "drawer-body" }, body),
    );
    d.addEventListener("click", (e) => e.stopPropagation());
    return d;
  });
}

export function confirmDialog(message, { danger = true } = {}) {
  return new Promise((resolve) => {
    const { close } = modal({
      title: "", body: el("p", { style: { fontSize: "var(--fs-md)" } }, message),
      actions: [
        { label: "Cancel", onClick: (c) => { c(); resolve(false); } },
        { label: "Delete", class: danger ? "btn-danger" : "btn-primary", onClick: (c) => { c(); resolve(true); } },
      ],
    });
  });
}

/* ---- Searchable combobox (assignee picker) ----------------------------- */
// options: [{value, label, meta}]. Emits onSelect(value|null). `allowFree`
// lets the user type an arbitrary value (e.g. visiting speaker names).
// The menu is appended to <body> with position:fixed while open, so no
// ancestor scroller (.clm-scroll, .tbl-wrap, .modal, .content) can clip it;
// it flips above the input when the viewport bottom is too close.
export function combo({ options, value, placeholder = "", allowFree = false, autofocus = false, onSelect }) {
  const input = el("input", { class: "input", placeholder, value: labelFor(value) || "", autocomplete: "off" });
  const menu = el("div", { class: "combo-menu", style: { display: "none" } });
  const wrap = el("div", { class: "combo" }, input);
  let hi = -1, filtered = options;

  function labelFor(v) { const o = options.find((x) => x.value === v); return o ? o.label : (allowFree ? v : ""); }
  function render(q = "") {
    const ql = q.trim().toLowerCase();
    filtered = ql ? options.filter((o) => o.label.toLowerCase().includes(ql)) : options;
    hi = -1;
    menu.replaceChildren();
    if (value) menu.append(el("div", { class: "combo-opt", onmousedown: (e) => { e.preventDefault(); pick(null); } }, "✕ ", (placeholder || "Clear")));
    filtered.slice(0, 50).forEach((o, i) => {
      menu.append(el("div", { class: "combo-opt", dataset: { i }, onmousedown: (e) => { e.preventDefault(); pick(o.value); } },
        el("span", {}, o.label), o.meta ? el("span", { class: "g" }, o.meta) : null));
    });
    if (!filtered.length && !allowFree) menu.append(el("div", { class: "combo-opt muted" }, "No matches"));
  }
  function place() {
    if (!input.isConnected) return closeMenu();
    const r = input.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
    const need = Math.min(menu.scrollHeight, 260);
    const up = below < need && above > below; // flip up when the bottom is tight
    menu.style.maxHeight = `${Math.min(260, Math.max(80, up ? above : below))}px`;
    menu.style.left = `${r.left}px`;
    menu.style.width = `${r.width}px`;
    menu.style.top = up ? "auto" : `${r.bottom + 4}px`;
    menu.style.bottom = up ? `${window.innerHeight - r.top + 4}px` : "auto";
  }
  function show() {
    if (!menu.isConnected) document.body.append(menu);
    menu.style.display = "block"; place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
  }
  function open() { render(input.value === labelFor(value) ? "" : input.value); show(); }
  function closeMenu() {
    menu.style.display = "none"; menu.remove();
    window.removeEventListener("scroll", place, true);
    window.removeEventListener("resize", place);
  }
  function pick(v) { value = v; input.value = labelFor(v) || ""; closeMenu(); onSelect && onSelect(v); }

  input.addEventListener("focus", open);
  input.addEventListener("input", () => { render(input.value); show(); });
  input.addEventListener("blur", () => setTimeout(() => {
    closeMenu();
    if (allowFree && input.value.trim() && !options.some((o) => o.label === input.value.trim())) { value = input.value.trim(); onSelect && onSelect(value); }
    else input.value = labelFor(value) || "";
  }, 120));
  input.addEventListener("keydown", (e) => {
    const opts = [...menu.querySelectorAll(".combo-opt")];
    if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hi + 1, opts.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(hi - 1, 0); }
    else if (e.key === "Enter") { e.preventDefault(); if (opts[hi]) opts[hi].dispatchEvent(new MouseEvent("mousedown")); else input.blur(); return; }
    else if (e.key === "Escape") { closeMenu(); return; }
    opts.forEach((o, i) => o.classList.toggle("hi", i === hi));
  });
  if (autofocus) setTimeout(() => input.focus({ preventScroll: true }), 0);
  return wrap;
}
