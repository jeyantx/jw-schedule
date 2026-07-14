// ============================================================================
// ROUTER — tiny hash router. Routes are registered as { name: renderFn }.
// ============================================================================
export class Router {
  constructor(routes, fallback) { this.routes = routes; this.fallback = fallback; this._on = null; }
  onChange(fn) { this._on = fn; }
  start() { window.addEventListener("hashchange", () => this._render()); this._render(); }
  go(name) { location.hash = `#/${name}`; }
  current() { return (location.hash.replace(/^#\/?/, "").split("/")[0]) || this.fallback; }
  _render() {
    const name = this.current();
    const fn = this.routes[name] || this.routes[this.fallback];
    this._on && this._on(name in this.routes ? name : this.fallback);
    return fn;
  }
  view(name) { return this.routes[name] || this.routes[this.fallback]; }
}
