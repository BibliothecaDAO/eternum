/**
 * Browser global shims for the Cartridge Controller WASM module.
 *
 * The WASM (compiled from Rust with web_sys) uses:
 *   1. `typeof window` to find the global window
 *   2. `getObject(arg0) instanceof Window` to validate it
 *   3. `window.local_storage()` → `window.localStorage` for persistence
 *
 * In Node/Bun there is no `Window` class, so `instanceof Window` fails.
 * We define a minimal Window class and make our shim an instance of it.
 */
const store = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, v);
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (i: number) => [...store.keys()][i] ?? null,
};

const g = globalThis as any;

// Define Window class if missing so `instanceof Window` passes
if (typeof g.Window === "undefined") {
  g.Window = class Window {};
}

if (typeof g.window === "undefined") {
  // Create a window shim that is an instanceof Window
  const win = Object.create(g.Window.prototype);
  win.localStorage = localStorageShim;
  win.sessionStorage = localStorageShim;
  win.location = { origin: "http://localhost" };
  g.window = win;
} else {
  if (!g.window.localStorage) g.window.localStorage = localStorageShim;
}
if (typeof g.self === "undefined") {
  g.self = g.window;
}
if (typeof g.localStorage === "undefined") {
  g.localStorage = localStorageShim;
}
