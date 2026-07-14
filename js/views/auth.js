// ============================================================================
// AUTH VIEWS — email sign-in (Google-ready), and the "create/pick congregation"
// gate shown when a signed-in user belongs to none.
// ============================================================================
import { store } from "../store.js";
import { api } from "../api.js";
import { en } from "../i18n.js";
import { el, icon, toast, modal } from "../ui.js";
import { CONFIG } from "../config.js";

export function renderLogin(onAuthed) {
  const hasGoogle = !!CONFIG.googleClientId;

  // Google Sign-In renders its own button here.
  const googleSlot = el("div", { style: { display: "grid", placeItems: "center", minHeight: "44px" } });

  // Email fallback (hidden by default when Google is available).
  const emailInput = el("input", { class: "input", type: "email", placeholder: "you@example.com", autocomplete: "email" });
  const submitEmail = () => {
    const v = emailInput.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast("Enter a valid email", "danger"); emailInput.focus(); return; }
    store.setEmail(v);
    onAuthed();
  };
  emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitEmail(); });
  const emailBlock = el("div", { style: { display: hasGoogle ? "none" : "block" } },
    el("div", { class: "field" }, el("label", {}, en("email")), emailInput),
    el("div", { style: { height: "12px" } }),
    el("button", { class: "btn btn-primary", style: { width: "100%" }, onClick: submitEmail }, en("continue")));

  const emailToggle = hasGoogle
    ? el("button", { class: "btn btn-ghost btn-sm", style: { marginTop: "8px", color: "var(--text-3)" },
        onClick: () => { emailBlock.style.display = "block"; emailToggle.style.display = "none"; setTimeout(() => emailInput.focus(), 30); } },
        "or continue with email")
    : null;

  const card = el("div", { class: "card card-pad auth-card" },
    el("div", { class: "auth-logo" }, icon("calendar", 26)),
    el("h1", {}, en("app")),
    el("p", { class: "hint" }, en("tagline")),
    el("div", { style: { height: "22px" } }),
    hasGoogle ? googleSlot : null,
    emailToggle,
    emailBlock,
    el("p", { class: "hint", style: { marginTop: "16px", textAlign: "center" } },
      hasGoogle ? "Sign in with your Google account." : "We identify you by email to load your congregations."),
  );

  if (hasGoogle) setTimeout(() => setupGoogle(googleSlot, onAuthed), 0);
  else setTimeout(() => emailInput.focus(), 50);

  return el("div", { class: "auth-wrap" }, card);
}

/* ---- Google Identity Services ------------------------------------------ */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(s);
  });
}
function decodeJwt(token) {
  const part = token.split(".")[1];
  const json = decodeURIComponent(
    atob(part.replace(/-/g, "+").replace(/_/g, "/"))
      .split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
  return JSON.parse(json);
}
async function setupGoogle(slot, onAuthed) {
  try {
    await loadGis();
  } catch (e) {
    slot.append(el("p", { class: "hint", style: { color: "var(--danger)" } }, "Google Sign-In could not load. Check your connection."));
    return;
  }
  try {
    window.google.accounts.id.initialize({
      client_id: CONFIG.googleClientId,
      callback: (resp) => {
        try {
          const info = decodeJwt(resp.credential);
          if (!info.email) { toast("No email in Google account", "danger"); return; }
          store.setEmail(info.email);
          if (info.name) localStorage.setItem("jw_name", info.name);
          onAuthed();
        } catch { toast("Sign-in failed", "danger"); }
      },
    });
    const dark = document.documentElement.dataset.theme === "dark"
      || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    window.google.accounts.id.renderButton(slot, {
      theme: dark ? "filled_blue" : "outline", size: "large", shape: "pill",
      text: "continue_with", width: 320, logo_alignment: "center",
    });
  } catch (e) {
    slot.append(el("p", { class: "hint", style: { color: "var(--danger)" } }, "Google Sign-In misconfigured (check client ID / authorized origin)."));
  }
}

export function renderCongPicker(afterAuth) {
  const card = el("div", { class: "card card-pad auth-card" },
    el("div", { class: "auth-logo" }, icon("plus", 26)),
    el("h1", {}, en("noCong")),
    el("p", { class: "hint" }, en("noCongHint")),
    el("div", { style: { height: "18px" } }),
    el("button", { class: "btn btn-primary", style: { width: "100%" }, onClick: () => createCongregationModal(afterAuth) }, icon("plus", 16), en("createCong")),
    el("button", { class: "btn", style: { width: "100%", marginTop: "8px" }, onClick: () => { store.signOut(); location.reload(); } }, en("signOut")),
  );
  return el("div", { class: "auth-wrap" }, card);
}

export function createCongregationModal(onDone) {
  const input = el("input", { class: "input", placeholder: en("congName"), autocomplete: "off" });
  const create = async (close) => {
    const name = input.value.trim();
    if (!name) { toast(en("required"), "danger"); return; }
    try {
      const c = await api.createCongregation(name);
      toast(`${en("saved")} · ${c.code}`, "ok");
      close();
      onDone && onDone();
    } catch (e) { toast(e.message || "Failed", "danger"); }
  };
  const { close } = modal({
    title: en("createCong"),
    body: el("div", { class: "field" }, el("label", {}, en("congName")), input),
    actions: [{ label: en("cancel"), onClick: (c) => c() }, { label: en("create"), class: "btn-primary", onClick: create }],
  });
  setTimeout(() => input.focus(), 50);
}
