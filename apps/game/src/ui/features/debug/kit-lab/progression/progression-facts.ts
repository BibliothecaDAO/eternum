import { battleBonusBps, homecomingBps, logisticsStamina, scoutingIncrementBps } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

/**
 * The Frontier preset's progression numbers (config/source/frontier/native.ts) and two realms on them: the owner's own
 * (20 October, owner-research.png and owner-armies.png: a Settlement with 300 Essence and 718 labor, Farm, Barracks and a
 * Hut standing, nothing researched, Army 1 with 1,500 troops and 12 XP) and a realm some days in, where every state of
 * the tree shows at once. Lab fixtures only: the live panels read the same facts from the store.
 */

/** A building row's tier, uncommon to legendary, costs its base times these ladders. */
const ESSENCE_LADDER = [1, 4, 12, 30];
const LABOR_LADDER = [1, 3, 8, 20];
const BUILDING_BASES: Record<number, { essence: number; labor: number }> = {
  [research.ROW_FARM]: { essence: 1000, labor: 1000 },
  [research.ROW_WORKSHOP]: { essence: 2000, labor: 2000 },
  [research.ROW_BARRACKS]: { essence: 4000, labor: 3000 },
  [research.ROW_HUT]: { essence: 500, labor: 500 },
  [research.ROW_WAR_HALL]: { essence: 12000, labor: 3000 },
  [research.ROW_SUPPLY_YARD]: { essence: 12000, labor: 3000 },
  [research.ROW_SCOUTS_LODGE]: { essence: 12000, labor: 3000 },
  [research.ROW_HEARTH]: { essence: 12000, labor: 3000 },
};
const CASTLE_PRICES: Record<number, readonly number[]> = {
  [research.ROW_SHRINE]: [2000],
  [research.ROW_WELL]: [6000],
  [research.ROW_DEPTH]: [160_000, 400_000, 900_000],
};

/** What a row's tier (1 = uncommon, or a castle row's first) costs, in whole Essence and labor, as the preset prices it. */
export const researchPrice = (row: number, tier: number): { essence: number; labor: number } => {
  const base = BUILDING_BASES[row];
  if (base) return { essence: base.essence * ESSENCE_LADDER[tier - 1]!, labor: base.labor * LABOR_LADDER[tier - 1]! };
  return { essence: CASTLE_PRICES[row]![tier - 1]!, labor: 0 };
};

/** The board's steps: each make pick +25% output, each store pick +50% store, each hut tier +25%, a Rations pick 0.25 wheat. */
export const BOARD = {
  outputStepBps: 2500,
  storageStepBps: 5000,
  populationStepBps: 2500,
  rationStep: 0.25,
  /** The Barracks tier (rare) the training buildings need before one can stand. */
  trainingGateTier: 2,
  /** The castle's wheat and labor stores hold this many deploys at its level's cap. */
  castleStoreDeploys: 2,
} as const;

/** Settlement, City, Kingdom, Empire: the most troops one deploy takes, which sizes the castle's stores. */
const DEPLOY_CAPS = [3000, 9000, 25_000, 60_000] as const;
export const CASTLE_LEVELS = ["Settlement", "City", "Kingdom", "Empire"] as const;

/** The castle's labor store at a level, with its Storeroom picks. */
export const laborStore = (level: number, storeroomPicks: number): number =>
  (DEPLOY_CAPS[level]! * BOARD.castleStoreDeploys * (10_000 + storeroomPicks * BOARD.storageStepBps)) / 10_000;

/** XP: a reveal, a shrine, and the price of each tier above common. */
export const XP_RULES = { revealXp: 2, fixedXp: 200, tierXp: [100, 200, 400, 800] } as const;
/** Stamina a well gives, and what a bought tier refills (nativeRuleConstants). */
export const WELL_STAMINA = 60;
export const TIER_STAMINA_REFILL = 30;
/** A Knight's stamina before Logistics. */
const BASE_STAMINA = 120;

/** What a clear pays, as progression.cairo's clear_xp: half the root of 25 times the guard's strength. */
export const clearXp = (guard: number): number => Math.floor(Math.floor(Math.sqrt(guard * 25)) / 2);

