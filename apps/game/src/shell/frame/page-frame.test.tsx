import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesFromChildren, MemoryRouter, Routes, type RouteObject } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { appRoutes, RETIRED_PLAY_PATHS } from "@/app";

import { PageFrame } from "./page-frame";
import { setViewportWidth } from "./test-viewport";

// Every service stays silent: the guard holds the frame, not the data, so each page shows its waiting state.
vi.hoisted(() => vi.stubGlobal("fetch", () => new Promise<Response>(() => {})));

const SIZES = [
  [390, 844],
  [360, 640],
  [1440, 900],
  [1920, 1080],
] as const;

/**
 * The pages without Back: the app's four places (the fifth, Market, is another site), and a result after a match (spec 08); every other page is opened from
 * another and carries Back.
 */
const TAB_PATHS = new Set(["/", "/season", "/scroll", "/profile", "/nothing-here", "/results/0x111"]);
/** Full-screen steps: no tabs, the desktop's top bar keeps the lockup alone (sign-in, a Blitz lobby). */
const STEP_PATHS = ["/sign-in", "/blitz/0x111"];
const CONTROLS = "a[href], button, input, select, textarea";

// jsdom lays nothing out, so it has no scrolling to do (the Scroll's address scrolls Play to its band).
Element.prototype.scrollIntoView = () => {};

/**
 * The app shell's pages (the route without a path), each with a sample for its parameters. Play's former addresses
 * only lead to Play (app-hosting.test.ts holds them), so they draw no page of their own.
 */
const shellPaths = (): string[] => {
  const shell = createRoutesFromChildren(appRoutes).find((route) => route.path === undefined) as RouteObject;
  const retired: readonly string[] = RETIRED_PLAY_PATHS;
  return (shell.children ?? [])
    .map((route) => (route.index ? "/" : `/${route.path}`.replace("*", "nothing-here").replace(/:\w+/, "0x111")))
    .filter((path) => !retired.includes(path));
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
    const isTabPage = TAB_PATHS.has(path);
    const isStep = STEP_PATHS.includes(path);

    // Every control on the page sits in one of the frame's bands.
    for (const control of controlsIn(container))
      expect(control.closest("[data-band]"), control.outerHTML).not.toBeNull();

    // Every page with the places ends on the footer; a full-screen step has neither.
    expect(band(container, "footer") !== null).toBe(!isStep);
    // Back leads every page opened from another, and only those.
    const back = container.querySelectorAll('[data-role="back"]');
    expect(back.length).toBe(isTabPage ? 0 : 1);

    if (layout === "phone") {
      // The top row holds the lockup, or Back and the title; nothing else there is to tap.
      expect(controlsIn(top).map((control) => control.dataset.role)).toEqual(isTabPage ? [] : ["back"]);
      // The tabs are the foot, below the notice and the foot row; a page's footer closes its body.
      if (band(container, "footer")) expect(band(container, "footer")!.closest('[data-band="body"]')).not.toBeNull();
      expect(bandOrder(container).filter((name) => name !== "body" && name !== "footer")).toEqual(
        ["top", "notice", "foot", "tabs"].filter((name) => band(container, name)),
      );
      expect(controlsIn(band(container, "tabs")).filter((control) => control.dataset.role === "tab")).toHaveLength(
        isStep ? 0 : 5,
      );
    } else {
      // One bar across the top: the lockup as a mark, then the five places and nothing else, above every other band;
      // Back sits in the title row under it.
      expect(top).toBeNull();
      const bar = band(container, "bar");
      expect(bandOrder(container)[0]).toBe("bar");
      expect(bar!.querySelector('[data-role="lockup"]')!.matches(CONTROLS)).toBe(false);
      const controls = controlsIn(bar);
      expect(controls.map((control) => control.dataset.role)).toEqual(
        isStep ? [] : ["tab", "tab", "tab", "tab", "tab"],
      );
      expect(band(container, "tabs")).toBeNull();
      if (!isTabPage) expect(back[0].closest('[data-band="title"]')).not.toBeNull();
    }
  });
});

describe("a page's notice", () => {
  const renderNotice = async (width: number) => {
    setViewportWidth(width);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.replaceChildren(container);
    root = createRoot(container);
    await act(async () =>
      root!.render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter initialEntries={["/"]}>
            <PageFrame notice={<p>Realms on your home screen</p>}>
              <p>Now</p>
            </PageFrame>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    return container;
  };

  it("sits in the desktop's top bar, before You, so the page's content starts right under the bar", async () => {
    const container = await renderNotice(1440);
    const notice = band(container, "notice")!;
    expect(notice.closest('[data-band="bar"]')).not.toBeNull();
    expect(notice.nextElementSibling!.textContent).toContain("You");
    expect(bandOrder(container).filter((name) => name !== "notice")).toEqual(["bar", "body", "footer"]);
  });

  it("sits above the phone's foot, under the content", async () => {
    const container = await renderNotice(390);
    expect(bandOrder(container)).toEqual(["top", "body", "footer", "notice", "tabs"]);
  });
});
