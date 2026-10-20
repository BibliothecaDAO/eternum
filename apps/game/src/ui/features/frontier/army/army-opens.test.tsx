// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab's game with an army out (the lab's frontier-army view); only the network and the
// identity stand in.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const active = await import("@/sync/active-game-client");
const { overrideSpectateIntent } = await import("@/utils/spectator-session");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");

/** The lab realm's army out. */
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
  layout(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  // The player is on the map, where a pick in the dock selects the army in place.
  window.history.replaceState({}, "", "/g/0x1ab/1/map");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  overrideSpectateIntent(false);
  useUIStore.setState({ isSpectating: false });
  useUIStore.getState().selectOnMap(null);
  window.history.replaceState({}, "", "/");
  await act(async () => root.unmount());
  host.remove();
});

/** The HUD drawn, and the lab game's store, caught as the lab writes its army into it. */
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
  const store = writes.mock.instances.at(-1)!;
  writes.mockRestore();
  return store;
};

const panel = () => host.querySelector("[data-kit-sheet] [data-army-step='stats']");
/** The map selects the army as a click on it does; null lets go of it. */
const select = (entityId: number | null) =>
  act(async () =>
    useUIStore.getState().selectOnMap(entityId === null ? null : { kind: "army", entityId, tile: "own" }),
  );
const closePanel = () =>
  act(async () => host.querySelector<HTMLButtonElement>("[data-kit-sheet] button[aria-label='Close']")!.click());
/** The army's row on a desktop, its token on a phone. */
const pickInDock = () =>
  act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((each) => each.getAttribute("aria-label") === "Army 1")!
      .click(),
  );

describe.each([
  ["desktop", true],
  ["phone", false],
])("the army's panel on a %s", (_, desktop) => {
  beforeEach(() => layout(desktop));

  it("opens when the map selects the army, with its readings and no army bar under it", async () => {
    await renderHud();
    expect(panel()).toBeNull();

    await select(ARMY);
    expect(panel()!.textContent).toContain("Full in");
    expect(host.querySelector('button[aria-label="Army"]')).toBeNull();

    // Closed, the army stays selected, so the next tap on the map orders it.
    await closePanel();
    expect(panel()).toBeNull();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  });

  it("opens once for a pick of an army in the dock, and reopens for a pick of the army already selected", async () => {
    await renderHud();
    // Each opening lets go of the tapped tile once: one arbitration, not one per path.
    const opens = vi.spyOn(useUIStore.getState(), "closeSelectedTile");
    await pickInDock();
    expect(panel()).not.toBeNull();
    expect(opens).toHaveBeenCalledOnce();

    await closePanel();
    opens.mockClear();
    await pickInDock();
    expect(panel()).not.toBeNull();
    expect(opens).toHaveBeenCalledOnce();
    opens.mockRestore();
  });

  it("stays closed through the army's own facts changing and the same army selected again", async () => {
    const store = await renderHud();
    await select(ARMY);
    await closePanel();

    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY });
    const tired = { Inline: { amount: "70", settled_at: "350000", remainder: "0" } };
    await act(async () =>
      store.applyFacts([
        { model: "ExplorerTroops", key: "0x9a0", value: { ...army, troops: { ...army.troops, stamina: tired } } },
      ] as never),
    );
    await select(ARMY);
    expect(panel()).toBeNull();

    // Let go and selected afresh, it opens.
    await select(null);
    await select(ARMY);
    expect(panel()).not.toBeNull();
  });

  it("stays closed through a visit started and left with the army still selected", async () => {
    const store = await renderHud();
    await select(ARMY);
    await closePanel();

    active.installActiveGameClient({
      setup: { store },
      connect: () => {},
      disconnect: () => {},
      visit: () => {},
      dispose: () => {},
    } as never);
    try {
      await act(async () => active.startRealmVisit({ player: "0x222", structureId: 999, opensOn: "realm" } as never));
      await act(async () => active.leaveRealmVisit());
      expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
      expect(panel()).toBeNull();
    } finally {
      active.disposeGameSyncSession();
    }
  });

  it("never opens for a signed-in owner who entered the game to spectate it", async () => {
    await renderHud();
    window.history.replaceState({}, "", "/g/0x1ab/1/map?spectate=true");
    overrideSpectateIntent(true);
    await act(async () => useUIStore.setState({ isSpectating: true }));
    await select(ARMY);
    expect(panel()).toBeNull();
  });
});
