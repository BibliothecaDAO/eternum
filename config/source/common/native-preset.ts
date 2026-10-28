import type { ConfigPatch } from "./merge-config";
import type { GameType } from "./types";

/** Five chest tiers, common to legendary: a depth's odds in basis points, or the shares each tier pays. */
export interface ChestTiers {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
}

export interface NativePreset {
  id: number;
  /**
   * Days and activity scale independently. Activity accelerates army ticks and per-second production.
   */
  clockScale?: { days: number; activity: number };
  /**
   * What a fixture preset changes in its mode's balance (starting stock, prices); the rest of the balance is the mode's.
   * Applied wherever a preset's configuration is loaded.
   */
  balance?: ConfigPatch;
  gameType: GameType;
  environmentGameType: GameType;
  bitcoinEnabled: boolean;
  ledger: {
    protocolCutBps: number;
    mmrEnabled: boolean;
  };
  /** One troop type per biome; empty for a fixed roster, which deals each player one type per realm. */
  startingTroops: readonly ("Knight" | "Paladin" | "Crossbowman")[];
  realmResources: readonly number[];
  relics: readonly { rate_bps: number; duration: number; uses: number; essence_cost: number; draw_weight: number }[];
  supplies: readonly { resource_type: number; percent: number; percent_max: number; weight: number }[];
  bridgeResources: readonly number[];
  modeRules: number;
  entryRule: number;
  commandMask: bigint;
  settlementMode: "Single" | "Triple" | "Duel";
  spacing: number;
  /** The unit a season's days are counted in (Frontier rules §9): a day lasts 2 to 6 units; 0 in modes without days. */
  dayUnitSeconds: number;
  board: null | {
    demolitionRefundBps: number;
    workshopRate: number;
    /** What one tier pick adds for every building of its type: Fields, Tools and Drill, of the base output. */
    outputStepBps: number;
    /** Granary and Storeroom, of the castle's base limit. */
    storageStepBps: number;
    /** A hut tier, of a hut's population. */
    populationStepBps: number;
    /** Wheat a Rations pick takes off each deployed troop. */
    rationStep: number;
    /** Total Barracks purchases needed to construct training. */
    trainingGateTier: number;
    /** Troop storage in full deployments; wheat/labor base caps by realm level, in whole units. */
    troopStoreDeploys: number;
    resourceStoreCaps: readonly [number, number, number, number];
  };
  /** One price per research row tier above common; rows are research.cairo's ROW_* ids. */
  research: readonly { row: number; tier: number; essenceCost: number; laborCost: number }[];
  discovery: null | {
    beastsBps: number;
    campBps: number;
    riftBps: number;
    ruinBps: number;
    shrineBps: number;
    wellBps: number;
    emptyRevealLimit: number;
  };
  /** XP per reveal, the fixed award (a shrine, and a relic chest until relics leave chests), and the five cumulative skill-point thresholds. */
  progression: null | {
    revealXp: number;
    fixedXp: number;
    commonXp: number;
    uncommonXp: number;
    rareXp: number;
    epicXp: number;
    legendaryXp: number;
  };
  labor: null | { amount: number; campaignEssence: number; goldenAmount: number; goldenEssence: number };
  chests: null | {
    poolBps: number;
    topN: number;
    priceCeiling: number;
    shares: ChestTiers;
    claimWindowSeconds: number;
  };
  depths: Array<{
    revealPercent: number;
    siteGuardLower: number;
    siteGuardUpper: number;
    ruinGuardLower: number;
    ruinGuardUpper: number;
    guardStep: number;
    beastWeakLower: number;
    beastWeakUpper: number;
    beastStrongLower: number;
    beastStrongUpper: number;
    revealSiteNeighbors: boolean;
    entryStamina: number;
    chest: ChestTiers;
  }>;
}
