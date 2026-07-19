// ============================================================================
// APP SHELL — boot, auth gate, congregation gate, sidebar/topbar, routing.
// ============================================================================
import { store } from "./store.js";
import { S, shiftMonth, monthName } from "./state.js";
import { t, getLang, setLang } from "./i18n.js";
import { el, mount, icon, toast } from "./ui.js";
import { Router } from "./router.js";

import { renderLogin, renderCongPicker } from "./views/auth.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderClm } from "./views/clm.js";
import { renderPublishers } from "./views/publishers.js";
import { renderGroups } from "./views/groups.js";
import { renderAccess } from "./views/access.js";
import { renderSettings } from "./views/settings.js";
import { makeRoster } from "./views/roster.js";
import { renderWeekend } from "./views/weekend.js";
import { renderPortions } from "./views/portions.js";

const root = document.getElementById("app");

/* ---- theme -------------------------------------------------------------- */
// Three modes cycle: light → dark → auto. "auto" follows the OS preference and
// re-applies live. New users default to "auto". The applied mechanism is the
// existing one: an explicit data-theme="light|dark" on <html> (tokens.css keys
// off it), resolved from the mode here so "auto" stays in sync with the system.
const THEME_MODES = ["light", "dark", "auto"];
const themeMode = () => localStorage.getItem("jw_theme") || "auto";
function applyTheme() {
  const mode = themeMode();
  const dark = mode === "dark" || (mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
function initTheme() {
  applyTheme();
  // Live-follow the OS while in "auto".
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (themeMode() === "auto") applyTheme();
  });
}
function cycleTheme() {
  const next = THEME_MODES[(THEME_MODES.indexOf(themeMode()) + 1) % THEME_MODES.length];
  localStorage.setItem("jw_theme", next);
  applyTheme();
  labelThemeBtn();
}
function themeModeLabel() {
  const ta = getLang() === "ta";
  const names = ta ? { light: "வெளிச்சம்", dark: "இருள்", auto: "தானியங்கி" } : { light: "Light", dark: "Dark", auto: "Auto" };
  return `${t("theme")}: ${names[themeMode()]}`;
}
const themeModeIcon = () => (themeMode() === "light" ? "sun" : "moon");
let themeBtnEl = null;
function labelThemeBtn() {
  if (!themeBtnEl) return;
  themeBtnEl.title = themeModeLabel();
  themeBtnEl.replaceChildren(icon(themeModeIcon(), 18));
}

/* ---- nav definition ----------------------------------------------------- */
const NAV = [
  { group: "schedules", items: [
    { name: "dashboard", icon: "layout", kind: null },
    { name: "clm", icon: "gem", kind: "clm" },
    { name: "weekend", icon: "calendar", kind: "weekend" },
    { name: "av", icon: "volume", kind: "av" },
    { name: "cleaning", icon: "broom", kind: "cleaning" },
    { name: "fsm", icon: "briefcase", kind: "fsm" },
    { name: "attendant", icon: "door", kind: "attendant" },
  ]},
  { group: "people", items: [
    { name: "publishers", icon: "users", kind: "publishers" },
    { name: "groups", icon: "grid", kind: "groups" },
    { name: "portions", icon: "grid", kind: null },
  ]},
  { group: "admin", items: [
    { name: "access", icon: "shield", kind: null, ownerOnly: true },
    { name: "settings", icon: "settings", kind: null },
  ]},
];

/* ---- routes ------------------------------------------------------------- */
const ROUTES = {
  dashboard: renderDashboard,
  clm: renderClm,
  weekend: renderWeekend,
  av: makeRoster("av"),
  cleaning: makeRoster("cleaning"),
  fsm: makeRoster("fsm"),
  attendant: makeRoster("attendant"),
  publishers: renderPublishers,
  groups: renderGroups,
  portions: renderPortions,
  access: renderAccess,
  settings: renderSettings,
};
const router = new Router(ROUTES, "dashboard");

/* ---- boot --------------------------------------------------------------- */
initTheme();
// Reflect the active UI language on <html lang> so :lang(ta) + the
// html[lang="ta"] token overrides (slightly smaller scale for Tamil) apply.
// Language switch calls location.reload(), so setting this once at boot covers
// both initial load and post-switch.
document.documentElement.lang = getLang();
// boot() is invoked at the END of this module: it synchronously reaches
// loadingScreen(), which assigns the `let bootStatusEl` declared further down —
// calling it here would hit the temporal dead zone and silently break boot.

async function boot() {
  registerServiceWorker();
  if (!store.email) return mount(root, renderLogin(onAuthed));
  await afterAuth();
}
function onAuthed() { afterAuth(); }

// Network-first service worker (sw.js) for offline code-asset support + daily
// cache invalidation. Registered with a RELATIVE path so the GitHub Pages
// subpath scopes it correctly. Never let a SW error break boot.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) { /* ignore */ }
}

