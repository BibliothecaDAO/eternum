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
});
