import { BiomeType, TroopTier, TroopType, WORLD_CONFIG_ID } from "@bibliothecadao/types";
import { describe, expect, it, vi } from "vitest";

import { configManager } from "../managers/config-manager";
import { type Army, CombatSimulator } from "./combat-simulator";

// The simulator resolves configManager through the managers barrel, whose
// circular import chain leaves the binding undefined under vitest; delegate
// lazily to the real singleton instead of stubbing the biome logic away.
vi.mock("../managers", () => ({
  configManager: {
    getBiomeCombatBonus: (troopType: TroopType, biome: BiomeType) =>
      configManager.getBiomeCombatBonus(troopType, biome),
  },
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: unknown, entity: unknown) => {
    if (component instanceof Map) {
      return component.get(entity);
    }
    return undefined;
  },
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: (keys: bigint[]) => keys.map((key) => key.toString()).join(":"),
}));

// The biome table scales with the on-chain damage_biome_bonus_num, so the world
// config is stubbed with the official Blitz value while the table logic itself
// runs unmocked.
const OFFICIAL_BIOME_BONUS_NUM = 3000;

Object.assign(configManager, {
  components: {
    WorldConfig: new Map([
      [WORLD_CONFIG_ID.toString(), { troop_damage_config: { damage_biome_bonus_num: OFFICIAL_BIOME_BONUS_NUM } }],
    ]),
  },
});

const ADVANTAGE = 1 + OFFICIAL_BIOME_BONUS_NUM / 10_000;
const DISADVANTAGE = 1 - OFFICIAL_BIOME_BONUS_NUM / 10_000;
const NEUTRAL = 1;

// Expected multipliers transcribed from the contract's biome table
// (contracts/game/src/models/troop.cairo -> _biome_damage_bonus) so a drift on
// either side of the TS/Cairo pair fails this suite.
const EXPECTED_BIOME_DAMAGE_MULTIPLIERS: Record<BiomeType, Record<TroopType, number>> = {
  [BiomeType.None]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: NEUTRAL,
  },
  [BiomeType.DeepOcean]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: ADVANTAGE,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.Ocean]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: ADVANTAGE,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.Beach]: {
    [TroopType.Knight]: DISADVANTAGE,
    [TroopType.Crossbowman]: ADVANTAGE,
    [TroopType.Paladin]: NEUTRAL,
  },
  [BiomeType.Scorched]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: ADVANTAGE,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.Bare]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: DISADVANTAGE,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.Tundra]: {
    [TroopType.Knight]: DISADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.Snow]: {
    [TroopType.Knight]: DISADVANTAGE,
    [TroopType.Crossbowman]: ADVANTAGE,
    [TroopType.Paladin]: NEUTRAL,
  },
  [BiomeType.TemperateDesert]: {
    [TroopType.Knight]: DISADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.Shrubland]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: DISADVANTAGE,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.Taiga]: {
    [TroopType.Knight]: ADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.Grassland]: {
    [TroopType.Knight]: NEUTRAL,
    [TroopType.Crossbowman]: DISADVANTAGE,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.TemperateDeciduousForest]: {
    [TroopType.Knight]: ADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.TemperateRainForest]: {
    [TroopType.Knight]: ADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.SubtropicalDesert]: {
    [TroopType.Knight]: DISADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: ADVANTAGE,
  },
  [BiomeType.TropicalSeasonalForest]: {
    [TroopType.Knight]: ADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: DISADVANTAGE,
  },
  [BiomeType.TropicalRainForest]: {
    [TroopType.Knight]: ADVANTAGE,
    [TroopType.Crossbowman]: NEUTRAL,
    [TroopType.Paladin]: DISADVANTAGE,
  },
};

const baseArmy = (troopType: TroopType): Army => ({
  stamina: 100,
  troopCount: 1_000,
  troopType,
  tier: TroopTier.T2,
  battle_cooldown_end: 0,
});

describe("ClientConfigManager biome combat bonus", () => {
  it("matches the on-chain biome damage table for every biome and troop type", () => {
    for (const biome of Object.values(BiomeType)) {
      for (const troopType of Object.values(TroopType)) {
        expect(configManager.getBiomeCombatBonus(troopType, biome), `${troopType} in ${biome}`).toBeCloseTo(
          EXPECTED_BIOME_DAMAGE_MULTIPLIERS[biome][troopType],
        );
      }
    }
  });
});

describe("CombatSimulator with real biome modifiers", () => {
  it("boosts an advantaged melee attacker without touching a neutral defender", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const neutral = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Knight),
      baseArmy(TroopType.Crossbowman),
      BiomeType.None,
    );
    const taiga = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Knight),
      baseArmy(TroopType.Crossbowman),
      BiomeType.Taiga,
    );

    expect(taiga.attackerDamage).toBeCloseTo(neutral.attackerDamage * ADVANTAGE);
    expect(taiga.defenderDamage).toBeCloseTo(neutral.defenderDamage);
  });

  it("penalizes a disadvantaged melee attacker while boosting an advantaged defender", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());

    const neutral = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Paladin),
      baseArmy(TroopType.Knight),
      BiomeType.None,
    );
    const taiga = simulator.simulateBattle(0, baseArmy(TroopType.Paladin), baseArmy(TroopType.Knight), BiomeType.Taiga);

    expect(taiga.attackerDamage).toBeCloseTo(neutral.attackerDamage * DISADVANTAGE);
    expect(taiga.defenderDamage).toBeCloseTo(neutral.defenderDamage * ADVANTAGE);
  });

  it("ignores the biome modifier for ranged attacks", () => {
    const simulator = new CombatSimulator(CombatSimulator.getDefaultParameters());
    const rangedContext = { attackDistance: 2 };

    const neutral = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Knight),
      BiomeType.None,
      [],
      [],
      rangedContext,
    );
    const scorched = simulator.simulateBattle(
      0,
      baseArmy(TroopType.Crossbowman),
      baseArmy(TroopType.Knight),
      BiomeType.Scorched,
      [],
      [],
      rangedContext,
    );

    expect(scorched.attackerDamage).toBeCloseTo(neutral.attackerDamage);
    expect(scorched.defenderDamage).toBe(0);
  });
});
