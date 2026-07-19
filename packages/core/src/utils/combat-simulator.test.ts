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

  it("uses reduced defender stamina and halves both battle timers for ranged attacks", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());
    const context = { attackDistance: 2 };

    expect(simulator.calculateNewStaminaAttacker(100, 1, context)).toBe(50);
    expect(simulator.calculateNewStaminaDefender(100, 1, context)).toBe(80);
    expect(simulator.calculateNewCooldownEndAttacker(0, 1_000, 1, context)).toBe(1_030);
    expect(simulator.calculateNewCooldownEndDefender(0, 1_000, 1, context)).toBe(1_030);
  });

  it("uses the official 60-minute Blitz tier and combat stamina defaults", () => {
    const params = CombatSimulator.getDefaultParameters();

    expect(Number(params.t2_damage_multiplier) / Number(CombatSimulator.MAX_U64)).toBe(3);
    expect(Number(params.t3_damage_multiplier) / Number(CombatSimulator.MAX_U64)).toBe(9);
    expect(params.stamina_attack_req).toBe(50);
    expect(params.stamina_defense_req).toBe(40);
  });
});

// Absolute damage numbers derived by hand from the v3 formula with the default
// Blitz-60 parameters (scaling factor 2, T1 value 100, T2 x3, T3 x9, beta 0.2):
// damage = 2 x troops x tier_ratio x role_multipliers / total_troops^0.2.
// Unlike the ratio tests above, these fail if any coefficient drifts.
describe("CombatSimulator damage formula golden values", () => {
  it("deals the exact mirrored damage in a symmetric melee battle", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const result = simulator.simulateBattle(0, baseArmy(TroopType.Knight), baseArmy(TroopType.Knight), BiomeType.Taiga);

    // 2 x 1000 / 2000^0.2
    expect(result.attackerDamage).toBeCloseTo(437.3448, 3);
    expect(result.defenderDamage).toBeCloseTo(437.3448, 3);
    // A 1:1 damage ratio sits below the 2.5 refund threshold on both sides.
    expect(result.attackerRefundMultiplier).toBe(0);
    expect(result.defenderRefundMultiplier).toBe(0);
  });

  it("applies tier damage multipliers to both sides of a T3 versus T1 battle", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());
    const attacker = { ...baseArmy(TroopType.Knight), tier: TroopTier.T3 };
    const defender = { ...baseArmy(TroopType.Knight), tier: TroopTier.T1 };

    const result = simulator.simulateBattle(0, attacker, defender, BiomeType.Taiga);

    // 2 x 1000 x 9 / 2000^0.2 and 2 x 1000 x (1/9) / 2000^0.2
    expect(result.attackerDamage).toBeCloseTo(3936.1035, 3);
    expect(result.defenderDamage).toBeCloseTo(48.5939, 3);
  });

  it("deals the exact ranged Crossbowman damage in the field", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const result = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Knight),
      BiomeType.Taiga,
      [],
      [],
      { attackDistance: 2 },
    );

    // 0.7 x 2 x 1000 / 2000^0.2
    expect(result.attackerDamage).toBeCloseTo(306.1414, 3);
    expect(result.defenderDamage).toBe(0);
  });

  it("deals the exact ranged Crossbowman damage against a structure guard", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const result = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Paladin),
      BiomeType.Taiga,
      [],
      [],
      { attackDistance: 2, defenderIsStructureGuard: true },
    );

    // 0.3 x 2 x 1000 / 2000^0.2
    expect(result.attackerDamage).toBeCloseTo(131.2034, 3);
    expect(result.defenderDamage).toBe(0);
  });

  it("deals the exact Knight assault damage into a Knight structure guard", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const result = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Knight),
      baseArmy(TroopType.Knight),
      BiomeType.Taiga,
      [],
      [],
      { defenderIsStructureGuard: true },
    );

    // Assault bonus and guard damage reduction stack: 1.15 x 0.85 x 2 x 1000 / 2000^0.2
    expect(result.attackerDamage).toBeCloseTo(427.5046, 3);
    // The guard's own damage keeps the plain symmetric value.
    expect(result.defenderDamage).toBeCloseTo(437.3448, 3);
  });
});
