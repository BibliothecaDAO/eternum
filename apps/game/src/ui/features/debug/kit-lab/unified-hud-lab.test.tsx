// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The lab draws the game's own HUD on the lab's game; only the network and the identity stand in.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const { DEFAULT_BUILD_ORDER } = await import("@bibliothecadao/eternum/automation");
const { UnifiedHudLab } = await import("./unified-hud-lab");
const { usePopoverStore } = await import("@/hooks/store/use-popover-store");

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  usePopoverStore.getState().close();
});

/** The lab at a view, with a link to the plain Blitz view as a player leaves for it. */
const labAt = (view: string) => (
  <MemoryRouter initialEntries={[`/unified/${view}`]}>
    <QueryClientProvider client={new QueryClient()}>
      <Link to="/unified/blitz">Blitz</Link>
      <Routes>
        <Route path="unified/:view?" element={<UnifiedHudLab />} />
      </Routes>
    </QueryClientProvider>
  </MemoryRouter>
);
const forecast = () => document.querySelector('[data-popover-panel="quick-attack"]');

it("draws the game's own Build order panel in a Blitz player's rail, its order named at its head", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/unified/blitz"]}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="unified/:view?" element={<UnifiedHudLab />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const panel = host.querySelector('section[aria-label="Build order"]');
  expect(panel).not.toBeNull();
  expect(panel!.querySelector("header")?.textContent).toContain(DEFAULT_BUILD_ORDER.name);
  expect(panel!.textContent).not.toContain("djizus");
});

describe("the Blitz attack lab's forecast", () => {
  it("opens over the HUD and goes from the shared surfaces when the lab leaves for another view", async () => {
    await act(async () => root.render(labAt("blitz-attack")));
    expect(forecast()).not.toBeNull();
    expect(usePopoverStore.getState().openId).toBe("quick-attack");

    await act(async () => host.querySelector<HTMLAnchorElement>('a[href="/unified/blitz"]')!.click());
    expect(forecast()).toBeNull();
    expect(usePopoverStore.getState()).toMatchObject({ openId: null, surface: null });
  });

  it("leaves a surface opened after it, even one of the same kind, when the lab goes", async () => {
    await act(async () => root.render(labAt("blitz-attack")));
    const later = { id: "quick-attack", content: "a later forecast" };
    act(() => usePopoverStore.getState().openSurface(later));

    await act(async () => root.unmount());
    expect(usePopoverStore.getState().surface).toMatchObject(later);
    root = createRoot(host);
  });
});
