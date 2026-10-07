import type { GameType } from "./types";

export interface NativePreset {
  id: number;
  /**
   * A fixture preset's season clocks run this many times faster than its mode's: the day, army ticks and production.
   * The harness registers a fixture preset on first use; the launcher never offers one.
   */
  clockScale?: number;
  gameType: GameType;
  environmentGameType: GameType;
  bitcoinEnabled: boolean;
  ledger: {
    entryFee: number;
    protocolCutBps: number;
    swordPrice: number;
    shieldPrice: number;
    mmrEnabled: boolean;
    predictionFeeBps: number;
    liabilityCap: number;
    seed: number;
  };
  startingTroops: readonly ("Knight" | "Paladin" | "Crossbowman")[];
  realmResources: readonly number[];
  relics: readonly { rate_bps: number; duration: number; uses: number; essence_cost: number; draw_weight: number }[];
  supplies: readonly { resource_type: number; amount: number; amount_max: number; weight: number }[];
  bridgeResources: readonly number[];
  modeRules: number;
  entryRule: number;
  commandMask: bigint;
  settlementMode: "Single" | "Triple" | "Duel";
  spacing: number;
  epochSeconds: number;
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
    /** The Barracks tier a training building needs. */
    trainingGateTier: number;
  };
  /** One price per research row tier above common; rows are research.cairo's ROW_* ids. */
  research: readonly { row: number; tier: number; essenceCost: number; laborCost: number }[];
  discovery: null | {
    campBps: number;
    riftBps: number;
    fallenRealmBps: number;
    looseChestBps: number;
    shrineBps: number;
    wellBps: number;
    emptyRevealLimit: number;
  };
  /** XP per reveal, the fixed award (a shrine, and a relic chest until relics leave chests), and each tier's price. */
  progression: null | {
    revealXp: number;
    fixedXp: number;
    uncommonXp: number;
    rareXp: number;
    epicXp: number;
    legendaryXp: number;
  };
  chests: null | {
    relicProbability: number;
    tokenCap: number;
    lordsAmounts: { common: number; uncommon: number; rare: number; epic: number };
    lordsPool: number;
    seasonEpochs: number;
  };
  depths: Array<{
    revealPercent: number;
    guardLower: number;
    guardUpper: number;
    fallenGuardLower: number;
    fallenGuardUpper: number;
    guardStep: number;
    fallenGuardTier: "T1" | "T2" | "T3";
    revealSiteNeighbors: boolean;
    entryStamina: number;
    chest: { common: number; uncommon: number; rare: number; pity: number };
  }>;
}
