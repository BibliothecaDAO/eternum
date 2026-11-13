// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab game with an army out; only network and identity stand in.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");

const ARMY = 90;
let host: HTMLDivElement;
let root: Root;

const layout = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  window.history.replaceState({}, "", "/g/0x1ab/1/map");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  useUIStore.getState().selectOnMap(null);
  window.history.replaceState({}, "", "/");
  await act(async () => root.unmount());
  host.remove();
});

/** The real HUD, including any historical LORDS rows retained by its fixture. */
const renderHud = async () => {
  const writes = vi.spyOn(NativeFactStore.prototype, "applyFacts");
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/unified/frontier-army"]}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="unified/:view?" element={<UnifiedHudLab />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  writes.mockRestore();
};

const lordsButton = () =>
  [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.startsWith("LORDS"));
const refillButton = () =>
  [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.startsWith("Refill"));
const pickArmy = () =>
  act(async () => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));

it.each([true, false])("keeps LORDS and withdrawal controls out of the game HUD (desktop: %s)", async (desktop) => {
  layout(desktop);
  await renderHud();
  expect(host.querySelector("button")).not.toBeNull();
  expect(lordsButton()).toBeUndefined();
});

it("shows a phone's picked army its stamina as a reading, with no refill, in a game without LORDS in play", async () => {
  layout(false);
  await renderHud();
  await pickArmy();
  expect(refillButton()).toBeUndefined();
  expect(
    host.querySelector("[data-picked-army]")?.parentElement?.querySelector('[role="meter"][aria-label="Stamina"]'),
  ).not.toBeNull();
});
