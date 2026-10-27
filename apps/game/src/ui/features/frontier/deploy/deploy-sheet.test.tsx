import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// The home ring as the map knows it: explored and empty (one tile maybe taken), or not yet synced.
const ring = { explored: true, taken: -1 };
vi.mock("@/hooks/use-world-spatial-tiles", () => ({
  useWorldSpatialTiles: (hexes: { col: number; row: number }[]) =>
    ring.explored ? hexes.map((hexCoords, index) => ({ hexCoords, occupierId: index === ring.taken ? 5 : 0 })) : [],
}));
// Where the sheet opens: the world map, or another view (the Realm board), and the way to the map it takes from there.
const place = vi.hoisted(() => ({ map: true, goTo: [] as boolean[] }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: place.map }) }));
vi.mock("../frontier-home", async (original) => ({
  ...(await original<typeof import("../frontier-home")>()),
  useGoToFrontierPlace: () => (expedition: boolean) => place.goTo.push(expedition),
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
import { DEPLOY_ON_MAP_EVENT, type DeployOnMap, readDeployOnMap } from "@/three/scenes/worldmap-deploy-request";
import { type GameClient, setBlockTimestampSource, spawnRing } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { Direction, TroopTier, TroopType } from "@bibliothecadao/types";
import { frontierDay } from "./deploy-fixture";
import { DeploySheet } from "./deploy-sheet";

afterEach(() => {
  place.map = true;
  place.goTo.length = 0;
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

/** The stamina the sheet shows the new army starting on: the number beside its bar, and the bar's reading. */
const startReading = (host: HTMLElement) => {
  const meter = host.querySelector<HTMLElement>('[role="meter"][aria-label="stamina"]');
  return {
    number: meter?.parentElement?.parentElement?.textContent ?? null,
    meter: meter && [Number(meter.getAttribute("aria-valuenow")), Number(meter.getAttribute("aria-valuemax"))],
  };
};

const foot = (host: HTMLElement) => host.querySelector(".ui-window__foot")?.textContent ?? "";

/** What the sheet asks the map to show, in the order asked: its realm and tile while open, null once closed. */
const shownOnMap = () => {
  const asked: DeployOnMap[] = [];
  const hear = (event: Event) => asked.push(readDeployOnMap(event));
  window.addEventListener(DEPLOY_ON_MAP_EVENT, hear);
  return { asked, stop: () => window.removeEventListener(DEPLOY_ON_MAP_EVENT, hear) };
};
/** The direction of the realm's ring tile at this place in spawnRing's order. */
const ringDirection = (store: unknown, row: unknown, index: number) =>
  spawnRing(store as never, row as never, () => 0)[index].direction;

const deployButton = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Deploy"));

describe("the Deploy sheet", () => {
  it("shows every slot, requires a choice, and sends the higher fresh slot instead of the tired lower slot", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "ArmySlot",
        key: "0x91",
        value: {
          game_id: 1,
          structure_id: 7,
          epoch: "0",
          slot: 1,
          explorer_id: 0,
          stamina: { amount: "7", settled_at: "3", remainder: 0 },
        },
      },
    ] as never);
    const createExplorerArmy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
      waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
    } as unknown as GameClient);
    const { host, root } = render(store, row);
    try {
      const slots = [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Army slots"] button')];
      expect(slots).toHaveLength(3);
      expect(slots[0].disabled).toBe(true);
      expect(slots[1].textContent).toContain("7/150 stamina");
      expect(slots[2].textContent).toContain("150/150 stamina");
      expect(deployButton(host)).toBeUndefined();
      act(() => slots[0].click());
      expect(deployButton(host)).toBeUndefined();
      act(() => slots[2].click());
      expect(slots[2].getAttribute("aria-pressed")).toBe("true");
      await act(async () => deployButton(host)!.click());
      expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ slot: 2 }));
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("stops offering Deploy when the chosen slot becomes occupied without selecting another slot", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const { host, root } = render(store, row);
    try {
      click(host.querySelector('button[aria-label="Army 3"]')!);
      expect(deployButton(host)).toBeDefined();
      act(() =>
        store.applyFacts([
          {
            model: "ArmySlot",
            key: "0x92",
            value: {
              game_id: 1,
              structure_id: 7,
              epoch: "0",
              slot: 2,
              explorer_id: 99,
              stamina: { amount: "150", settled_at: "3", remainder: 0 },
            },
          },
        ] as never),
      );
      expect(deployButton(host)).toBeUndefined();
      expect(host.querySelector('[aria-label="Army slots"] [aria-pressed="true"]')).toBeNull();
      expect((host.querySelector('button[aria-label="Army 2"]') as HTMLButtonElement).disabled).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("opens at no troops, with Max and a slider for the count, and deploys the count typed", async () => {
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
    click(host.querySelector('button[aria-label="Army 2"]')!);
    // 420 knights at home and 1,000 wheat at 2 a troop: all 420 can go.
    expect(outOf(host)).toBe("of 420");
    // No troops yet, so nothing to deploy; with 420 at most, +500 would only be Max.
    expect(countField(host).value).toBe("0");
    expect(deployButton(host)?.disabled).toBe(true);
    press(host, "Max");
    expect(countField(host).value).toBe("420");
    typeCount(host, 120);
    // Deploy in the foot beside its price, and nothing else.
    expect(deployButton(host)?.textContent).toBe("Deploy");
    expect(foot(host)).toBe("240 wheatDeploy");
    // The window shows the decision only: the count's slider over the same range, no stamina, attribute marks or day
    // clock.
    const slider = host.querySelector<HTMLInputElement>("input[type=range]");
    expect([slider?.getAttribute("aria-label"), slider?.max, slider?.value]).toEqual([
      "troops: how many go",
      "420",
      "120",
    ]);
    // The day's clock is the top bar's; the stamina the army starts on is the sheet's bar and its number, with no line
    // explaining either (the owner: "good UI/UX doesnt need subtext").
    expect(host.textContent).not.toMatch(/Day ends/i);
    expect(startReading(host)).toEqual({ number: "150/150", meter: [150, 150] });
    expect(host.textContent).not.toMatch(/starts|its slot|Leaves|Steps out/);
    await act(async () => deployButton(host)!.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(
      expect.objectContaining({
        structureId: 7,
        troopType: TroopType.Knight,
        troopTier: TroopTier.T1,
        troopCount: 120,
        slot: 1,
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
    press(host, "Max");
    click(host.querySelector('button[aria-label="Army 2"]')!);
    await act(async () => {
      deployButton(host)!.click();
      deployButton(host)!.click();
    });
    expect(createExplorerArmy).toHaveBeenCalledTimes(1);
    // The sheet closed as the command left; the wait is the dock slot's from here.
    expect(onClose).toHaveBeenCalledOnce();
    expect(inFlight("deploy", 7)).toBe(1);
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

  it("caps the count where the wheat runs out", () => {
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
    click(host.querySelector('button[aria-label="Army 2"]')!);
    // 100 wheat deploys 50 of the 420 troops: Max takes what the wheat allows, and the count reads out of 50, not
    // "that fit", since the castle has room.
    expect(outOf(host)).toBe("of 50");
    typeCount(host, 300);
    expect(countField(host).value).toBe("50");
    expect(foot(host)).toBe("100 wheatDeploy");
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    {
      case: "a slot fresh today starts its army full",
      facts: [],
      number: "150/150",
      meter: [150, 150],
    },
    {
      case: "a slot whose army was released starts the new one on the bar it left",
      facts: [
        {
          model: "ArmySlot",
          key: "0x91",
          value: {
            game_id: 1,
            structure_id: 7,
            epoch: "0",
            slot: 1,
            explorer_id: 0,
            // Left this second, as the sheet reads it: nothing has recovered yet.
            stamina: { amount: "7", settled_at: "3", remainder: 0 },
          },
        },
      ],
      number: "7/150",
      meter: [7, 150],
    },
    {
      case: "a realm's trained Logistics (an uncommon Supply yard) raises the full bar of a fresh slot",
      facts: [
        {
          model: "RealmKnowledge",
          key: "0xd",
          value: { game_id: 1, structure_id: 7, learned: String(1n << 27n) },
        },
      ],
      number: "170/170",
      meter: [170, 170],
    },
  ])("shows the stamina bar the new army starts on, its slot's: $case", ({ facts, number, meter }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts(facts as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    // Slot 1 holds an army; the player chose Army 2.
    expect(startReading(host)).toEqual({ number, meter });
    act(() => root.unmount());
    host.remove();
  });

  it("brings the map up once as it opens off it (the Realm board's dock), where the tile is picked; not on the map", () => {
    const { store, row } = frontierDay();
    place.map = false;
    const offMap = render(store, row);
    offMap.draw();
    expect(place.goTo).toEqual([true]);
    act(() => offMap.root.unmount());

    place.map = true;
    place.goTo.length = 0;
    const onMap = render(store, row);
    onMap.draw();
    expect(place.goTo).toEqual([]);
    act(() => onMap.root.unmount());
  });

  it("with no troops at home, takes away Deploy and offers Build", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      { model: "ResourceBalance", key: "0x8", value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" } },
    ] as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(deployButton(host)).toBeUndefined();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Build")).toBe(true);
    act(() => root.unmount());
    host.remove();
  });

  it("draws no map or tile line of its own: it shows its order on the map, the first open tile until one is picked there", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    ring.taken = 0;
    const { store, row } = frontierDay();
    const createExplorerArmy = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { createExplorerArmy },
      waitForAction: () => Promise.resolve({ hash: "0x1", block: 9, status: "SUCCEEDED" }),
    } as unknown as GameClient);
    const map = shownOnMap();
    const { host, root, draw } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(host.querySelector('[aria-label="Deploy tile"]')).toBeNull();
    expect(host.textContent).not.toMatch(/tile/i);
    // The taken tile is passed over: the map marks the first open one.
    expect(map.asked.at(-1)).toEqual({ structureId: 7, direction: ringDirection(store, row, 1) });
    // A tap on another lit tile orders again (openArmyDeployment), and the map marks that one.
    act(() => openArmyDeployment({ structureId: 7, isExplorer: true, direction: Direction.WEST }));
    expect(map.asked.at(-1)).toEqual({ structureId: 7, direction: Direction.WEST });
    press(host, "Max");
    await act(async () => deployButton(host)!.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ spawnDirection: Direction.WEST }));

    // An unexplored ring leaves no tile to step out on, and there is no Deploy to send.
    ring.explored = false;
    draw();
    expect(host.textContent).toContain("No open tile beside the realm");
    expect(deployButton(host)).toBeUndefined();
    act(() => root.unmount());
    // Closed, the sheet takes its order off the map.
    expect(map.asked.at(-1)).toBeNull();
    map.stop();
    host.remove();
  });

  it("opens aimed at the tile an order on the map names (a hold beside the realm), and takes a new aim while open", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const order = (direction: Direction) => openArmyDeployment({ structureId: 7, isExplorer: true, direction });
    const map = shownOnMap();
    order(Direction.WEST);
    const { host, root } = render(store, row);
    expect(map.asked.at(-1)).toEqual({ structureId: 7, direction: Direction.WEST });
    click(host.querySelector('button[aria-label="Army 2"]')!);
    act(() => order(Direction.EAST));
    expect(map.asked.at(-1)).toEqual({ structureId: 7, direction: Direction.EAST });
    act(() => root.unmount());
    map.stop();
    host.remove();
  });
});
