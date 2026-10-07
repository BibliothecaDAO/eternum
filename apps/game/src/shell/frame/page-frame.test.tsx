import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesFromChildren, MemoryRouter, Routes, type RouteObject } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appRoutes } from "@/app";

import { setViewportWidth } from "./test-viewport";

// Every service stays silent: the guard holds the frame, not the data, so each page shows its waiting state.
vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

const SIZES = [
  [390, 844],
  [360, 640],
  [1440, 900],
] as const;

/**
 * The pages without Back: the tab pages, and a result after a match (spec 08); every other page is opened from another
 * and carries Back.
 */
const TAB_PATHS = new Set(["/", "/season", "/learn", "/profile", "/nothing-here", "/results/0x111"]);
/** Profile's rows: pages with Back on a phone, the open panel beside Profile's rows on desktop. */
const PROFILE_PANELS = new Set(["/profile/account", "/profile/notifications", "/profile/devices"]);
/** Full-screen steps: no tabs, the desktop bar keeps the lockup alone (sign-in, a Blitz lobby). */
const STEP_PATHS = ["/sign-in", "/blitz/0x111"];
const CONTROLS = "a[href], button, input, select, textarea";

/** The app shell's pages (the route without a path), each with a sample for its parameters. */
const shellPaths = (): string[] => {
  const shell = createRoutesFromChildren(appRoutes).find((route) => route.path === undefined) as RouteObject;
  return (shell.children ?? []).map((route) =>
    route.index ? "/" : `/${route.path}`.replace("*", "nothing-here").replace(/:\w+/, "0x111"),
  );
};

let root: Root | null = null;
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

const renderPath = async (path: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>{appRoutes}</Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Lazy pages (reading matter) load their module before they draw.
  for (let tick = 0; tick < 20 && !container.querySelector("[data-band]"); tick += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  return container;
};

const band = (container: HTMLElement, name: string) => container.querySelector<HTMLElement>(`[data-band="${name}"]`);
const controlsIn = (element: Element | null) => (element ? [...element.querySelectorAll<HTMLElement>(CONTROLS)] : []);
const bandOrder = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[data-band]")].map((element) => element.dataset.band);

describe.each(SIZES)("every page at %i × %i keeps each control in its band", (width) => {
  const layout = width >= 1024 ? "desktop" : "phone";

  it.each([...new Set([...shellPaths(), ...STEP_PATHS])])("%s", async (path) => {
    setViewportWidth(width);
    const container = await renderPath(path);
    const top = band(container, "top");
    const isTabPage = TAB_PATHS.has(path) || (layout === "desktop" && PROFILE_PANELS.has(path));
    const isStep = STEP_PATHS.includes(path);

    // Every control on the page sits in one of the frame's bands.
    for (const control of controlsIn(container))
      expect(control.closest("[data-band]"), control.outerHTML).not.toBeNull();

    // Back leads every page opened from another, and only those.
    const back = container.querySelectorAll('[data-role="back"]');
    expect(back.length).toBe(isTabPage ? 0 : 1);

    if (layout === "phone") {
      // The top row holds the lockup, or Back and the title; nothing else there is to tap.
      expect(controlsIn(top).map((control) => control.dataset.role)).toEqual(isTabPage ? [] : ["back"]);
      // The tabs are the foot, below the notice and the foot row.
      expect(bandOrder(container).filter((name) => name !== "body")).toEqual(
        ["top", "notice", "foot", "tabs"].filter((name) => band(container, name)),
      );
      expect(controlsIn(band(container, "tabs")).filter((control) => control.dataset.role === "tab")).toHaveLength(
        isStep ? 0 : 4,
      );
    } else {
      // One top bar: the lockup, Play · Season · Learn and the player; Back sits in the title row under it.
      const [lockup, ...rest] = controlsIn(top);
      const tabs = rest.filter((control) => control.dataset.role === "tab");
      expect(lockup.dataset.role).toBe("lockup");
      expect(tabs).toHaveLength(isStep ? 0 : 3);
      for (const control of rest.filter((other) => !tabs.includes(other)))
        expect(control.closest('[data-role="player"]'), control.outerHTML).not.toBeNull();
      expect(band(container, "tabs")).toBeNull();
      if (!isTabPage) expect(back[0].closest('[data-band="title"]')).not.toBeNull();
    }
  });
});
