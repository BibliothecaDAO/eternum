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
  it("reduces Crossbowman ranged field damage", () => {
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

    expect(ranged.attackerDamage).toBeLessThan(adjacent.attackerDamage);
  });

  it("heavily reduces Crossbowman ranged damage against structure guards", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const field = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Paladin),
      BiomeType.Taiga,
      [],
      [],
      { attackDistance: 2 },
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

    expect(guard.attackerDamage).toBeLessThan(field.attackerDamage);
  });

  it("increases adjacent Knight damage against structure guards", () => {
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

    expect(guard.attackerDamage).toBeGreaterThan(field.attackerDamage);
  });

  it("reduces incoming damage for Knight structure guards", () => {
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

    expect(guard.attackerDamage).toBeLessThan(field.attackerDamage);
  });
});
