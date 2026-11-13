// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab's game with an army out; only the network and the identity stand in. A game whose
// preset enables WithdrawLords holds LORDS in play; Season 1's preset leaves it and RefillStamina out.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");
const { nativeCommandBits } = await import("../../../../../../../contracts/l3/world-native/schema/commands.gen");

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

/** The HUD with the realm's army out; `withoutLords` takes WithdrawLords and RefillStamina out of the game's preset. */
const renderHud = async (withoutLords: boolean) => {
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
  const store = writes.mock.instances.at(-1) as unknown as InstanceType<typeof NativeFactStore>;
  writes.mockRestore();
  if (withoutLords) {
    const rules = store.require("SliceRules", { game_id: 1 });
    const lords = BigInt(nativeCommandBits.WithdrawLords) | BigInt(nativeCommandBits.RefillStamina);
    await act(async () =>
      store.applyFacts([
        {
          model: "SliceRules",
          key: "0x100",
          value: { ...rules, command_mask: String(BigInt(rules.command_mask) & ~lords) },
        },
      ] as never),
    );
  }
};

const lordsButton = () =>
  [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.startsWith("LORDS"));
const refillButton = () =>
  [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label")?.startsWith("Refill"));
const pickArmy = () =>
  act(async () => useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: "own" }));

it.each([true, false])(
  "draws the realm's LORDS and Withdraw only in a game with LORDS in play (desktop: %s)",
  async (desktop) => {
    layout(desktop);
    await renderHud(false);
    expect(lordsButton()).toBeDefined();

    await act(async () => root.unmount());
    root = createRoot(host);
    await renderHud(true);
    expect(lordsButton()).toBeUndefined();
  },
);

it("shows a phone's picked army its stamina as a reading, with no refill, in a game without LORDS in play", async () => {
  layout(false);
  await renderHud(false);
  await pickArmy();
  expect(refillButton()).toBeDefined();

  await act(async () => root.unmount());
  root = createRoot(host);
  await renderHud(true);
  await pickArmy();
  expect(refillButton()).toBeUndefined();
  expect(
    host.querySelector("[data-picked-army]")?.parentElement?.querySelector('[role="meter"][aria-label="Stamina"]'),
  ).not.toBeNull();
});