async function afterAuth() {
  mount(root, loadingScreen());
  try {
    await store.loadMemberships();
  } catch (e) {
    if (e.status === 401) { store.signOut(); return mount(root, renderLogin(onAuthed)); }
    toast(e.message || "Could not reach server", "danger");
  }
  if (!store.memberships.length) return mount(root, renderCongPicker(afterAuth));
  setBootStatus(bootMsg("cong"));
  const last = localStorage.getItem("jw_cong");
  const pick = store.memberships.find((m) => String(m.congregation.id) === last) || store.memberships[0];
  setBootStatus(bootMsg("schedules"));
  await store.selectCongregation(pick.congregation.id);
  renderShell();
}

/* ---- branded loading screen with live boot status ----------------------- */
let bootStatusEl = null;
function setBootStatus(msg) { if (bootStatusEl) bootStatusEl.textContent = msg; }
function bootMsg(stage) {
  const ta = getLang() === "ta"; // getLang() already maps "mixed" → English chrome
  const M = {
    signin: ta ? "உள்நுழைகிறது…" : "Signing in…",
    cong: ta ? "சபை ஏற்றுகிறது…" : "Loading congregation…",
    schedules: ta ? "அட்டவணைகள் ஏற்றுகிறது…" : "Loading schedules…",
  };
  return M[stage] || "";
}
function loadingScreen() {
  bootStatusEl = el("span", {}, bootMsg("signin"));
  return el("div", { class: "center", style: { height: "100dvh" } },
    el("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", textAlign: "center" } },
      el("img", { src: "assets/icon.png", alt: "", style: { width: "56px", height: "56px", borderRadius: "14px" } }),
      el("div", { style: { fontWeight: 800, fontSize: "var(--fs-lg)" } }, t("app")),
      el("div", { class: "row", style: { gap: "9px", color: "var(--text-3)", fontSize: "var(--fs-sm)" } },
        el("span", { class: "spinner" }), bootStatusEl)));
}

/* ---- shell -------------------------------------------------------------- */
let els = {};
function renderShell() {
  const sidebar = el("aside", { class: "sidebar" });
  const scrim = el("div", { class: "overlay scrim", style: { display: "none", zIndex: 65 }, onClick: () => toggleSidebar(false) });
  const content = el("main", { class: "content", id: "content" });
  const topbar = buildTopbar();
  const main = el("div", { class: "main" }, topbar, content);
  const shell = el("div", { class: "shell" }, sidebar, main);
  els = { sidebar, content, scrim, topbar };
  mount(root, shell, scrim);
  buildSidebar();

  S.go = (name) => router.go(name);
  S.refresh = () => renderView(router.current());
  store.subscribe(() => renderView(router.current()));
  store.onSync(updateSyncDot);

  router.onChange((name) => { renderView(name); highlightNav(name); toggleSidebar(false); });
  router.start();
  updateSyncDot(store.sync);
}

function buildSidebar() {
  const nav = el("nav", { class: "side-nav" });
  NAV.forEach((section) => {
    const items = section.items.filter((it) => {
      if (it.ownerOnly && !store.isOwner()) return false;
      if (it.kind && !store.canViewKind(it.kind)) return false;
      return true;
    });
    if (!items.length) return;
    nav.append(el("div", { class: "side-group" }, t(section.group)));
    items.forEach((it) => {
      const canEdit = it.kind ? store.canEditKind(it.kind) : true;
      nav.append(el("button", { class: "nav-item", dataset: { route: it.name }, onClick: () => router.go(it.name) },
        icon(it.icon), el("span", { class: "grow" }, t(it.name)),
        it.kind && !canEdit ? el("span", { class: "lock" }, icon("lock", 14)) : null));
    });
  });
  mount(els.sidebar,
    el("div", { class: "side-brand" },
      el("div", { class: "mark", style: { background: "transparent", padding: 0 } },
        el("img", { src: "assets/icon.png", alt: "", style: { width: "34px", height: "34px", borderRadius: "var(--r-md)" } })),
      el("div", {}, el("div", { class: "name" }, t("app")), el("div", { class: "sub" }, t("tagline")))),
    nav);
}

function buildTopbar() {
  const congBtn = el("button", { class: "cong-switch", onClick: openCongMenu },
    el("span", { class: "dot" }), el("span", {}, store.congregation?.name || ""), icon("chevronDown", 16));

  const monthNav = el("div", { class: "month-nav hide-sm" },
    el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => shiftMonth(-1), "aria-label": "Previous month" }, icon("chevronLeft", 18)),
    el("span", { class: "label", id: "monthLabel" }, monthName(S.month, getLang())),
    el("button", { class: "btn btn-icon btn-ghost btn-sm", onClick: () => shiftMonth(1), "aria-label": "Next month" }, icon("chevronRight", 18)));

  const sync = el("div", { class: "sync-dot hide-sm", id: "syncDot" }, el("span", { class: "d" }), el("span", { class: "txt" }, t("saved")));

  const langBtn = el("button", { class: "btn btn-icon btn-ghost btn-sm", title: t("language"), onClick: () => { setLang(getLang() === "ta" ? "en" : "ta"); location.reload(); } }, icon("globe", 18));
  const themeBtn = el("button", { class: "btn btn-icon btn-ghost btn-sm", title: themeModeLabel(), onClick: cycleTheme }, icon(themeModeIcon(), 18));
  themeBtnEl = themeBtn;
  const userBtn = el("button", { class: "avatar", title: store.email, onClick: openUserMenu }, (store.email || "?")[0].toUpperCase());
  const hamburger = el("button", { class: "btn btn-icon btn-ghost hamburger", onClick: () => toggleSidebar(), "aria-label": "Menu" }, icon("menu"));

  return el("header", { class: "topbar" },
    hamburger,
    el("div", { class: "grow" }),
    monthNav, sync, congBtn, langBtn, themeBtn, userBtn);
}

