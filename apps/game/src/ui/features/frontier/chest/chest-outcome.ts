import type { ChestRewardSystemUpdate } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Intensity } from "@/ui/motion/motion-scale";

export type ChestOutcome =
  | { kind: "lords"; intensity: Intensity; lords: number }
  | { kind: "relic"; intensity: Intensity; lordsSpent: boolean };

const TIERS = ["common", "uncommon", "rare", "epic"] as const;

/**
 * What an opened chest gave, read from its ChestReward story and the game's own amounts table (whole LORDS by
 * quality); an unknown quality is an error. A LORDS roll the season could not pay arrives as a relic, marked spent.
 */
export const readChestOutcome = (
  reward: Pick<ChestRewardSystemUpdate, "kind" | "quality" | "lordsExhausted">,
  rules: Pick<NativeRows["ChestRules"], "lords_amounts">,
): ChestOutcome => {
  const intensity = requireIntensity(reward.quality);
  if (reward.kind === "Token") {
    if (reward.lordsExhausted) throw new Error("A LORDS chest cannot be marked unpaid: an unpaid roll is a relic");
    return { kind: "lords", intensity, lords: Number(rules.lords_amounts[TIERS[intensity]]) };
  }
  return { kind: "relic", intensity, lordsSpent: reward.lordsExhausted };
};

const requireIntensity = (quality: number): Intensity => {
  if (quality === 0 || quality === 1 || quality === 2 || quality === 3) return quality;
  throw new Error(`Unknown chest quality ${quality}`);
};
