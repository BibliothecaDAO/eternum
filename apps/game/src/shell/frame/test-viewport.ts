import { vi } from "vitest";

/** jsdom has no viewport: answer the frame's width queries for the width a test sets. */
export const setViewportWidth = (width: number) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity) <= width,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
