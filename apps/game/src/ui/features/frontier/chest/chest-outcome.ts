import type { Intensity } from "@/ui/motion/motion-scale";

/**
 * The agreed chest facts (backend shapes v3 with the LORDS delta). The chest train's generated rows replace these two
 * types when it lands; the reader below stays.
 */
interface ChestRewardFacts {
  kind: "Relic" | "Token";
  /** 0 common · 1 uncommon · 2 rare · 3 epic. */
  quality: number;
  /** A LORDS roll the season's budget could not pay, given as a relic of the same quality. */
  lords_exhausted: boolean;
}
interface ChestRulesFacts {
  /** Whole LORDS a Token pays, by quality. */
  lords_amounts: { common: bigint; uncommon: bigint; rare: bigint; epic: bigint };
}

export type ChestOutcome =
  | { kind: "lords"; intensity: Intensity; lords: number }
  | { kind: "relic"; intensity: Intensity; lordsSpent: boolean };

const TIERS = ["common", "uncommon", "rare", "epic"] as const;

/** What an opened chest gave, read from its story and the game's own amounts table; an unknown quality is an error. */
export const readChestOutcome = (reward: ChestRewardFacts, rules: ChestRulesFacts): ChestOutcome => {
  const intensity = requireIntensity(reward.quality);
  if (reward.kind === "Token") {
    if (reward.lords_exhausted) throw new Error("A LORDS chest cannot be marked unpaid: an unpaid roll is a relic");
    return { kind: "lords", intensity, lords: Number(rules.lords_amounts[TIERS[intensity]]) };
  }
  return { kind: "relic", intensity, lordsSpent: reward.lords_exhausted };
};

const requireIntensity = (quality: number): Intensity => {
  if (quality === 0 || quality === 1 || quality === 2 || quality === 3) return quality;
  throw new Error(`Unknown chest quality ${quality}`);
};
