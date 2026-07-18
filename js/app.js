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
function initTheme() {
  const saved = localStorage.getItem("jw_theme");
  if (saved) document.documentElement.dataset.theme = saved;
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme
    || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("jw_theme", next);
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
boot();

async function boot() {
  if (!store.email) return mount(root, renderLogin(onAuthed));
  await afterAuth();
}
function onAuthed() { afterAuth(); }

async function afterAuth() {
  mount(root, loadingScreen());
  try {
    await store.loadMemberships();
  } catch (e) {
    if (e.status === 401) { store.signOut(); return mount(root, renderLogin(onAuthed)); }
    toast(e.message || "Could not reach server", "danger");
  }
  if (!store.memberships.length) return mount(root, renderCongPicker(afterAuth));
  const last = localStorage.getItem("jw_cong");
  const pick = store.memberships.find((m) => String(m.congregation.id) === last) || store.memberships[0];
  await store.selectCongregation(pick.congregation.id);
  renderShell();
}

function loadingScreen() {
  return el("div", { class: "center", style: { height: "100dvh" } },
    el("div", { class: "row" }, icon("clock", 22), el("span", { class: "muted" }, "Loading…")));
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
      el("div", { class: "mark" }, icon("calendar", 20)),
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
  const themeBtn = el("button", { class: "btn btn-icon btn-ghost btn-sm", title: t("theme"), onClick: toggleTheme }, icon("moon", 18));
  const userBtn = el("button", { class: "avatar", title: store.email, onClick: openUserMenu }, (store.email || "?")[0].toUpperCase());
  const hamburger = el("button", { class: "btn btn-icon btn-ghost hamburger", onClick: () => toggleSidebar(), "aria-label": "Menu" }, icon("menu"));

  return el("header", { class: "topbar" },
    hamburger,
    el("div", { class: "title", id: "viewTitle" }, ""),
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
  const title = document.getElementById("viewTitle"); if (title) title.textContent = t(name);
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
  if (saved) requestAnimationFrame(() => {
    document.querySelectorAll(SCROLLERS).forEach((n, i) => { if (saved[i]) { n.scrollTop = saved[i][0]; n.scrollLeft = saved[i][1]; } });
    window.scrollTo(win[0], win[1]);
  });
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
      el("button", { class: "btn btn-danger", style: { width: "100%" }, onClick: () => { store.signOut(); location.hash = ""; location.reload(); } }, icon("logout", 16), t("signOut"))) });
  });
}
