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
    barracksIICost: number;
    barracksIIICost: number;
    neighbors: Array<{
      building: number;
      neighbor: number;
      productionBps: number;
      capacityBps: number;
      population: number;
    }>;
  };
  progression: null | { revealXp: number; clearXp: number; levelStepXp: number };
  chests: null | {
    looseOneIn: number;
    relicProbability: number;
    cosmeticProbability: number;
    tokenCap: number;
  };
  depths: Array<{
    revealPercent: number;
    guardLower: number;
    guardUpper: number;
    revealSiteNeighbors: boolean;
    entryStamina: number;
    attunementCost: number;
    chest: { common: number; uncommon: number; rare: number; pity: number };
  }>;
}
