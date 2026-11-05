// Test setup bootstrap for Vitest.
// Intentionally minimal; per-suite setup should live alongside tests.

import { performance as nodePerformance } from "node:perf_hooks";

// jsdom has no User Timing (performance.mark, measure and their entries), which every browser has and the scene
// marks use: Node implements the same API.
if (typeof window !== "undefined" && typeof window.performance.mark !== "function") {
  Object.defineProperty(window, "performance", { value: nodePerformance, configurable: true, writable: true });
}

// jsdom has no viewport: the app's frame asks for one, so a page renders in the phone layout unless a test sets a
// width (src/shell/frame/test-viewport.ts).
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }) as unknown as MediaQueryList;
}

// jsdom lays nothing out, so it has no scrolling: a page that brings a panel into view asks for it anyway.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Nor does it resize anything: an element watched for its size is never told of one.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
