import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: { getInstance: () => ({ play: () => Promise.resolve(null) }) },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { configManager, type GameClient, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { BuildingType, RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { realmBoard } from "./build-fixture";
import { BuildSheet } from "./build-sheet";

afterEach(() => {
  disposeGameSyncSession();
  setBlockTimestampSource(null);
  useUIStore.getState().setPreviewBuilding(null);
});

describe("the build sheet", () => {
  it("stands the chosen building on the plot as a ghost, shows its gains, builds it there and takes the ghost away", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store, realm } = realmBoard();
    const plot = { col: 11, row: 10 };
    const placeBuilding = vi.fn(() => Promise.resolve());
    installActiveGameClient({
      connect() {},
      disconnect() {},
      dispose() {},
      actions: { placeBuilding },
    } as unknown as GameClient);
    const onClose = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={plot} onClose={onClose} />
        </GameProvider>,
      ),
    );
    const card = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    expect(card("Farm").getAttribute("aria-pressed")).toBe("true");
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceWheat, plot });
    // The chosen farm makes wheat an hour and takes its population.
    expect(host.querySelector('[aria-label^="produces +"]')).not.toBeNull();

    act(() => card("Barracks").click());
    expect(useUIStore.getState().previewBuilding).toEqual({ type: BuildingType.ResourceKnightT1, plot });
    act(() => card("Farm").click());

    const build = [...host.querySelectorAll("button")].find((button) => button.textContent?.startsWith("Build"))!;
    await act(async () => build.click());
    expect(placeBuilding).toHaveBeenCalledWith(
      expect.objectContaining({ structureId: 7, buildingType: BuildingType.ResourceWheat, hex: plot }),
    );
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.unmount());
    expect(useUIStore.getState().previewBuilding).toBeNull();
    host.remove();
  });

  const fact = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
  const labor = (store: ReturnType<typeof realmBoard>["store"], amount: bigint) =>
    store.applyFacts([
      fact("0x75", "ResourceBalance", {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Labor,
        balance: String(amount * BigInt(RESOURCE_PRECISION)),
      }),
    ] as never);
  const population = (store: ReturnType<typeof realmBoard>["store"], current: number) =>
    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current, max: 6 },
      }),
    ] as never);

  /** The board's packed building counts with `count` of one category standing (eight bits a category). */
  const countsWith = (category: BuildingType, count: number) => {
    const packed = BigInt(count) << BigInt((category - 1) * 8);
    const word = (index: number) => String((packed >> BigInt(128 * index)) & ((1n << 128n) - 1n));
    return { packed_counts_1: word(0), packed_counts_2: word(1), packed_counts_3: word(2) };
  };

  const open = (store: ReturnType<typeof realmBoard>["store"], realm: ReturnType<typeof realmBoard>["realm"]) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
          <BuildSheet realm={realm} plot={{ col: 11, row: 10 }} onClose={() => undefined} />
        </GameProvider>,
      ),
    );
    const card = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    const button = (starts: string) =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.startsWith(starts));
    const close = () => {
      act(() => root.unmount());
      host.remove();
    };
    return { host, card, button, close };
  };

  it("keeps the realm's free population in its head", () => {
    const { store, realm } = realmBoard();
    const total = 6 + configManager.getBasePopulationCapacity();
    population(store, 4);
    const sheet = open(store, realm);
    expect(sheet.host.querySelector(`[aria-label="population ${total - 4} / ${total}"]`)).not.toBeNull();
    sheet.close();
  });

  it("offers Build for a Workshop on a realm whose own resources make no labor, as the contract allows on a board", () => {
    const { store, realm } = realmBoard();
    labor(store, 50_000n);
    const workshop = preset.buildings.find(({ category }) => category === BuildingType.ResourceLabor)!;
    store.applyFacts([
      fact(`0x6${BuildingType.ResourceLabor}`, "BuildingRule", {
        ...workshop.rule,
        simple_cost: [{ resource_type: ResourcesIds.Labor, amount: String(2_000n * BigInt(RESOURCE_PRECISION)) }],
        category: BuildingType.ResourceLabor,
        game_id: 1,
      }),
    ] as never);
    const sheet = open(store, realm);
    act(() => sheet.card("Workshop").click());
    expect(sheet.host.querySelector('[role="status"]')).toBeNull();
    expect(sheet.button("Build")!.textContent).toBe("Build2,000");
    sheet.close();
  });

  it("says what a building needs of the population that is free, and Build Hut on the gold button chooses the Hut", () => {
    const { store, realm } = realmBoard();
    labor(store, 50_000n);
    const total = 6 + configManager.getBasePopulationCapacity();
    population(store, total - 1);
    const sheet = open(store, realm);
    act(() => sheet.card("Barracks").click());
    const cost = configManager.getBuildingCategoryConfig(BuildingType.ResourceKnightT1).population_cost;
    expect(sheet.host.querySelector('[role="status"]')!.textContent).toBe(`Needs ${cost} population, 1 free`);
    expect(sheet.button("Build")!.textContent).toContain("Build Hut");
    act(() => sheet.button("Build Hut")!.click());
    expect(sheet.card("Hut").getAttribute("aria-pressed")).toBe("true");
    // A Hut takes no population: it is the fix, and Build stands under it.
    expect(sheet.host.querySelector('[role="status"]')).toBeNull();
    sheet.close();
  });

  it("says on each card what the building does, and marks a risen price with the rule that raised it", () => {
    const { store, realm } = realmBoard();
    const sheet = open(store, realm);
    const farm = configManager.getBuildingCategoryConfig(BuildingType.ResourceWheat).population_cost;
    expect(sheet.card("Farm").getAttribute("data-tip")).toMatch(
      new RegExp(`^Farm: \\+[\\d,.K]+ wheat an hour, takes ${farm} population$`),
    );
    expect(sheet.card("Hut").getAttribute("data-tip")).toMatch(/^Hut: \+\d+ population$/);
    expect(sheet.card("War hall").getAttribute("data-tip")).toMatch(
      /^War hall: new armies start with Battle at Common(, takes \d+ population)?$/,
    );
    // No Farm stands on the board yet (the fixture's wheat comes with the realm): its price is its base.
    expect(sheet.card("Farm").querySelector('[aria-label="price raised"]')).toBeNull();
    const base = sheet.card("Farm").textContent!.replace("Farm", "");
    sheet.close();

    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.ResourceWheat, 2),
        population: { current: 2, max: 6 },
      }),
    ] as never);
    const risen = open(store, realm);
    const arrow = risen.card("Farm").querySelector('[aria-label="price raised"]')!;
    const rise = 1 + 4 * (configManager.getBuildingBaseCostPercentIncrease() / 10_000);
    expect(arrow.getAttribute("data-tip")).toBe(`Base ${base} labor, ×${rise} with 2 standing`);
    risen.close();
  });

  it("says what opens a locked training building, with the way there on the gold button", () => {
    const { store, realm } = realmBoard();
    const onResearch = vi.fn();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = () =>
      act(() =>
        root.render(
          <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
            <BuildSheet realm={realm} plot={{ col: 11, row: 10 }} onResearch={onResearch} onClose={() => undefined} />
          </GameProvider>,
        ),
      );
    const card = (name: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
    const gold = () => [...host.querySelectorAll("button")].at(-1)!;
    render();
    act(() => card("War hall").click());
    // The fixture's board gates training at the Barracks row's third tier, Rare; no Barracks stands yet.
    expect(host.querySelector('[role="status"]')!.textContent).toBe("Needs Barracks at Rare");
    expect(gold().textContent).toMatch(/^Build Barracks/);
    act(() => gold().click());
    expect(card("Barracks").getAttribute("aria-pressed")).toBe("true");

    store.applyFacts([
      fact("0x72", "StructureBuildings", {
        game_id: 1,
        entity_id: 7,
        ...countsWith(BuildingType.ResourceKnightT1, 1),
        population: { current: 3, max: 6 },
      }),
    ] as never);
    render();
    act(() => card("War hall").click());
    expect(gold().textContent).toBe("Research");
    act(() => gold().click());
    expect(onResearch).toHaveBeenCalledOnce();
    act(() => root.unmount());
    host.remove();
  });

  it("says how much labor a building needs against what is held, and offers the map only where a reveal pays labor", () => {
    const { store, realm } = realmBoard();
    labor(store, 0n);
    const quiet = open(store, realm);
    expect(quiet.host.querySelector('[role="status"]')!.textContent).toMatch(/^Needs [\d,]+ labor, have 0$/);
    expect(quiet.button("Build")).toBeUndefined();
    // This preset's reveals pay no supplies: the map is no fix, so no button names it.
    expect(quiet.button("Explore")).toBeUndefined();
    quiet.close();

    vi.spyOn(configManager, "paysRevealSupplies").mockReturnValue(true);
    const paying = open(store, realm);
    expect(paying.button("Explore for labor")).toBeDefined();
    paying.close();
    vi.restoreAllMocks();
  });
});
