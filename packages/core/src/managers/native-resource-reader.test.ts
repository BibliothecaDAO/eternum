import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorld, defineComponent, removeComponent, setComponent, Type } from "@dojoengine/recs";
import type { ClientComponents } from "@bibliothecadao/types";
import { ResourceManager } from "./resource-manager";
import { gameEntityKey, setGameEntityKeyGameId } from "./game-entity-keys";
import { nativeResourceReader } from "./native-resource-reader";

function fixture() {
  const world = createWorld();
  const ResourceWeight = defineComponent(world, {
    game_id: Type.Number,
    entity_id: Type.Number,
    capacity: Type.BigInt,
    weight: Type.BigInt,
  });
  const ResourceBalance = defineComponent(world, {
    game_id: Type.Number,
    entity_id: Type.Number,
    resource_type: Type.Number,
    balance: Type.BigInt,
  });
  const ResourceProduction = defineComponent(world, {
    game_id: Type.Number,
    entity_id: Type.Number,
    resource_type: Type.Number,
    building_count: Type.Number,
    production_rate: Type.BigInt,
    output_amount_left: Type.BigInt,
    last_updated_at: Type.Number,
  });
  const components = { ResourceWeight, ResourceBalance, ResourceProduction };
  setGameEntityKeyGameId(1);
  const key = gameEntityKey([7n]);
  setComponent(ResourceWeight, key, { game_id: 1, entity_id: 7, capacity: 1000n, weight: 0n });
  return { ...components, key, components: components as unknown as ClientComponents };
}

afterEach(() => setGameEntityKeyGameId(0));
describe("native resource facts", () => {
  it("reads sparse balances and production through the shared manager, including deletion", () => {
    const { components, ResourceBalance, ResourceProduction, ResourceWeight, key } = fixture();
    const manager = new ResourceManager(components, 7);
    const changed = vi.fn();
    const unsubscribe = manager.subscribe(changed);
    expect(manager.hasResources()).toBe(true);
    expect(manager.balance(23)).toBe(0n);
    expect(manager.isActive(23)).toBe(false);
    const slot = gameEntityKey([7n, 23n]);
    setComponent(ResourceBalance, slot, { game_id: 1, entity_id: 7, resource_type: 23, balance: 9007199254740993n });
    setComponent(ResourceProduction, slot, {
      game_id: 1,
      entity_id: 7,
      resource_type: 23,
      building_count: 1,
      production_rate: 2n,
      output_amount_left: 10n,
      last_updated_at: 100,
    });
    expect(changed).toHaveBeenCalledTimes(2);
    expect(manager.balance(23)).toBe(9007199254740993n);
    expect(manager.getActiveProductions()).toEqual([
      { resourceId: 23, productionRate: 2n, buildingCount: 1, outputAmountLeft: 10n, lastUpdatedAt: 100 },
    ]);
    removeComponent(ResourceBalance, slot);
    expect(manager.balance(23)).toBe(0n);
    removeComponent(ResourceProduction, slot);
    expect(manager.getActiveProductions()).toEqual([]);
    removeComponent(ResourceWeight, key);
    expect(nativeResourceReader(components, 7)!.current(23)).toBeUndefined();
    expect(manager.hasResources()).toBe(false);
    expect(changed).toHaveBeenCalledTimes(5);
    unsubscribe();
    setComponent(ResourceWeight, key, { game_id: 1, entity_id: 7, capacity: 1n, weight: 0n });
    expect(changed).toHaveBeenCalledTimes(5);
  });
  it("keeps resource keys game-scoped and rejects incomplete native bindings", () => {
    const { components, ResourceBalance } = fixture();
    setComponent(ResourceBalance, gameEntityKey([7n, 23n]), {
      game_id: 1,
      entity_id: 7,
      resource_type: 23,
      balance: 10n,
    });
    setGameEntityKeyGameId(2);
    expect(new ResourceManager(components, 7).balance(23)).toBe(0n);
    const partial = { ...components, ResourceProduction: undefined } as unknown as ClientComponents;
    expect(() => nativeResourceReader(partial, 7)).toThrow("Missing native model ResourceProduction");
    expect(nativeResourceReader({} as ClientComponents, 7)).toBeUndefined();
  });
});
