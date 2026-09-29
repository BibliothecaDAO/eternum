import { describe, expect, it, vi } from "vitest";
import { BiomeType, BuildingType, CapacityConfig, TickIds, TroopType } from "@bibliothecadao/types";
import { hash } from "starknet";
import { NativeFactStore } from "../client/native-fact-store";
import { ClientConfigManager } from "./config-manager";
import preset from "../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

function fixture(gameId = 54) {
  const store = new NativeFactStore();
  const manager = new ClientConfigManager();
  manager.setActiveGame(gameId, 2);
  const write = (model: string, keys: number[], value: Record<string, unknown>) =>
    store.applyFacts([{ model, key: hash.computePoseidonHashOnElements(keys), value }]);
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

  it("answers every keyed lookup for the rows the chain requires, relics' empty ones included", () => {
    const { manager, write } = fixture();
    // The chain configures exactly 58 resource rules and recipes and 40 building rules; relics carry zero rows.
    const isRelic = (resource: number) => (resource >= 39 && resource <= 56) || resource === 58;
    for (const rule of preset.resources) write("ResourceRule", [54, rule.resource_type], { ...rule, game_id: 54 });
    for (let resource = 1; resource <= 58; resource++)
      write("ProductionRecipe", [54, resource], {
        game_id: 54,
        resource_type: resource,
        simple_output: 0n,
        complex_output: isRelic(resource) ? 0n : 1_000_000_000n,
        simple_inputs: [],
        complex_inputs: isRelic(resource) ? [] : [{ resource_type: 1, amount: 1_000_000_000n }],
      });
    for (let category = 1; category <= 40; category++)
      write("BuildingRule", [54, category], {
        game_id: 54,
        category,
        population_cost: 0,
        capacity_grant: 0,
        simple_cost: [],
        complex_cost: [],
      });
    for (let resource = 1; resource <= 58; resource++) {
      expect(manager.getResourceWeightKg(resource)).toBeTypeOf("number");
      expect(manager.getRecipeInputs(resource, false)).toBeDefined();
      expect(manager.getRecipeOutput(resource, true)).toBeTypeOf("number");
    }
    for (let category = 1; category <= 40; category++)
      expect(manager.getBuildingCosts(category as BuildingType, false)).toEqual([]);
    expect(manager.producibleResources()).toHaveLength(58 - 19);
    expect(manager.producibleResources()).not.toContain(39);
  });

  it("refuses a keyed rule the game does not define: loud in dev, unknown in production", () => {
    const { manager } = fixture();
    expect(() => manager.getResourceWeightKg(23)).toThrow("This game defines no resource rule for resource 23");
    expect(() => manager.getRecipeOutput(23, true)).toThrow("This game defines no production recipe");
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(manager.getResourceWeightKg(23)).toBeUndefined();
      expect(manager.getBuildingCosts(BuildingType.WorkersHut, true)).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses a producible recipe it cannot read in every environment, and an unknown biome by name", () => {
    const { manager } = fixture();
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => manager.requireRecipeInputs(23, false)).toThrow("Producible resource 23 has no readable recipe");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(manager.getBiomeCombatBonus(TroopType.Knight, BiomeType.Underground)).toBe(1);
    expect(() => manager.getBiomeCombatBonus(TroopType.Knight, "Swamp" as BiomeType)).toThrow(
      "No biome combat modifier for Knight on Swamp",
    );
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

  it("reads each castle level's army slots from the troop limits and refuses a level the game has none for", () => {
    const { manager } = fixture();
    const limits = preset.rules.troop_limit_config;
    expect([0, 1, 2, 3].map((level) => manager.getArmySlots(level))).toEqual([
      limits.settlement_armies,
      limits.city_armies,
      limits.kingdom_armies,
      limits.empire_armies,
    ]);
    expect(() => manager.getArmySlots(4)).toThrow("Unknown army level 4");
  });

  it("clears the previous game's rules before another game's snapshot", () => {
    const { manager, store } = fixture();
    manager.setActiveGame(55, 2);
    expect(() => manager.getTick(TickIds.Armies)).toThrow("not synchronized");
    expect(() => manager.setStore(store)).toThrow("not synchronized");
  });

  it("recovers only when Herald restores the missing rule", () => {
    const { manager, store, write } = fixture();
    store.applyFacts([{ model: "SliceRules", key: hash.computePoseidonHashOnElements([54]), value: null }]);
    expect(() => manager.getTick(TickIds.Armies)).toThrow("not synchronized");
    write("SliceRules", [54], { ...preset.rules, game_id: 54 });
    expect(manager.getTick(TickIds.Armies)).toBe(Number(preset.rules.tick_config.armies_tick_in_seconds));
  });

  it("rolls combat dice everywhere in a dice game, on the ethereal layer in an ethereal-dice game, else never", () => {
    const { manager, write } = fixture();
    const withRules = (mode_rules: number) => {
      write("SliceRules", [54], { ...preset.rules, game_id: 54, mode_rules });
      return [manager.rollsCombatDice(true), manager.rollsCombatDice(false)];
    };
    const base =
      preset.rules.mode_rules & ~(nativeRuleConstants.COMBAT_DICE | nativeRuleConstants.COMBAT_DICE_ETHEREAL);
    expect(withRules(base)).toEqual([false, false]);
    expect(withRules(base | nativeRuleConstants.COMBAT_DICE_ETHEREAL)).toEqual([true, false]);
    expect(withRules(base | nativeRuleConstants.COMBAT_DICE)).toEqual([true, true]);
  });

  it("pays reveals from strength and depth only in a game with reveal supplies", () => {
    const { manager, write } = fixture();
    const base = preset.rules.mode_rules & ~nativeRuleConstants.REVEAL_SUPPLIES;
    write("SliceRules", [54], { ...preset.rules, game_id: 54, mode_rules: base });
    expect(manager.paysRevealSupplies()).toBe(false);
    write("SliceRules", [54], { ...preset.rules, game_id: 54, mode_rules: base | nativeRuleConstants.REVEAL_SUPPLIES });
    expect(manager.paysRevealSupplies()).toBe(true);
  });

  it("reads whether terrain changes combat from the game's damage rule", () => {
    const { manager, write } = fixture();
    expect(manager.hasBiomeCombatEffects()).toBe(true);
    expect(manager.getBiomeCombatBonus(TroopType.Knight, BiomeType.Beach)).toBe(0.7);

    const neutral = { ...preset.rules.troop_damage_config, damage_biome_bonus_num: 0 };
    write("SliceRules", [54], { ...preset.rules, game_id: 54, troop_damage_config: neutral });
    expect(manager.hasBiomeCombatEffects()).toBe(false);
    expect(manager.getBiomeCombatBonus(TroopType.Knight, BiomeType.Beach)).toBe(1);
  });
});
