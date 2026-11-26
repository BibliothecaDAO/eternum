import type { deepSites } from "../../../packages/types/src/constants/deep-sites";
import type { ConfigPatch } from "./merge-config";
import type { GameType } from "./types";

type DeepKind = (typeof deepSites)[number]["key"];

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
  clockScale?: number;
  /**
   * What a preset changes in its mode's balance (starting stock, prices); the rest of the balance is the mode's.
   * Applied wherever a preset's configuration is loaded.
   */
  balance?: ConfigPatch;
  gameType: GameType;
  environmentGameType: GameType;
  /** One troop type per biome; empty for a fixed roster, which deals each player one type per realm. */
  startingTroops: readonly ("Knight" | "Paladin" | "Crossbowman")[];
  realmResources: readonly number[];
  bridgeResources: readonly number[];
  modeRules: number;
  entryRule: number;
  commandMask: bigint;
  settlementMode: "Single" | "Triple";
  spacing: number;
  /** One Aspect per canonical Order, in Order-id order; empty disables teams. */
  orderAspects: readonly number[];
  /** The unit a season's days are counted in (Frontier rules §9): a day lasts 2 to 6 units; 0 in modes without days. */
  dayUnitSeconds: number;
  board: null | {
    demolitionRefundBps: number;
    workshopRate: number;
    /** What one tier pick adds for every building of its type: Fields, Tools and Drill, of the base output. */
    outputStepBps: number;
    /** Granary and Storeroom, of the castle's base limit. */
    storageStepBps: number;
    /** Wheat a Rations pick takes off each deployed troop. */
    rationStep: number;
    /** Total Barracks purchases needed to construct training. */
    /** Troop storage in full deployments; wheat/labor base caps by realm level, in whole units. */
    troopStoreDeploys: number;
    resourceStoreCaps: readonly [number, number, number, number];
    laborStoreCaps?: readonly [number, number, number, number];
  };
  /** One price per research row tier above common; rows are research.cairo's ROW_* ids. */
  research: readonly { row: number; tier: number; essenceCost: number; laborCost: number }[];
  race: null | {
    seasonDays: number;
    stageHeight: number;
    clearMistPercent: number;
    secondWindPercent: number;
    paleMoonPercent: number;
    spoilsPercent: number;
  };
  deep: null | {
    gateDistance: number;
    rings: readonly { radius: number; realms: number }[];
    beasts: Record<DeepKind, { count: number; bow: boolean }>;
    lossPerTick: number;
    corePerTick: number;
    minePerTick: number;
    buildingPay: { alone: number; pair: number; crowd: number };
    altarThreshold: number;
  };
  banes: null | {
    quietDays: number;
    chanceStep: number;
    quorumPercent: number;
    beastPercent: number;
    staminaPercent: number;
    productionPercent: number;
    questCounts: readonly number[];
  };
  dailyQuest: null | {
    baseCounts: readonly number[];
    labor: number;
    essence: number;
    bonusPercent: number;
  };
  discovery: null | {
    beastsBps: number;
    campBps: number;
    riftBps: number;
    ruinBps: number;
    shrineBps: number;
    wellBps: number;
    emptyRevealLimit: number;
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
    revealCap: number;
    riftEssenceBps: number;
    siteGuardLower: number;
    siteGuardUpper: number;
    riftGuardLower: number;
    riftGuardUpper: number;
    guardStep: number;
    beastWeakLower: number;
    beastWeakUpper: number;
    beastStrongLower: number;
    beastStrongUpper: number;
    revealSiteNeighbors: boolean;
    chest: ChestTiers;
  }>;
}