function updateSyncDot(state) {
  const dot = document.getElementById("syncDot"); if (!dot) return;
  dot.className = `sync-dot hide-sm ${state === "online" ? "" : state}`;
  dot.querySelector(".txt").textContent =
    state === "saving" ? t("saving") : state === "offline" ? t("offline") : state === "error" ? "!" : t("saved");
}

function toggleSidebar(force) {
  const open = force != null ? force : !els.sidebar.classList.contains("open");
  els.sidebar.classList.toggle("open", open);
  els.scrim.style.display = open ? "block" : "none";
}

function highlightNav(name) {
  els.sidebar.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.route === name));
  const ml = document.getElementById("monthLabel"); if (ml) ml.textContent = monthName(S.month, getLang());
}

const SCROLLERS = ".content, .clm-scroll, .tbl-wrap"; // app scroll regions
let lastView = null;
function renderView(name) {
  const item = [].concat(...NAV.map((s) => s.items)).find((i) => i.name === name);
  // guard direct hash access to a tab the user can't see
  if (item && ((item.ownerOnly && !store.isOwner()) || (item.kind && !store.canViewKind(item.kind)))) {
    return mount(els.content, el("div", { class: "empty" }, icon("lock", 40), el("p", {}, t("viewOnly"))));
  }
  // preserve scroll positions across S.refresh()/store re-renders of the SAME
  // view (inline edits) so the page doesn't jump; navigation resets scroll.
  const keep = name === lastView; lastView = name;
  const saved = keep ? [...document.querySelectorAll(SCROLLERS)].map((n) => [n.scrollTop, n.scrollLeft]) : null;
  const win = keep ? [window.scrollX, window.scrollY] : null;
  const fn = router.view(name);
  try { mount(els.content, fn()); }
  catch (e) { console.error(e); mount(els.content, el("div", { class: "empty" }, icon("alert", 40), el("p", {}, "Something went wrong rendering this view."))); }
  // Restore scroll SYNCHRONOUSLY in the same task as the mount (before the
  // browser paints) so there's no visible frame at scrollTop 0 → no jump/shake
  // on inline edits. The rAF pass is a belt-and-braces second write for any
  // layout that settles a frame later (e.g. async images).
  if (saved) {
    const restore = () => {
      document.querySelectorAll(SCROLLERS).forEach((n, i) => { if (saved[i]) { n.scrollTop = saved[i][0]; n.scrollLeft = saved[i][1]; } });
      if (win) window.scrollTo(win[0], win[1]);
    };
    restore();
    requestAnimationFrame(restore);
  }
  highlightNav(name);
  document.getElementById("monthLabel") && (document.getElementById("monthLabel").textContent = monthName(S.month, getLang()));
}

/* ---- menus -------------------------------------------------------------- */
function openCongMenu() {
  import("./ui.js").then(({ modal }) => {
    const list = el("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
    store.memberships.forEach((m) => {
      list.append(el("button", { class: "btn", style: { justifyContent: "flex-start" },
        onClick: async (e) => { close(); await store.selectCongregation(m.congregation.id); location.reload(); } },
        icon("calendar", 16), el("span", { class: "grow", style: { textAlign: "left" } }, m.congregation.name),
        String(m.congregation.id) === store.congId ? icon("check", 16) : null));
    });
    list.append(el("button", { class: "btn btn-primary", onClick: () => { close(); newCongregation(); } }, icon("plus", 16), t("createCong")));
    const { close } = modal({ title: t("app"), body: list });
  });
}
function newCongregation() {
  import("./views/auth.js").then(({ createCongregationModal }) => createCongregationModal(async () => { await afterAuth(); location.reload(); }));
}
function openUserMenu() {
  import("./ui.js").then(({ modal }) => {
    const { close } = modal({ title: store.email, body: el("div", {},
      el("p", { class: "hint", style: { marginBottom: "12px" } }, store.isOwner() ? t("owner") : ""),
      el("button", { class: "btn btn-danger", style: { width: "100%" }, onClick: async () => {
        store.signOut(); location.hash = "";
        // Drop every cached code asset so login lands on the freshest UI.
        try { if ("caches" in window) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } } catch (e) { /* ignore */ }
        location.reload();
      } }, icon("logout", 16), t("signOut"))) });
  });
}

boot();
