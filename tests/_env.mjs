// Browser-global stubs so app modules import cleanly under node:test.
// Import this FIRST in every test file (side-effect module).
globalThis.location ??= { hostname: "localhost", search: "", origin: "http://localhost" };
globalThis.window ??= { addEventListener: () => {}, removeEventListener: () => {} };

// Node exposes an experimental localStorage that throws without --localstorage-file;
// force-replace it with a simple in-memory shim.
const mem = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  },
});
