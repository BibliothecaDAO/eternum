import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { configManager } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-1.json";
import { hash } from "starknet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installNativeStoreBridge } from "./native-store-bridge";

const structure = (entityId: number, gameId = 1) => ({
  game_id: gameId,
  entity_id: entityId,
  owner: "0x123",
  base: {
    category: 1,
    level: 0,
    created_at: 0,
    coord_x: 100,
    coord_y: 100,
    alt: false,
    troop_explorer_count: 0,
    troop_max_guard_count: 1,
    troop_max_explorer_count: 1,
    starting_troops_granted: false,
  },
  metadata: {
    realm_id: 1,
    order: 0,
    has_wonder: false,
    village_realm: 0,
    mine_kind: 0,
    attunement: 0,
    barracks_tier: 0,
  },
  resources_packed: "0",
  troop_explorers: [],
});
const createHarness = () => {
  const store = new NativeFactStore();
  const game = {
    game_id: 1,
    name: "0",
    preset_id: 1,
    creator: "0x123",
    settled: false,
    ready: true,
    dev_mode_on: true,
    start_settling_at: "1",
    start_main_at: "2",
    end_at: "1000",
    end_grace_seconds: 0,
    seed: "1",
  };
  store.applyEntityOperations([
    {
      type: "upsert",
      entities: [
        {
          hashed_keys: hash.computePoseidonHashOnElements([1]),
          models: { SliceRules: { ...preset.rules, game_id: 1 }, GameRegistry: game },
        },
      ],
    },
  ]);
  configManager.setActiveGame(1, 1);
  configManager.setStore(store);
  let sliceApplied: (() => void) | null = null;
  const runtime = {
    subscribeSliceApplied: (listener: () => void) => {
      sliceApplied = listener;
      return () => {
        sliceApplied = null;
      };
    },
  };
  const writeStructures = (ids: number[], gameId = 1) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: ids.map((id) => ({
          hashed_keys: hash.computePoseidonHashOnElements([gameId, id]),
          models: { Structure: structure(id, gameId) },
        })),
      },
    ]);
  return {
    store,
    game,
    applySlice: () => sliceApplied?.(),
    hasSliceListener: () => sliceApplied !== null,
    install: () => installNativeStoreBridge({ store, runtime: runtime as never }),
    writeStructures,
  };
};

describe("native fact to view bridge", () => {
  const setSlices = vi.spyOn(useWorldSlicesStore, "setState");
  const setUi = vi.spyOn(useUIStore, "setState");
  const disposers: Array<() => void> = [];
  beforeEach(() => {
    setSlices.mockClear();
    setUi.mockClear();
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    useWorldSlicesStore.setState(useWorldSlicesStore.getInitialState());
  });

  it("publishes all transaction changes once without waiting for the ambient slice", () => {
    const harness = createHarness();
    disposers.push(harness.install());
    expect(setSlices).toHaveBeenCalledTimes(1);
    expect(setUi).toHaveBeenCalledTimes(1);
    setSlices.mockClear();
    harness.writeStructures([1, 2, 3]);
    expect(setSlices).toHaveBeenCalledTimes(1);
    expect(useWorldSlicesStore.getState().structures.map((row) => row.entity_id)).toEqual([1, 2, 3]);
    expect(useWorldSlicesStore.getState().structures[0]).toBe(
      harness.store.get("Structure", { game_id: 1, entity_id: 1 }),
    );
    harness.applySlice();
    expect(setSlices).toHaveBeenCalledTimes(1);
  });

  it("filters other games and removes deleted structures", () => {
    const harness = createHarness();
    disposers.push(harness.install());
    harness.writeStructures([1]);
    harness.writeStructures([2], 2);
    expect(useWorldSlicesStore.getState().structures.map((row) => row.entity_id)).toEqual([1]);
    harness.store.applyEntityOperations([
      { type: "remove-components", entityId: hash.computePoseidonHashOnElements([1, 1]), models: ["Structure"] },
    ]);
    expect(useWorldSlicesStore.getState().structures).toEqual([]);
  });

  it("updates the game clock from persistent game changes", () => {
    const harness = createHarness();
    disposers.push(harness.install());
    harness.store.applyEntityOperations([
      {
        type: "upsert",
        entities: [
          {
            hashed_keys: hash.computePoseidonHashOnElements([1]),
            models: { GameRegistry: { ...harness.game, end_at: "500" } },
          },
        ],
      },
    ]);
    expect(useUIStore.getState().gameEndAt).toBe(500);
  });

  it("derives only for selection and relic changes among UI writes", () => {
    const harness = createHarness();
    disposers.push(harness.install());
    setUi.mockClear();
    useUIStore.setState({ isLoadingScreenEnabled: !useUIStore.getState().isLoadingScreenEnabled } as never);
    expect(setUi).toHaveBeenCalledTimes(1);
    useUIStore.getState().triggerRelicsRefresh();
    expect(setUi).toHaveBeenCalledTimes(2);
    expect(setUi.mock.calls[1]?.[0]).toHaveProperty("playerRelics");
  });

  it("stops deriving once disposed", () => {
    const harness = createHarness();
    const dispose = harness.install();
    dispose();
    expect(harness.hasSliceListener()).toBe(false);
    setSlices.mockClear();
    harness.writeStructures([9]);
    harness.applySlice();
    useUIStore.getState().triggerRelicsRefresh();
    expect(setSlices).not.toHaveBeenCalled();
    expect(useWorldSlicesStore.getState().structures).toHaveLength(0);
  });
});
