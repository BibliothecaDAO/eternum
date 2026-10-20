// Test setup bootstrap for Vitest.
// Intentionally minimal; per-suite setup should live alongside tests.

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
