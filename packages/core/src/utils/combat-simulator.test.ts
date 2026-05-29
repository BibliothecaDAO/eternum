import { describe, expect, it, vi } from "vitest";
import { BiomeType, TroopTier, TroopType } from "@bibliothecadao/types";

import { type Army, CombatSimulator } from "./combat-simulator";

vi.mock("../managers", () => ({
  configManager: {
    getBiomeCombatBonus: () => 1,
  },
}));

const baseArmy = (troopType: TroopType): Army => ({
  stamina: 100,
  troopCount: 1_000,
  troopType,
  tier: TroopTier.T2,
  battle_cooldown_end: 0,
});

describe("CombatSimulator Combat v3 context", () => {
  it("applies exact Crossbowman ranged field damage and removes counter-damage", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const adjacent = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Knight),
      BiomeType.Taiga,
    );
    const ranged = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Knight),
      BiomeType.Taiga,
      [],
      [],
      { attackDistance: 2 },
    );

    expect(ranged.attackerDamage).toBeCloseTo(adjacent.attackerDamage * 0.7);
    expect(ranged.defenderDamage).toBe(0);
    expect(ranged.attackerRefundMultiplier).toBe(0);
    expect(ranged.defenderRefundMultiplier).toBe(0);
  });

  it("heavily reduces Crossbowman ranged damage against structure guards", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const adjacent = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Paladin),
      BiomeType.Taiga,
    );
    const guard = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Paladin),
      BiomeType.Taiga,
      [],
      [],
      { attackDistance: 2, defenderIsStructureGuard: true },
    );

    expect(guard.attackerDamage).toBeCloseTo(adjacent.attackerDamage * 0.3);
    expect(guard.defenderDamage).toBe(0);
  });

  it("applies exact adjacent Knight damage against structure guards", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const field = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Knight),
      baseArmy(TroopType.Crossbowman),
      BiomeType.Taiga,
    );
    const guard = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Knight),
      baseArmy(TroopType.Crossbowman),
      BiomeType.Taiga,
      [],
      [],
      { defenderIsStructureGuard: true },
    );

    expect(guard.attackerDamage).toBeCloseTo(field.attackerDamage * 1.15);
  });

  it("applies exact incoming damage reduction for Knight structure guards", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const field = simulator.simulateBattle(0, baseArmy(TroopType.Paladin), baseArmy(TroopType.Knight), BiomeType.Taiga);
    const guard = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Paladin),
      baseArmy(TroopType.Knight),
      BiomeType.Taiga,
      [],
      [],
      { defenderIsStructureGuard: true },
    );

    expect(guard.attackerDamage).toBeCloseTo(field.attackerDamage * 0.85);
  });

  it("does not drain defender stamina and halves both battle timers for ranged attacks", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());
    const context = { attackDistance: 2 };

    expect(simulator.calculateNewStaminaAttacker(100, 1, context)).toBe(60);
    expect(simulator.calculateNewStaminaDefender(100, 1, context)).toBe(100);
    expect(simulator.calculateNewCooldownEndAttacker(0, 1_000, 1, context)).toBe(1_030);
    expect(simulator.calculateNewCooldownEndDefender(0, 1_000, 1, context)).toBe(1_030);
  });

  it("uses the official 60-minute Blitz tier and combat stamina defaults", () => {
    const params = CombatSimulator.getDefaultParameters();

    expect(Number(params.t2_damage_multiplier) / Number(CombatSimulator.MAX_U64)).toBe(3);
    expect(Number(params.t3_damage_multiplier) / Number(CombatSimulator.MAX_U64)).toBe(9);
    expect(params.stamina_attack_req).toBe(40);
    expect(params.stamina_defense_req).toBe(20);
  });
});
