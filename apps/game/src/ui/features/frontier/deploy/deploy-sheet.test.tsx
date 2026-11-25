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
// The screen the sheet is drawn on: a desktop's rows for the slots, a phone's tokens.
const layout = vi.hoisted(() => ({ current: "desktop" as "desktop" | "phone" }));
vi.mock("@/hooks/helpers/use-compact-hud", async (original) => ({
  ...(await original<typeof import("@/hooks/helpers/use-compact-hud")>()),
  useHudLayout: () => layout.current,
}));
// The production clock the sheet reads; a test moves it to watch a store fill.
const clock = vi.hoisted(() => ({ tick: 3 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => clock.tick,
  useCurrentArmiesTick: () => 3,
  useNowSeconds: () => 350,
}));

import { wire } from "@/lab/game/lab-chain";
import { GameProvider } from "@/hooks/context/game-context";
import { inFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { toast } from "@/ui/features/event-feed/notify";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { DEPLOY_ON_MAP_EVENT, type DeployOnMap, readDeployOnMap } from "@/three/scenes/worldmap-deploy-request";
import {
  type GameClient,
  getTroopResourceId,
  readExpeditionRules,
  setBlockTimestampSource,
  spawnRing,
} from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { Direction, RESOURCE_PRECISION, TROOP_TYPES, TroopTier, TroopType } from "@bibliothecadao/types";
import { frontierDay } from "./deploy-fixture";
import { DeploySheet } from "./deploy-sheet";
import { DEPLOY_WORDS, NO_OPEN_TILE, NO_TROOPS_AT_HOME, wheatForOnly } from "../../../design-system/kit/words";

afterEach(() => {
  layout.current = "desktop";
  clock.tick = 3;
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
          <DeploySheet realm={row as never} rules={readExpeditionRules(store as never, 1)!} onClose={onClose} />
        </GameProvider>,
      ),
    );
  draw();
  return { host, root, draw };
};

const slider = (host: HTMLElement) => host.querySelector<HTMLInputElement>(".size-row input[type=range]")!;
const field = (host: HTMLElement) => host.querySelector<HTMLInputElement>(".size-row .ui-field input")!;
const setInput = (input: HTMLInputElement, value: number) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
const typeCount = (host: HTMLElement, value: number) => setInput(field(host), value);
const dragCount = (host: HTMLElement, value: number) => setInput(slider(host), value);
const press = (host: HTMLElement, word: string) =>
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === word)!.click());
const count = (host: HTMLElement) => field(host).value;

/** The open slots the sheet offers, as the Armies card draws them: each one's name, and whether it is the one chosen. */
const slotsOffered = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>('[aria-label="Army slots"] button[aria-label]')].map((slot) => [
    slot.getAttribute("aria-label"),
    slot.getAttribute("aria-pressed"),
  ]);
const slotButton = (host: HTMLElement, name: string) =>
  host.querySelector<HTMLButtonElement>(`[aria-label="Army slots"] button[aria-label="${name}"]`)!;

const startReading = (host: HTMLElement) =>
  host.querySelector('[data-deploy-start] [role="meter"]')?.getAttribute("aria-valuenow") ?? null;

const foot = (host: HTMLElement) => host.querySelector(".ui-window__foot")?.textContent ?? "";
/** The red line the wheat draws when it holds the count down: its words, its mark and its one press. */
const wheatLine = (host: HTMLElement) => {
  const quiet = host.querySelector('.deploy-size > .ui-line:has([data-icon="wheat"])');
  if (quiet) return { line: quiet.textContent };
  const notice = host.querySelector('.ui-notice[data-tone="bad"]:has([data-icon="wheat"])');
  return notice
    ? {
        line: notice.querySelector(":scope > span:not(.ui-notice__fix)")!.textContent,
        press: notice.querySelector(".ui-notice__fix button")?.textContent,
      }
    : null;
};

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

/** The realm's knights spent: none at home. */
const noTroops = {
  model: "ResourceBalance",
  key: "0x8",
  value: { game_id: 1, entity_id: 7, resource_type: 26, balance: "0" },
};

