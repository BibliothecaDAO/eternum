import type { ChestResult } from "@/ui/features/frontier/chest/chest-moment";
import type { ChestRewardSystemUpdate } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { readChestOutcome } from "@/ui/features/frontier/chest/chest-outcome";
import { relicName } from "@/ui/features/frontier/chest/relic-name";
import type { Intensity } from "@/ui/motion/motion-scale";

/** Frontier's ChestRules row as the preset publishes it. */
const CHEST_RULES_ROW: NativeRows["ChestRules"] = {
  game_id: 2,
  relic_probability: 9_000,
  token_cap: 1,
  lords_amounts: { common: 100n, uncommon: 400n, rare: 1_500n, epic: 6_000n },
  lords_pool: 1_000_000n,
};

/** Frontier's fixed XP, what a relic chest pays the army whatever its quality. */
const RELIC_XP = 200;

export type ChestVariant = "lords" | "relic" | "spent";

/** A ChestReward story as the world update listener reads it, and what the moment is told about it. */
export const chestResultFixture = (variant: ChestVariant, intensity: Intensity, index: number): ChestResult => {
  const reward: ChestRewardSystemUpdate = {
    resultKey: ["0x2", "0x1000", `0x${index.toString(16)}`],
    explorerId: 201,
    kind: variant === "lords" ? "Token" : "Relic",
    lordsExhausted: variant === "spent",
    quality: intensity,
    depth: 1,
    timestamp: 0,
  };
  const outcome = readChestOutcome(reward, CHEST_RULES_ROW);
  if (outcome.kind === "lords") return { outcome };
  return {
    outcome,
    relic: { name: relicName(reward.resultKey), xp: RELIC_XP },
  };
};
