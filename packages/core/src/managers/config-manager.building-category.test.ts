import { describe, expect, it } from "vitest";
import { BuildingType, CapacityConfig, TickIds } from "@bibliothecadao/types";
import { hash } from "starknet";
import { NativeFactStore } from "../client/native-fact-store";
import { ClientConfigManager } from "./config-manager";
import preset from "../../../../contracts/l3/world-native/fixtures/preset-3.json";

function fixture(gameId = 54) {
  const store = new NativeFactStore();
  const manager = new ClientConfigManager();
  manager.setActiveGame(gameId, 2);
  const write = (model: string, keys: number[], value: Record<string, unknown>) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: [{ hashed_keys: hash.computePoseidonHashOnElements(keys), models: { [model]: value } }],
      },
    ]);
  write("SliceRules", [gameId], { ...preset.rules, game_id: gameId });
  manager.setStore(store);
  return { manager, store, write };
}

describe("native immutable configuration", () => {
  it("reads building costs and capacity from the active game's rule", () => {
    const { manager, write } = fixture();
    for (const gameId of [54, 55])
      write("BuildingRule", [gameId, BuildingType.WorkersHut], {
        game_id: gameId,
        category: BuildingType.WorkersHut,
        population_cost: gameId === 54 ? 5 : 99,
        capacity_grant: 12,
        simple_cost: [],
        complex_cost: [],
      });
    expect(manager.getBuildingCategoryConfig(BuildingType.WorkersHut)).toEqual({
      population_cost: 5,
      capacity_grant: 12,
    });
  });

  it("throws for absent building rules instead of granting zero-cost population", () => {
    const { manager } = fixture();
    expect(() => manager.getBuildingCategoryConfig(BuildingType.WorkersHut)).toThrow("not synchronized");
  });

  it("reads tick and capacity values directly from the native rules", () => {
    const { manager } = fixture();
    expect(manager.getTick(TickIds.Armies)).toBe(Number(preset.rules.tick_config.armies_tick_in_seconds));
    expect(manager.getTick(TickIds.Delivery)).toBe(Number(preset.rules.tick_config.delivery_tick_in_seconds));
    expect(manager.getCapacityConfigKg(CapacityConfig.Donkey)).toBe(
      Number(preset.rules.capacity_config.donkey_capacity) / 1000,
    );
    expect(manager.getCapacityConfigKg(CapacityConfig.None)).toBe(0);
  });

  it("clears the previous game's rules before another game's snapshot", () => {
    const { manager, store } = fixture();
    manager.setActiveGame(55, 2);
    expect(() => manager.getTick(TickIds.Armies)).toThrow("not synchronized");
    expect(() => manager.setStore(store)).toThrow("not synchronized");
  });

  it("recovers only when Herald restores the missing rule", () => {
    const { manager, store, write } = fixture();
    store.applyEntityOperations([
      { type: "remove-components", entityId: hash.computePoseidonHashOnElements([54]), models: ["SliceRules"] },
    ]);
    expect(() => manager.getTick(TickIds.Armies)).toThrow("not synchronized");
    write("SliceRules", [54], { ...preset.rules, game_id: 54 });
    expect(manager.getTick(TickIds.Armies)).toBe(Number(preset.rules.tick_config.armies_tick_in_seconds));
  });
});
