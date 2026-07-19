// ============================================================================
// STORE — the app's single source of truth. Talks to the backend, caches every
// document in localStorage, and works offline (reads from cache, queues writes
// and retries). Views subscribe and re-render on change.
// ============================================================================
import { api, ApiError, setApiEmail } from "./api.js";
import { KINDS } from "./config.js";

const DEFAULTS = { meta: () => ({}), _arr: () => [] };
const defaultFor = (kind) => (DEFAULTS[kind] || DEFAULTS._arr)();

class Store {
  constructor() {
    this.email = localStorage.getItem("jw_email") || null;
    this.memberships = [];      // [{congregation, permissions}]
    this.congId = null;
    this.congregation = null;
    this.permissions = {};
    this.memberNameEn = null;   // signed-in member's English name (from their access record)
    this.docs = {};             // kind -> parsed document
    this.sync = "online";       // online | saving | offline | error
    this._subs = new Set();
    this._syncSubs = new Set();
    this._pending = new Map();   // kind -> latest doc awaiting save
    this._timers = new Map();
    if (this.email) setApiEmail(this.email);
    window.addEventListener("online", () => this._flushAll());
  }

  /* ---- session -------------------------------------------------------- */
  setEmail(email) {
    this.email = email.trim().toLowerCase();
    localStorage.setItem("jw_email", this.email);
    setApiEmail(this.email);
  }
  signOut() {
    localStorage.removeItem("jw_email");
    localStorage.removeItem("jw_cong");
    this.email = null; this.congId = null; this.docs = {}; this.memberships = [];
  }

  async loadMemberships() {
    try {
      this.memberships = await api.me();
      localStorage.setItem(this._mk(), JSON.stringify(this.memberships));
      this._setSync("online");
    } catch (e) {
      // Offline: fall back to the last-known memberships so the app still opens.
      if (e.status === 0) {
        const cached = this._readMembersCache();
        if (cached) { this.memberships = cached; this._setSync("offline"); return this.memberships; }
      }
      throw e;
    }
    return this.memberships;
  }
  _mk() { return `jw:members:${this.email}`; }
  _readMembersCache() { try { const v = localStorage.getItem(this._mk()); return v ? JSON.parse(v) : null; } catch { return null; } }

  /* ---- congregation --------------------------------------------------- */
  async selectCongregation(id) {
    this.congId = String(id);
    localStorage.setItem("jw_cong", this.congId);
    const m = this.memberships.find((x) => String(x.congregation.id) === this.congId);
    this.congregation = m ? m.congregation : (await api.getCongregation(id));
    this.permissions = m ? m.permissions : {};
    // The signed-in member's English name (from their access record), used to map
    // them to a publisher so the dashboard can show their own assignments.
    this.memberNameEn = (m && m.nameEn) || null;
    await this._loadDocs();
    this._emit();
  }

  async _loadDocs() {
    // Optimistically hydrate from cache first so the UI is instant offline.
    for (const kind of KINDS) {
      const cached = this._readCache(kind);
      this.docs[kind] = cached != null ? cached : defaultFor(kind);
    }
    try {
      const all = await api.getAllData(this.congId);
      for (const kind of KINDS) {
        if (all && kind in all) { this.docs[kind] = all[kind]; this._writeCache(kind, all[kind]); }
      }
      this._setSync("online");
    } catch (e) {
      this._setSync(e.status === 0 ? "offline" : "error");
    }
  }

  /* ---- documents ------------------------------------------------------ */
  get(kind) { return this.docs[kind] != null ? this.docs[kind] : defaultFor(kind); }

  set(kind, doc) {
    this.docs[kind] = doc;
    this._writeCache(kind, doc);
    this._emit();
    this._queueSave(kind, doc);
  }

  _queueSave(kind, doc) {
    this._pending.set(kind, doc);
    clearTimeout(this._timers.get(kind));
    this._setSync("saving");
    this._timers.set(kind, setTimeout(() => this._flush(kind), 600));
  }
  async _flush(kind) {
    if (!this._pending.has(kind)) return;
    const doc = this._pending.get(kind);
    try {
      await api.putData(this.congId, kind, doc);
      this._pending.delete(kind);
      this._setSync(this._pending.size ? "saving" : "online");
    } catch (e) {
      this._setSync(e.status === 0 ? "offline" : "error");
      // keep it pending; retry on reconnect or next edit
    }
  }
  async _flushAll() { for (const k of [...this._pending.keys()]) await this._flush(k); }

  /* ---- permissions ---------------------------------------------------- */
  isOwner() { return this.congregation && this.email === (this.congregation.ownerEmail || "").toLowerCase(); }
  can(area, action = "view") {
    if (this.isOwner()) return true;
    const p = this.permissions[area];
    return !!(p && p[action]);
  }
  canViewKind(kind) {
    if (["publishers", "groups", "meta"].includes(kind)) return true;
    return this.can(kind, "view");
  }
  canEditKind(kind) {
    if (this.isOwner()) return true;
    if (["publishers", "groups", "meta"].includes(kind)) return Object.values(this.permissions).some((p) => p && p.edit);
    return this.can(kind, "edit");
  }
  // "Read" = at-least-view access to a kind's data. The owner reads everything;
  // publishers/groups/meta are shared reference data everyone reads; otherwise the
  // member must have an access entry granting view (edit implies view) on that area.
  canReadKind(kind) {
    if (this.isOwner()) return true;
    if (["publishers", "groups", "meta"].includes(kind)) return true;
    const p = this.permissions[kind];
    return !!(p && (p.view || p.edit));
  }

  /* ---- cache ---------------------------------------------------------- */
  _ck(kind) { return `jw:${this.congId}:${kind}`; }
  _readCache(kind) { try { const v = localStorage.getItem(this._ck(kind)); return v ? JSON.parse(v) : null; } catch { return null; } }
  _writeCache(kind, doc) { try { localStorage.setItem(this._ck(kind), JSON.stringify(doc)); } catch {} }

  /* ---- pub/sub -------------------------------------------------------- */
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); }
  _emit() { this._subs.forEach((fn) => fn()); }
  onSync(fn) { this._syncSubs.add(fn); return () => this._syncSubs.delete(fn); }
  _setSync(s) { this.sync = s; this._syncSubs.forEach((fn) => fn(s)); }
}

export const store = new Store();
export const uid = (p = "x") => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