/** What reaching a Scouting level adds to the kind picked for it, in percent of that kind's base rate. */
export const scoutingStep = (tier: number): number => scoutingIncrementBps(tier) / 100;

/** Each attribute at a tier (1 common to 5 legendary), as the contract's tables give it. */
export const ATTRIBUTE_AT = {
  battle: (tier: number) => battleBonusBps(tier) / 100,
  logistics: (tier: number) => BASE_STAMINA + logisticsStamina(tier),
  /** Every level above common on one kind: +10%, +30%, +60%, +100%. */
  scouting: (tier: number) =>
    Array.from({ length: tier - 1 }, (_, index) => scoutingStep(index + 2)).reduce((sum, step) => sum + step, 0),
  homecoming: (tier: number) => homecomingBps(tier) / 100,
} as const;

/** A row as a realm has learned it: its tier and the side taken at each tier (0 make / 1 store; the lodge's kind). */
export type LearnedRow = { tier: number; sides: number[] };

/** What a realm's tree reads: its castle level, Essence and labor, what stands, and what it has learned. */
export interface RealmFacts {
  name: string;
  castleLevel: number;
  essence: number;
  labor: number;
  /** Buildings of each research row's type standing (the castle's own labor producer is not a Workshop). */
  standing: Partial<Record<number, number>>;
  learned: Partial<Record<number, LearnedRow>>;
}

/** An army as its detail reads it. */
export interface ArmyFacts {
  name: string;
  troops: number;
  xp: number;
  stamina: number;
  /** Tiers 1 (common) to 5 (legendary). */
  battle: number;
  logistics: number;
  scouting: number;
  /** The kind each Scouting tier above common went to. */
  scoutingKinds: ("camp" | "rift" | "beasts")[];
  homecoming: number;
}

/** The owner's realm on 20 October: a Settlement, nothing researched, short of everything. */
export const EARLY_REALM: RealmFacts = {
  name: "Egonal",
  castleLevel: 0,
  essence: 300,
  labor: 718,
  standing: { [research.ROW_FARM]: 2, [research.ROW_BARRACKS]: 1, [research.ROW_HUT]: 1 },
  learned: {},
};

/**
 * Some days in, a City: Farm rare (Fields, Granary), Workshop uncommon (Tools), Barracks rare (Drill, Drill), a Hut
 * uncommon, a War hall and a Scouts' lodge standing (the lodge uncommon on rifts), the Shrine learned.
 */
export const MID_REALM: RealmFacts = {
  name: "Egonal",
  castleLevel: 1,
  essence: 18_250,
  labor: 9_640,
  standing: {
    [research.ROW_FARM]: 4,
    [research.ROW_WORKSHOP]: 2,
    [research.ROW_BARRACKS]: 3,
    [research.ROW_HUT]: 3,
    [research.ROW_WAR_HALL]: 1,
    [research.ROW_SCOUTS_LODGE]: 1,
  },
  learned: {
    [research.ROW_FARM]: { tier: 2, sides: [0, 1] },
    [research.ROW_WORKSHOP]: { tier: 1, sides: [0] },
    [research.ROW_BARRACKS]: { tier: 2, sides: [0, 0] },
    [research.ROW_HUT]: { tier: 1, sides: [] },
    [research.ROW_SCOUTS_LODGE]: { tier: 1, sides: [1] },
    [research.ROW_SHRINE]: { tier: 1, sides: [] },
  },
};

/** The owner's Army 1: 1,500 troops, 12 XP, 4 of 120 stamina, every attribute common. */
export const EARLY_ARMY: ArmyFacts = {
  name: "Army 1",
  troops: 1_500,
  xp: 12,
  stamina: 4,
  battle: 1,
  logistics: 1,
  scouting: 1,
  scoutingKinds: [],
  homecoming: 1,
};

/** A veteran: 260 XP after a few clears, Battle uncommon, Logistics rare, Scouting uncommon on rifts. */
export const VETERAN_ARMY: ArmyFacts = {
  name: "Army 2",
  troops: 1_240,
  xp: 260,
  stamina: 96,
  battle: 2,
  logistics: 3,
  scouting: 2,
  scoutingKinds: ["rift"],
  homecoming: 1,
};
