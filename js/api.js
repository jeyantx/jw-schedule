// ============================================================================
// API — thin fetch wrapper around the Catalyst AppSail. Sends the signed-in
// user's email as X-User-Email (the backend's caller identity). Throws
// ApiError with a status so callers can distinguish 401/403/offline.
// ============================================================================
import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
}

let currentEmail = null;
export const setApiEmail = (email) => { currentEmail = email; };

async function request(method, path, body, { raw = false, timeout = 45000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(CONFIG.api + path, {
      method,
      headers: {
        ...(currentEmail ? { "X-User-Email": currentEmail } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new ApiError(e.name === "AbortError" ? "Request timed out" : "Network unavailable", 0);
  }
  clearTimeout(timer);

  if (raw) {
    if (!res.ok) throw new ApiError(await safeText(res), res.status);
    return res;
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && data.error) || text || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

const safeJson = (t) => { try { return JSON.parse(t); } catch { return t; } };
const safeText = async (r) => { try { return await r.text(); } catch { return `HTTP ${r.status}`; } };

export const api = {
  me: () => request("GET", "/me"),
  createCongregation: (name) => request("POST", "/congregations", { name }),
  getCongregation: (id) => request("GET", `/congregations/${id}`),
  listAccess: (id) => request("GET", `/congregations/${id}/access`),
  grantAccess: (id, email, permissions) => request("POST", `/congregations/${id}/access`, { email, permissions }),
  revokeAccess: (id, targetEmail) => request("DELETE", `/congregations/${id}/access?targetEmail=${encodeURIComponent(targetEmail)}`),
  // wol.jw.org HTML proxy — returns the raw page text (raw mode → Response).
  wolFetch: async (path) => (await request("GET", `/wol/fetch?path=${encodeURIComponent(path)}`, undefined, { raw: true })).text(),
  getAllData: (id) => request("GET", `/congregations/${id}/data`),
  getData: (id, kind) => request("GET", `/congregations/${id}/data/${kind}`),
  putData: (id, kind, doc) => request("PUT", `/congregations/${id}/data/${kind}`, doc),
  // PDF: returns a Blob. marginMm (0..50) is applied evenly to all four sides
  // by the backend; omitted → backend default (10mm).
  pdf: async (html, { landscape = true, format = "A4", marginMm, filename = "schedule" } = {}) => {
    const body = { html, landscape, format, filename };
    if (marginMm != null) body.marginMm = marginMm;
    const res = await request("POST", "/pdf", body, { raw: true, timeout: 90000 });
    return res.blob();
  },
};
