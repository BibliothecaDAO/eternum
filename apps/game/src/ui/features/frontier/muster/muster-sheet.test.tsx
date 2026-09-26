import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The home ring as the map knows it: explored and empty (one tile maybe taken), or not yet synced.
const ring = { explored: true, taken: -1 };
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: { col: number; row: number }[]) =>
    ring.explored ? hexes.map((hexCoords, index) => ({ hexCoords, occupierId: index === ring.taken ? 5 : 0 })) : [],
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { type GameClient, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { Direction, TroopTier, TroopType } from "@bibliothecadao/types";
import { frontierDay } from "./muster-fixture";
import { MusterSheet } from "./muster-sheet";

afterEach(() => {
  ring.explored = true;
  ring.taken = -1;
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("the muster sheet", () => {
  it("starts at the most the realm can field, musters the dragged count and closes", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const createExplorerArmy = vi.fn(() => Promise.resolve());
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
    } as unknown as GameClient);
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <MusterSheet realm={row} onClose={onClose} />
        </GameProvider>,
      ),
    );
    const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
    expect(slider.value).toBe(slider.max);
    expect(host.querySelector('[aria-label^="Knight T1"] .frontier-tier')?.textContent).toBe("I");
    expect(host.querySelector('[aria-label="1 of 3 armies today"]')).not.toBeNull();

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "120");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const muster = [...host.querySelectorAll("button")].find((button) => button.textContent === "Deploy")!;
    await act(async () => muster.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(
      expect.objectContaining({
        structureId: 7,
        troopType: TroopType.Knight,
        troopTier: TroopTier.T1,
        troopCount: 120,
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    host.remove();
  });

  it("cannot muster while the realm's ring is unknown", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    ring.explored = false;
    const { store, row } = frontierDay();
    const host = document.createElement("div");
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <MusterSheet realm={row} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    const muster = [...host.querySelectorAll("button")].find((button) => button.textContent === "Deploy")!;
    expect(muster.disabled).toBe(true);
    act(() => root.unmount());
  });

  it("deploys onto the tile the player picks, with taken and unexplored tiles closed", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    ring.taken = 0;
    const { store, row } = frontierDay();
    const createExplorerArmy = vi.fn(() => Promise.resolve());
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
    } as unknown as GameClient);
    const host = document.createElement("div");
    const root = createRoot(host);
    const render = () =>
      act(() =>
        root.render(
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            <MusterSheet realm={row} onClose={() => {}} />
          </GameProvider>,
        ),
      );
    render();
    const tiles = () => [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(tiles()).toHaveLength(6);
    // The taken tile cannot be picked; the first open one is chosen until the player picks.
    expect(tiles()[0].disabled).toBe(true);
    expect(tiles()[1].getAttribute("aria-checked")).toBe("true");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Deploy west"]')!.click());
    expect(host.querySelector('button[aria-label="Deploy west"]')?.getAttribute("aria-checked")).toBe("true");
    const deploy = [...host.querySelectorAll("button")].find((button) => button.textContent === "Deploy")!;
    await act(async () => deploy.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ spawnDirection: Direction.WEST }));

    // An unexplored ring closes every tile.
    ring.explored = false;
    render();
    expect(tiles().every((tile) => tile.disabled)).toBe(true);
    act(() => root.unmount());
  });
});
