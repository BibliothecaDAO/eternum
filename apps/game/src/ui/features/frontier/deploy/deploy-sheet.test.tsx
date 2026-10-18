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
import { type GameClient, setBlockTimestampSource } from "@bibliothecadao/eternum";
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

const setSlider = (host: HTMLElement, value: number) => {
  const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, String(value));
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const deployButton = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Deploy"));

describe("the Deploy sheet", () => {
  it("opens at half of what the realm can field, with Minimum and Maximum on its ends, and deploys the dragged count", async () => {
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
    const slider = host.querySelector<HTMLInputElement>("input[type=range]")!;
    const most = Number(slider.max);
    expect(Number(slider.value)).toBe(Math.ceil(most / 2));
    // The ends are buttons that take their amount, and say which they are.
    const end = (name: string) => host.querySelector<HTMLButtonElement>(`button[aria-label^="${name}"]`)!;
    expect(end("Maximum").getAttribute("aria-label")).toBe(`Maximum ${most.toLocaleString("en-US")}`);
    act(() => end("Maximum").click());
    expect(Number(slider.value)).toBe(most);
    act(() => end("Minimum").click());
    expect(slider.value).toBe("1");
    expect(deployButton(host)?.textContent).toBe("Deploy");
    expect(host.querySelector('[aria-label="wheat to deploy −2"]')).not.toBeNull();

    setSlider(host, 120);
    expect(deployButton(host)?.textContent).toBe("Deploy");
    // Every figure names itself: what the deploy costs, what it leaves, and how far that carries the army.
    expect(host.querySelector('[aria-label="wheat to deploy −240"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="wheat left at home 760"]')).not.toBeNull();
    expect(host.querySelector('[aria-label^="tiles the wheat left pays for "]')).not.toBeNull();
    expect(host.querySelector('[aria-label^="stamina it starts with "]')).not.toBeNull();
    expect(host.querySelector('[aria-label="troops 120"]')).not.toBeNull();
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

  it("stops the slider where the wheat runs out, with a line on the track", () => {
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
    // 100 wheat deploys 50 troops: the thumb stops at the line however far it is dragged.
    expect(host.querySelector(".ui-slider__stop")).not.toBeNull();
    setSlider(host, 300);
    expect(deployButton(host)?.textContent).toBe("Deploy");
    expect(host.querySelector('[aria-label="wheat to deploy −100"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="wheat left at home 0"]')?.getAttribute("data-tone")).toBe("bad");
    // Maximum takes what the wheat allows, not what the troops would.
    expect(host.querySelector('button[aria-label^="Maximum"]')!.getAttribute("aria-label")).toBe("Maximum 50");
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
    const { host, root, draw } = render(store, row);
    const tiles = () => [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Deploy tile"] [role="radio"]')];
    expect(tiles()).toHaveLength(6);
    // The taken tile cannot be picked; the first open one is chosen until the player picks.
    expect(tiles()[0].disabled).toBe(true);
    expect(tiles()[1].getAttribute("aria-checked")).toBe("true");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Deploy west"]')!.click());
    await act(async () => deployButton(host)!.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ spawnDirection: Direction.WEST }));

    // An unexplored ring closes every tile, and there is no Deploy to send.
    ring.explored = false;
    draw();
    expect(tiles().every((tile) => tile.disabled)).toBe(true);
    expect(deployButton(host)).toBeUndefined();
    act(() => root.unmount());
    host.remove();
  });

  it("opens aimed at the tile an order on the map names, and takes a new aim while open", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const order = (direction: Direction) => openArmyDeployment({ structureId: 7, isExplorer: true, direction });
    const chosen = (host: HTMLElement) => host.querySelector('[role="radio"][aria-checked="true"]');
    order(Direction.WEST);
    const { host, root } = render(store, row);
    expect(chosen(host)?.getAttribute("aria-label")).toBe("Deploy west");

    act(() => order(Direction.EAST));
    expect(chosen(host)?.getAttribute("aria-label")).toBe("Deploy east");
    act(() => root.unmount());
    host.remove();
  });
});
