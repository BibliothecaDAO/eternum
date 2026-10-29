import { vi } from "vitest";

/** What listens to the frame's width queries now, told when the width changes, as a browser tells them. */
const listeners = new Set<() => void>();
let current = 0;

/**
 * jsdom has no viewport: answer the frame's width queries for the width a test sets. Setting another width is the
 * window resized: every query listening is told, and the layout follows.
 */
export const setViewportWidth = (width: number) => {
  current = width;
  vi.stubGlobal("matchMedia", (query: string) => {
    const least = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity);
    return {
      get matches() {
        return least <= current;
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      addListener: (listener: () => void) => listeners.add(listener),
      removeListener: (listener: () => void) => listeners.delete(listener),
    };
  });
  for (const listener of [...listeners]) listener();
};
