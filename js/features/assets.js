// ============================================================================
// ASSETS — fetch a same-origin bundled asset and cache it as a data: URI.
// The PDF backend (SmartBrowz) is remote, so relative/localhost image URLs in
// the printable HTML never resolve there; images must be embedded inline. This
// helper loads a repo asset once and hands back a data: URI ready to drop into
// a template. Fetch failure resolves to "" so export still works without it.
// ============================================================================

const cache = new Map(); // path -> Promise<string> (data: URI or "")

export function assetDataUri(path) {
  if (!path) return Promise.resolve("");
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((blob) => new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    }))
    .catch(() => "");
  cache.set(path, p);
  return p;
}
