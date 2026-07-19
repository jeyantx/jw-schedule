// ============================================================================
// SERVICE WORKER — network-first for same-origin code assets, with a daily
// cache bucket so the UI auto-invalidates once per day (no hard reload needed).
//
// - Strategy: try the network first (cache: "no-cache"); on success cache a copy
//   and return the fresh response; on failure fall back to the cache (offline).
// - Cache name is bucketed by day: jw-static-<YYYY-MM-DD>. On activate we delete
//   every one of our caches that isn't today's → automatic daily invalidation.
// - Skips non-GET, cross-origin (the backend API must NOT be intercepted), and
//   range requests. All paths are scope-relative — safe on the GitHub Pages
//   subpath (no absolute "/" assumptions).
// ============================================================================
const CACHE_PREFIX = "jw-static-";
const today = () => new Date().toISOString().slice(0, 10);
const cacheName = () => CACHE_PREFIX + today();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== cacheName()).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // skip non-GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // skip cross-origin (backend API)
  if (req.headers.has("range")) return;                   // skip range requests

  event.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: "no-cache" });
      // Only cache successful same-origin ("basic") responses.
      if (res && res.ok && res.type === "basic") {
        const cache = await caches.open(cacheName());
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
