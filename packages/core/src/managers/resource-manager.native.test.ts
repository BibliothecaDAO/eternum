import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";
import { describe, expect, it, vi } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { ResourceManager } from "./resource-manager";
import type { GameSyncEntityStoreOperation } from "../sync/game-sync-types";

const upsert = (id: string, models: Record<string, unknown>): GameSyncEntityStoreOperation => ({
  type: "upsert",
  entities: [{ hashed_keys: id, models }],
});
const weight = (game = 1) => ({ game_id: game, entity_id: 7, capacity: 1000n, weight: 0n });
const balance = (game = 1) => ({ game_id: game, entity_id: 7, resource_type: 23, balance: 9007199254740993n });
const game = {
  game_id: 1,
  name: 1n,
  preset_id: 1,
  creator: 1n,
  settled: false,
  ready: false,
  dev_mode_on: false,
  start_settling_at: 0n,
  start_main_at: 200n,
  end_at: 1100n,
  end_grace_seconds: 0,
  seed: 1n,
};
const production = {
  game_id: 1,
  entity_id: 7,
  resource_type: 23,
  building_count: 1,
  production_rate: 2n,
  output_amount_left: 10n,
  last_updated_at: 100,
};

describe("native resource facts", () => {
  it("reads sparse resources and observes a transaction once, including deletion", () => {
    const store = new NativeFactStore();
    store.applyEntityOperations([upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } })]);
    const manager = new ResourceManager(store, 7, 1);
    store.applyEntityOperations([upsert("0x1", { ResourceWeight: weight() })]);
    const changed = vi.fn();
    const unsubscribe = manager.subscribe(changed);
    expect(manager.hasResources()).toBe(true);
    expect(manager.balance(23)).toBe(0n);
    expect(manager.isActive(23)).toBe(false);
    store.applyEntityOperations([upsert("0x2", { ResourceBalance: balance(), ResourceProduction: production })]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(manager.balance(23)).toBe(9007199254740993n);
    expect(manager.getActiveProductions()).toEqual([
      { resourceId: 23, productionRate: 2n, buildingCount: 1, outputAmountLeft: 10n, lastUpdatedAt: 100 },
    ]);
    store.applyEntityOperations([{ type: "remove-components", entityId: "0x2", models: ["ResourceBalance"] }]);
    expect(manager.balance(23)).toBe(0n);
    store.applyEntityOperations([{ type: "delete-entity", entityId: "0x2" }]);
    expect(manager.getActiveProductions()).toEqual([]);
    store.applyEntityOperations([{ type: "delete-entity", entityId: "0x1" }]);
    expect(manager.current(23)).toBeUndefined();
    expect(manager.hasResources()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(4);
    unsubscribe();
    store.applyEntityOperations([upsert("0x1", { ResourceWeight: weight() })]);
    expect(changed).toHaveBeenCalledTimes(4);
  });

  it("scopes reads and notifications to their game and requires a resource owner", () => {
    const store = new NativeFactStore();
    store.applyEntityOperations([upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } })]);
    const first = new ResourceManager(store, 7, 1);
    const second = new ResourceManager(store, 7, 2);
    const changed = vi.fn();
    first.subscribe(changed);
    store.applyEntityOperations([upsert("0x1", { ResourceBalance: balance() })]);
    expect(first.current(23)).toBeUndefined();
    store.applyEntityOperations([upsert("0x2", { ResourceWeight: weight(2), ResourceBalance: balance(2) })]);
    expect(second.balance(23)).toBe(9007199254740993n);
    expect(first.hasResources()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(() => second.current(0)).toThrow("Invalid resource");
  });
  it("starts every Blitz producer at the final main clock after delayed roster preparation", () => {
    const store = new NativeFactStore();
    store.applyEntityOperations([
      upsert("0x1", { ResourceWeight: weight(), ResourceProduction: { ...production, last_updated_at: 100 } }),
      upsert("0x2", {
        SliceRules: { ...preset.rules, game_id: 1, mode_rules: nativeRuleConstants.PRODUCTION_START },
        GameRegistry: game,
      }),
    ]);
    const manager = new ResourceManager(store, 7, 1);
    const changed = vi.fn();
    manager.subscribe(changed);
    expect(manager.current(23)!.production.production_rate).toBe(0n);
    expect(manager.getActiveProductions()).toEqual([]);
    store.applyEntityOperations([upsert("0x2", { GameRegistry: { ...game, ready: true, start_main_at: 1000n } })]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(manager.current(23)!.production).toMatchObject({ last_updated_at: 1000, production_rate: 2n });
    expect(manager.getActiveProductions()[0]).toMatchObject({ lastUpdatedAt: 1000, productionRate: 2n });
  });
  it("projects wheat-funded training and shared storage before allowing muster", () => {
    const store = new NativeFactStore();
    store.applyEntityOperations([
      upsert("0x100", { SliceRules: { ...preset.rules, game_id: 1, mode_rules: 0 } }),
      upsert("0x1", { ResourceWeight: { ...weight(), capacity: 100n, weight: 90n } }),
      upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35, balance: 60n },
        ResourceProduction: {
          ...production,
          resource_type: 35,
          production_rate: 100n,
          output_amount_left: (1n << 128n) - 1n,
        },
        ResourceRule: { game_id: 1, resource_type: 35, unit_weight: 1n, realm_rate: 100n, village_rate: 0n },
      }),
      upsert("0x3", {
        ResourceBalance: { ...balance(), resource_type: 26, balance: 30n },
        ResourceProduction: {
          ...production,
          resource_type: 26,
          production_rate: 10n,
          output_amount_left: (1n << 128n) - 1n,
        },
        ResourceRule: { game_id: 1, resource_type: 26, unit_weight: 1n, realm_rate: 10n, village_rate: 0n },
        ProductionRecipe: {
          game_id: 1,
          resource_type: 26,
          simple_output: 1n,
          simple_inputs: [{ resource_type: 35, amount: 2n }],
          complex_output: 0n,
          complex_inputs: [],
        },
      }),
    ]);
    const manager = new ResourceManager(store, 7, 1);
    expect(manager.balanceWithProduction(101, 26).balance).toBe(30);
    expect(manager.balanceWithProduction(101, 35).balance).toBe(70);
    expect(manager.balance(35)).toBe(60n);
    store.applyEntityOperations([
      upsert("0x1", { ResourceWeight: { ...weight(), capacity: 100n, weight: 34n } }),
      upsert("0x2", {
        ResourceBalance: { ...balance(), resource_type: 35, balance: 4n },
        ResourceProduction: { ...production, resource_type: 35, production_rate: 0n },
      }),
    ]);
    expect(manager.balanceWithProduction(101, 26).balance).toBe(32);
    expect(manager.balanceWithProduction(110, 26).balance).toBe(32);
    store.applyEntityOperations([
      upsert("0x2", {
        ResourceProduction: { ...production, resource_type: 35, production_rate: 4n, last_updated_at: 110 },
      }),
    ]);
    expect(manager.balanceWithProduction(111, 26).balance).toBe(34);
    expect(manager.balanceWithProduction(111, 35).balance).toBe(0);
  });
});
