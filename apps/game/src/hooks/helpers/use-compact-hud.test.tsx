import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { COMPACT_HUD_MEDIA_QUERY, COMPACT_LANDSCAPE_MEDIA_QUERY, useCompactLane } from "./use-compact-hud";

const Probe = () => <output>{String(useCompactLane())}</output>;

const render = async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  return { read: () => container.querySelector("output")?.textContent, unmount: () => act(async () => root.unmount()) };
};

/** A matchMedia that answers both lane queries and lets a test flip either one live. */
const installMatchMedia = ({ compact, landscape }: { compact: boolean; landscape: boolean }) => {
  const makeQuery = (media: string, matches: boolean) => {
    const listeners = new Set<() => void>();
    return {
      matches,
      media,
      listeners,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    };
  };
  const queries: Record<string, ReturnType<typeof makeQuery>> = {
    [COMPACT_HUD_MEDIA_QUERY]: makeQuery(COMPACT_HUD_MEDIA_QUERY, compact),
    [COMPACT_LANDSCAPE_MEDIA_QUERY]: makeQuery(COMPACT_LANDSCAPE_MEDIA_QUERY, landscape),
  };
  const matchMedia = vi.fn((media: string) => {
    expect(Object.keys(queries)).toContain(media);
    return queries[media];
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
  return {
    set: (next: { compact: boolean; landscape: boolean }) => {
      queries[COMPACT_HUD_MEDIA_QUERY].matches = next.compact;
      queries[COMPACT_LANDSCAPE_MEDIA_QUERY].matches = next.landscape;
      Object.values(queries).forEach((query) => query.listeners.forEach((listener) => listener()));
    },
    listenerCounts: () => Object.values(queries).map((query) => query.listeners.size),
  };
};

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
});

it("is null where matchMedia is unavailable", async () => {
  const { read, unmount } = await render();
  expect(read()).toBe("null");
  await unmount();
});

it("is null from Tailwind's lg breakpoint up", async () => {
  installMatchMedia({ compact: false, landscape: true });
  const { read, unmount } = await render();
  expect(read()).toBe("null");
  await unmount();
});

it("is portrait on a compact viewport held upright", async () => {
  installMatchMedia({ compact: true, landscape: false });
  const { read, unmount } = await render();
  expect(read()).toBe("portrait");
  await unmount();
});

it("is landscape on a compact viewport held sideways", async () => {
  installMatchMedia({ compact: true, landscape: true });
  const { read, unmount } = await render();
  expect(read()).toBe("landscape");
  await unmount();
});

it("follows a rotation live and unsubscribes from both queries on unmount", async () => {
  const media = installMatchMedia({ compact: true, landscape: false });
  const { read, unmount } = await render();
  expect(read()).toBe("portrait");
  expect(media.listenerCounts()).toEqual([1, 1]);
  await act(async () => media.set({ compact: true, landscape: true }));
  expect(read()).toBe("landscape");
  await unmount();
  expect(media.listenerCounts()).toEqual([0, 0]);
});
