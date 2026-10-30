import { frontierArmyRules } from "../army/progression-rules-fixture";
import { nativeResearchConstants as research, nativeRuleConstants } from "@bibliothecadao/eternum/game-client";

import type { ArmyDetailFacts } from "../army/army-detail";
import type { LearnedRow, RealmResearchFacts } from "./research-tree";

/**
 * Two realms and two armies on the Frontier preset's numbers (config/source/frontier/native.ts), for the lab and the
 * tests: the owner's realm on 20 October (owner-research.png and owner-armies.png: a Settlement with 300 Essence and 718
 * labor, Farm, Barracks and a Hut standing, nothing researched; Army 1 with 1,500 troops and 12 XP) and one some days in,
 * where every state of the tree shows at once. The game reads the same facts from the store.
 */

/** A building row's tier, uncommon to legendary, costs its base times these ladders. */
const ESSENCE_LADDER = [0.5, 1, 4, 12, 30];
const LABOR_LADDER = [0.5, 1, 3, 8, 20];
const BUILDING_BASES: Partial<Record<number, { essence: number; labor: number }>> = {
  [research.ROW_FARM]: { essence: 1000, labor: 1000 },
  [research.ROW_WORKSHOP]: { essence: 2000, labor: 2000 },
  [research.ROW_BARRACKS]: { essence: 4000, labor: 3000 },
  [research.ROW_HUT]: { essence: 500, labor: 500 },
  [research.ROW_WAR_HALL]: { essence: 12000, labor: 3000 },
  [research.ROW_SUPPLY_YARD]: { essence: 12000, labor: 3000 },
  [research.ROW_SCOUTS_LODGE]: { essence: 12000, labor: 3000 },
  [research.ROW_HEARTH]: { essence: 12000, labor: 3000 },
};
const CASTLE_PRICES: Partial<Record<number, readonly number[]>> = {
  [research.ROW_SHRINE]: [2000],
  [research.ROW_WELL]: [6000],
  [research.ROW_DEPTH]: [100_000, 250_000, 500_000],
};
/** Settlement, City, Kingdom, Empire: base wheat/labor storage. */
const RESOURCE_CAPS = [6000, 18_000, 40_000, 80_000];

const price = (row: number, tier: number) => {
  const base = BUILDING_BASES[row];
  if (base)
    return {
      essence:
        row >= research.ROW_WAR_HALL && row <= research.ROW_HEARTH && tier === 2
          ? 16000
          : base.essence * ESSENCE_LADDER[tier - 1]!,
      labor: base.labor * LABOR_LADDER[tier - 1]!,
    };
  return { essence: CASTLE_PRICES[row]![tier - 1]!, labor: 0 };
};

/** A realm on the preset: its level, what it holds, what stands, what it learned. */
const realmOn = (
  castleLevel: number,
  essence: number,
  labor: number,
  standing: Partial<Record<number, number>>,
  learned: Partial<Record<number, LearnedRow>>,
): RealmResearchFacts => {
  const storeroomPicks = (learned[research.ROW_WORKSHOP]?.sides ?? []).filter((side) => side === 1).length;
  return {
    castleLevel,
    essence,
    labor,
    standing,
    learned,
    price,
    board: {
      outputStepBps: 2000,
      storageStepBps: 4000,
      populationStepBps: 2000,
      trainingGateTier: 2,
    },
    // A Knight deploys for 2 wheat; each Rations pick cuts 0.2.
    wheatPerTroop: (rations) => 2 - rations * 0.2,
    laborStore: (level) => (RESOURCE_CAPS[level]! * (10_000 + storeroomPicks * 4000)) / 10_000,
    wellStamina: nativeRuleConstants.WELL_STAMINA,
  };
};

/** The owner's realm on 20 October: a Settlement, nothing researched, short of everything. */
export const EARLY_REALM = realmOn(
  0,
  300,
  718,
  { [research.ROW_FARM]: 2, [research.ROW_BARRACKS]: 1, [research.ROW_HUT]: 1 },
  {},
);

/**
 * Some days in, a City: Farm uncommon on both sides (Fields, Granary), Workshop uncommon (Tools), Barracks rare (Drill, Drill), a Hut
 * uncommon, a War hall and a Scouts' lodge standing (the lodge uncommon on rifts), the Shrine learned.
 */
export const MID_REALM = realmOn(
  1,
  18_250,
  9_640,
  {
    [research.ROW_FARM]: 4,
    [research.ROW_WORKSHOP]: 2,
    [research.ROW_BARRACKS]: 3,
    [research.ROW_HUT]: 3,
    [research.ROW_WAR_HALL]: 1,
    [research.ROW_SCOUTS_LODGE]: 1,
  },
  {
    [research.ROW_FARM]: { tier: 1, sides: [0, 1] },
    [research.ROW_WORKSHOP]: { tier: 1, sides: [0] },
    [research.ROW_BARRACKS]: { tier: 2, sides: [0, 0] },
    [research.ROW_HUT]: { tier: 1, sides: [] },
    [research.ROW_WAR_HALL]: { tier: 1, sides: [] },
    [research.ROW_SCOUTS_LODGE]: { tier: 1, sides: [1] },
    [research.ROW_SHRINE]: { tier: 1, sides: [] },
  },
);

const ARMY_RULES = {
  rules: frontierArmyRules(),
};

/** The owner's Army 1: 1,500 troops, 12 XP, 4 of 120 stamina, every attribute common. */
export const EARLY_ARMY: ArmyDetailFacts = {
  name: "Army 1",
  art: "knight-t1",
  troops: 1_500,
  xp: 12,
  stamina: { current: 4, max: 120, perExplore: 20 },
  secondsToFull: 4 * 3_600,
  revealYield: 75,
  progress: { battle: 0, logistics: 0, scouting: 0, homecoming: 0, scoutingKinds: [] },
  points: [0, 0, 0, 0, 0],
  ...ARMY_RULES,
};

/** A veteran: 260 XP after a few clears, Battle uncommon, Logistics rare (170 stamina), Scouting uncommon on rifts. */
export const VETERAN_ARMY: ArmyDetailFacts = {
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  xp: 620,
  stamina: { current: 96, max: 120, perExplore: 20 },
  secondsToFull: 2 * 3_600,
  revealYield: 120,
  progress: { battle: 2, logistics: 0, scouting: 0, homecoming: 0, scoutingKinds: [] },
  points: [1, 0, 1, 0, 0],
  ...ARMY_RULES,
};
