import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { COMPACT_HUD_MEDIA_QUERY, useCompactHud } from "./use-compact-hud";

const Probe = () => <output>{String(useCompactHud())}</output>;

const render = async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  return { read: () => container.querySelector("output")?.textContent, unmount: () => act(async () => root.unmount()) };
};

const installMatchMedia = (matches: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    media: COMPACT_HUD_MEDIA_QUERY,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn((media: string) => {
    expect(media).toBe(COMPACT_HUD_MEDIA_QUERY);
    return query;
  });
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
  return {
    setMatches: (next: boolean) => {
      query.matches = next;
      listeners.forEach((listener) => listener());
    },
    listeners,
  };
};

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
});

it("is false where matchMedia is unavailable", async () => {
  const { read, unmount } = await render();
  expect(read()).toBe("false");
  await unmount();
});

it("tracks the compact media query and unsubscribes on unmount", async () => {
  const media = installMatchMedia(true);
  const { read, unmount } = await render();
  expect(read()).toBe("true");
  await act(async () => media.setMatches(false));
  expect(read()).toBe("false");
  await unmount();
  expect(media.listeners.size).toBe(0);
});