const deployButton = (host: HTMLElement) =>
  [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Deploy"));

describe("the Deploy sheet", () => {
  it("offers the open slots as the Armies card does, the first chosen when none was named, and sends the slot pressed", async () => {
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
      expect(slotsOffered(host)).toEqual([
        ["Army 2", "true"],
        ["Army 3", "false"],
      ]);
      expect(startReading(host)).toBe("7");
      expect(deployButton(host)).toBeDefined();
      act(() => slotButton(host, "Army 3").click());
      expect(slotsOffered(host)).toEqual([
        ["Army 2", "false"],
        ["Army 3", "true"],
      ]);
      expect(startReading(host)).toBe("150");
      await act(async () => deployButton(host)!.click());
      expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ slot: 2 }));
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("offers the open slots on a phone as numbered pips, the chosen one framed as a picked army", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    layout.current = "phone";
    const { store, row } = frontierDay();
    const { host, root } = render(store, row);
    try {
      expect(slotsOffered(host)).toEqual([
        ["Army 2", "true"],
        ["Army 3", "false"],
      ]);
      expect([slotButton(host, "Army 2").textContent, slotButton(host, "Army 3").textContent]).toEqual(["2", "3"]);
      // Both wear the kit's chosen look (ui-pick), which frames the one aria-pressed names, as on a picked army.
      expect(slotButton(host, "Army 2").classList.contains("ui-pick")).toBe(true);
      expect(slotButton(host, "Army 3").classList.contains("ui-pick")).toBe(true);
      act(() => slotButton(host, "Army 3").click());
      expect(slotButton(host, "Army 3").getAttribute("aria-pressed")).toBe("true");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it.each(["desktop", "phone"] as const)(
    "chooses the one open slot on its own when opened from the map, and sends it (%s)",
    async (screen) => {
      // Owner, 30 October 2026: "when a single slot is available for army deploy it should be picked by default by the
      // client of course."
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      layout.current = screen;
      const { store, row } = frontierDay();
      // Army 1 holds the first slot already; Army 2 takes the second: only the third is open.
      store.applyFacts([
        {
          model: "ArmySlot",
          key: "0x91",
          value: {
            game_id: 1,
            structure_id: 7,
            epoch: "0",
            slot: 1,
            explorer_id: 71,
            stamina: { amount: "150", settled_at: "3", remainder: 0 },
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
      // A tile beside the realm held on the map: an order with its aim and no slot.
      openArmyDeployment({ structureId: 7, isExplorer: true, direction: Direction.WEST });
      const { host, root } = render(store, row);
      try {
        expect(slotsOffered(host)).toEqual([["Army 3", "true"]]);
        expect(deployButton(host)).toBeDefined();
        await act(async () => deployButton(host)!.click());
        expect(createExplorerArmy).toHaveBeenCalledWith(
          expect.objectContaining({ slot: 2, spawnDirection: Direction.WEST }),
        );
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    },
  );

  it("opens on the slot the Armies card's Deploy named", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    openArmyDeployment({ structureId: 7, isExplorer: true, slot: 2 });
    const { host, root } = render(store, row);
    try {
      expect(slotsOffered(host)).toEqual([
        ["Army 2", "false"],
        ["Army 3", "true"],
      ]);
      expect(deployButton(host)).toBeDefined();
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

  it("opens at full stack, takes a count on its size row, and deploys the count set", async () => {
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
    expect(host.querySelector(".ui-notice")).toBeNull();
    expect(deployButton(host)?.disabled).toBe(false);
    expect(host.querySelector(".deploy-troop-card")?.textContent).toContain("420");
    expect([slider(host).max, count(host), host.querySelector(".ui-notice")]).toEqual(["420", "420", null]);
    typeCount(host, 120);
    expect(deployButton(host)?.textContent).toBe("Deploy 120");
    expect(foot(host)).toBe("240Deploy 120");
    expect(host.querySelector('.ui-price [role="img"]')?.getAttribute("aria-label")).toBe("240 Wheat");
    expect(host.textContent!.replace(foot(host), "")).not.toMatch(/wheat/i);
    const range = slider(host);
    expect([range.getAttribute("aria-label"), range.max, range.value]).toEqual([
      DEPLOY_WORDS.howMany("Knights"),
      "420",
      "120",
    ]);
    dragCount(host, 200);
    expect([count(host), deployButton(host)?.textContent]).toEqual(["200", "Deploy 200"]);
    typeCount(host, 900);
    expect([count(host), slider(host).value, deployButton(host)?.textContent]).toEqual(["420", "420", "Deploy 420"]);
    typeCount(host, 120);
    expect(host.textContent).not.toMatch(/Day ends/i);
    expect(startReading(host)).toBe("150");
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
    click(host.querySelector('button[aria-label="Army 2"]')!);
    await act(async () => {
      deployButton(host)!.click();
      deployButton(host)!.click();
    });
    expect(createExplorerArmy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledOnce();
    expect(inFlight("deploy", 7)).toBe(1);
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

  it("caps the count where the wheat runs out and names the wheat only at that cap, never below it", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0xc",
        value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(108n * 1_000_000_000n) },
      },
    ] as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(wheatLine(host)).toEqual({ line: "Wheat for only 50 of 420 troops" });
    expect([slider(host).max, count(host)]).toEqual(["54", "50"]);
    typeCount(host, 30);
    expect([wheatLine(host), foot(host)]).toEqual([null, "60Deploy 30"]);
    typeCount(host, 300);
    expect(count(host)).toBe("54");
    expect(wheatLine(host)).toEqual({ line: "Wheat for only 54 of 420 troops" });
    expect(foot(host)).toBe("108Deploy 54");
    expect(deployButton(host)?.disabled).toBe(false);
    typeCount(host, 49);
    expect(wheatLine(host)).toBeNull();
    press(host, "Max");
    expect([count(host), wheatLine(host)?.line]).toEqual(["50", wheatForOnly("50", "420")]);
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    ["nine Wheat deploys four troops", 9, "4", "8Deploy 4"],
    ["four and a half Wheat deploys two", 4.5, "2", null],
  ])("prices Max on the whole batch at the recipe cost: %s", (_case, wheat, most, price) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "RealmKnowledge",
        key: "0xd",
        value: { game_id: 1, structure_id: 7, learned: String(2n << 14n) },
      },
      {
        model: "ResourceBalance",
        key: "0xc",
        value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(Math.round(wheat * 1_000_000_000)) },
      },
    ] as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(slider(host).max).toBe(most);
    if (price) expect(foot(host)).toBe(price);
    act(() => root.unmount());
    host.remove();
  });

  it("says at Max, in a quiet line under the slider, that the wheat caps the count, and keeps Max at the most as the farms fill", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0xc",
        value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(18n * BigInt(RESOURCE_PRECISION)) },
      },
      {
        model: "ResourceProduction",
        key: "0x835",
        value: {
          remainder: 0,

          game_id: 1,
          entity_id: 7,
          resource_type: 35,
          building_count: 1,
          production_rate: String((720n * BigInt(RESOURCE_PRECISION)) / 3_600n),
          output_amount_left: String((1n << 128n) - 1n),
          last_settled_at: 3,
        },
      },
    ] as never);
    const onClose = vi.fn();
    const { host, root, draw } = render(store, row, onClose);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect([count(host), slider(host).max, foot(host)]).toEqual(["8", "9", "16Deploy 8"]);
    expect(wheatLine(host)).toEqual({ line: "Wheat for only 8 of 420 troops" });

    clock.tick = 13;
    draw();
    expect([count(host), slider(host).max, foot(host)]).toEqual(["9", "10", "18Deploy 9"]);
    expect(wheatLine(host)?.line).toBe(wheatForOnly("9", "420"));

    typeCount(host, 5);
    clock.tick = 23;
    draw();
    expect([count(host), slider(host).max, wheatLine(host)]).toEqual(["5", "11", null]);

    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Build")).toBe(false);
    press(host, "Max");
    expect([count(host), wheatLine(host)]).toEqual(["10", { line: "Wheat for only 10 of 420 troops" }]);
    act(() => root.unmount());
    host.remove();
  });

  it("with wheat short of one troop, is at its cap at 0: says what one needs against what is held, Deploy stays off, and Get Wheat goes to the realm", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([
      {
        model: "ResourceBalance",
        key: "0xc",
        value: { game_id: 1, entity_id: 7, resource_type: 35, balance: String(BigInt(RESOURCE_PRECISION)) },
      },
    ] as never);
    const onClose = vi.fn();
    const { host, root } = render(store, row, onClose);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(wheatLine(host)).toEqual({ line: "Needs 2 Wheat, have 1", press: "Get Wheat" });
    expect(deployButton(host)?.disabled).toBe(true);
    act(() => host.querySelector<HTMLButtonElement>(".ui-notice__fix button")!.click());
    expect([place.goTo, onClose.mock.calls.length]).toEqual([[false], 1]);
    act(() => root.unmount());
    host.remove();
  });

  it.each([
    {
      case: "a slot fresh today starts its army full",
      facts: [],
      number: "150",
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
      number: "7",
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
      number: "180",
    },
  ])("names the stamina the new army starts on, its slot's: $case", ({ facts, number }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts(facts as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    // Slot 1 holds an army; the player chose Army 2.
    expect(startReading(host)).toBe(number);
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

  it("with no troops at home and none being made, takes away Deploy and offers Build with the Barracks' mark", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    store.applyFacts([noTroops] as never);
    const { host, root } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    expect(deployButton(host)).toBeUndefined();
    expect(host.querySelector(".ui-notice")!.textContent).toBe(NO_TROOPS_AT_HOME);
    const build = [...host.querySelectorAll("button")].find((button) => button.textContent === "Build")!;
    expect(build.querySelector("[data-icon]")!.getAttribute("data-icon")).toBe("barracks");
    act(() => build.click());
    expect(place.goTo).toEqual([false]);
    act(() => root.unmount());
    host.remove();
  });

  it.each(TROOP_TYPES)("counts down to the next trained troop and offers Deploy when it arrives (%s)", (type) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, row } = frontierDay();
    const resource = getTroopResourceId(type, TroopTier.T1);
    const recipe = store.require("ProductionRecipe", { game_id: 1, resource_type: 26 });
    store.applyFacts([
      noTroops,
      {
        model: "ProductionRecipe",
        key: store.wireKeyOf("ProductionRecipe", { game_id: 1, resource_type: resource }) ?? "0xb29",
        value: wire({ ...recipe, resource_type: resource }),
      },
      {
        model: "ResourceProduction",
        key: "0x826",
        value: {
          remainder: 0,

          game_id: 1,
          entity_id: 7,
          resource_type: resource,
          building_count: 1,
          production_rate: String((360n * BigInt(RESOURCE_PRECISION)) / 3_600n),
          output_amount_left: String((1n << 128n) - 1n),
          last_settled_at: 3,
        },
      },
    ] as never);
    const { host, root, draw } = render(store, row);
    click(host.querySelector('button[aria-label="Army 2"]')!);
    const notice = () => host.querySelector(".ui-notice")?.textContent ?? null;
    const build = () => [...host.querySelectorAll("button")].some((button) => button.textContent === "Build");
    expect([notice(), build(), deployButton(host)]).toEqual(["No troops at home · in 10s", false, undefined]);

    clock.tick = 8;
    draw();
    expect([notice(), build(), deployButton(host)]).toEqual(["No troops at home · in 5s", false, undefined]);

    clock.tick = 13;
    draw();
    expect(notice()).toBeNull();
    expect(build()).toBe(false);
    expect(deployButton(host)).toBeDefined();
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
    act(() => openArmyDeployment({ structureId: 7, isExplorer: true, direction: Direction.WEST }));
    expect(map.asked.at(-1)).toEqual({ structureId: 7, direction: Direction.WEST });
    await act(async () => deployButton(host)!.click());
    expect(createExplorerArmy).toHaveBeenCalledWith(expect.objectContaining({ spawnDirection: Direction.WEST }));

    // An unexplored ring leaves no tile to step out on, and there is no Deploy to send.
    ring.explored = false;
    draw();
    expect(host.textContent).toContain(NO_OPEN_TILE);
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

const click = (button: Element) => act(() => (button as HTMLButtonElement).click());
