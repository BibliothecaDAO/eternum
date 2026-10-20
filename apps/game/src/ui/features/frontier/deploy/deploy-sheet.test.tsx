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
  useNowSeconds: () => 350,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { toast } from "@/ui/features/event-feed/notify";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { type GameClient, setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { Direction, TroopTier, TroopType } from "@bibliothecadao/types";
import { frontierDay } from "./deploy-fixture";
import { DeploySheet } from "./deploy-sheet";

afterEach(() => {
  useUIStore.getState().setPendingMilitaryAction(null);
  ring.explored = true;
  ring.taken = -1;
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

const render = (store: unknown, row: unknown, onClose = () => {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const draw = () =>
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <DeploySheet realm={row as never} onClose={onClose} />
        </GameProvider>,
      ),
    );
  draw();
  return { host, root, draw };
};

const countField = (host: HTMLElement) => host.querySelector<HTMLInputElement>(".ui-amount input")!;
const typeCount = (host: HTMLElement, value: number) => {
  const field = countField(host);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, String(value));
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const press = (host: HTMLElement, word: string) =>
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
const outOf = (host: HTMLElement) => host.querySelector(".ui-amount__of")?.textContent;
const foot = (host: HTMLElement) => host.querySelector(".ui-window__foot")?.textContent ?? "";

/** The ring's tiles on the map selector, in spawnRing's order, and the one the sheet aims at. */
const tiles = (host: HTMLElement) => [...host.querySelectorAll('[aria-label="Deploy tile"] [role="radio"]')];
const tileToward = (host: HTMLElement, store: unknown, row: unknown, direction: Direction) =>
  tiles(host)[spawnRing(store as never, row as never, () => 0).findIndex((tile) => tile.direction === direction)];
const click = (element: Element) => act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true })));

const deployButton = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Deploy"));

describe("the Deploy sheet", () => {
  it("opens at half of what the realm can field, with +500, Max and a slider for the count, and deploys the count typed", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const createExplorerArmy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
      waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
    } as unknown as GameClient);
    const onClose = vi.fn();
    const { host, root } = render(store, row, onClose);
    // 420 knights at home and 1,000 wheat at 2 a troop: all 420 can go.
    expect(outOf(host)).toBe("of 420");
    expect(countField(host).value).toBe("210");
    press(host, "Max");
    expect(countField(host).value).toBe("420");
    typeCount(host, 120);
    // Deploy in the foot, beside its price and how far the wheat left lets the army march.
    expect(deployButton(host)?.textContent).toBe("Deploy");
    expect(foot(host)).toMatch(/^240 wheatLeaves wheat to march [\d.,]+K? tiles?Deploy$/);
    // The window shows the decision only: the count's slider over the same range, no stamina, attribute marks or day
    // clock.
    const slider = host.querySelector<HTMLInputElement>("input[type=range]");
    expect([slider?.getAttribute("aria-label"), slider?.max, slider?.value]).toEqual([
      "troops: how many go",
      "420",
      "120",
    ]);
    expect(host.textContent).not.toMatch(/stamina|Day ends/i);
    await act(async () => deployButton(host)!.click());
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

  it("deploys once for two presses, closes as the army leaves and holds the deploy in flight until its own outcome", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    let settle: (outcome: unknown) => void = () => {};
    const createExplorerArmy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
      waitForAction: () => new Promise((resolve) => (settle = resolve)),
    } as unknown as GameClient);
    const refused = vi.spyOn(toast, "error").mockImplementation(() => "");
    const onClose = vi.fn();
    const { host, root } = render(store, row, onClose);
    await act(async () => {
      deployButton(host)!.click();
      deployButton(host)!.click();
    });
    expect(createExplorerArmy).toHaveBeenCalledTimes(1);
    // The sheet closed as the command left; the wait is the dock slot's from here.
    expect(onClose).toHaveBeenCalledOnce();
    expect(inFlight("deploy", 7)).toBe(true);
    // Opened again before the outcome, it cannot send a second army.
    expect([...host.querySelectorAll("button")].find((button) => button.textContent === "Deploying…")?.disabled).toBe(
      true,
    );
    await act(async () => settle({ hash: "0x1", block: 9, status: "REJECTED", revertReason: "No open army slot" }));
    expect(refused.mock.lastCall?.[0]).toBe("No open army slot");
    expect(inFlight("deploy", 7)).toBeUndefined();
    expect(deployButton(host)?.disabled).toBe(false);
    act(() => root.unmount());
    host.remove();
  });

  it("caps the count where the wheat runs out, and says the army is left no wheat to march", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0xc",
        value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(100n * 1_000_000_000n) },
      },
    ] as never);
    const { host, root } = render(store, row);
    // 100 wheat deploys 50 of the 420 troops: Max takes what the wheat allows, and the count reads out of 50, not
    // "that fit", since the castle has room.
    expect(outOf(host)).toBe("of 50");
    typeCount(host, 300);
    expect(countField(host).value).toBe("50");
    expect(foot(host)).toBe("100 wheatLeaves no wheat to marchDeploy");
    act(() => root.unmount());
    host.remove();
  });

  it("with no troops at home, takes away Deploy and offers Build", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      { model: "ResourceBalance", key: "0x8", value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" } },
    ] as never);
    const { host, root } = render(store, row);
    expect(deployButton(host)).toBeUndefined();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Build")).toBe(true);
    act(() => root.unmount());
    host.remove();
  });

  it("deploys onto the tile the player picks on the map selector, with taken and unexplored tiles closed", async () => {
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
    const { host, root, draw } = render(store, row);
    expect(tiles(host)).toHaveLength(6);
    // The taken tile cannot be picked; the first open one is chosen until the player picks.
    expect(tiles(host)[0].getAttribute("aria-disabled")).toBe("true");
    expect(tiles(host)[1].getAttribute("aria-checked")).toBe("true");
    click(tileToward(host, store, row, Direction.WEST));
    expect(tileToward(host, store, row, Direction.WEST).getAttribute("aria-checked")).toBe("true");
    await act(async () => deployButton(host)!.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ spawnDirection: Direction.WEST }));

    // An unexplored ring leaves no tile to pick, and there is no Deploy to send.
    ring.explored = false;
    draw();
    expect(tiles(host)).toHaveLength(0);
    expect(host.textContent).toContain("No adjacent tiles");
    expect(deployButton(host)).toBeUndefined();
    act(() => root.unmount());
    host.remove();
  });

  it("opens aimed at the tile an order on the map names, and takes a new aim while open", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const order = (direction: Direction) => openArmyDeployment({ structureId: 7, isExplorer: true, direction });
    order(Direction.WEST);
    const { host, root } = render(store, row);
    expect(tileToward(host, store, row, Direction.WEST).getAttribute("aria-checked")).toBe("true");

    act(() => order(Direction.EAST));
    expect(tileToward(host, store, row, Direction.EAST).getAttribute("aria-checked")).toBe("true");
    act(() => root.unmount());
    host.remove();
  });
});
