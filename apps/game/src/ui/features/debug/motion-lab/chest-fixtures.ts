import type { ChestResult } from "@/ui/features/frontier/chest/chest-moment";
import { readChestOutcome } from "@/ui/features/frontier/chest/chest-outcome";
import { relicName } from "@/ui/features/frontier/chest/relic-name";
import type { Intensity } from "@/ui/motion/motion-scale";

/** ChestRules exactly as the agreed shapes carry it (backend shapes v3 with the LORDS delta). */
const CHEST_RULES_ROW = {
  game_id: 2,
  loose_one_in: 46,
  relic_probability: 9_000,
  token_cap: 1,
  lords_amounts: { common: 100n, uncommon: 400n, rare: 1_500n, epic: 6_000n },
  lords_pool: 1_000_000n,
  season_epochs: 70,
};

/** The army the relic's offer is for: its levels now, so the cards show "from → to" and any lost excess. */
const ARMY_LEVELS = { Battle: 2, Scouting: 4, Support: 1 } as const;

export type ChestVariant = "lords" | "relic" | "spent";

/** A ChestReward story row in the agreed shape, and what the moment is told about it. */
export const chestResultFixture = (variant: ChestVariant, intensity: Intensity, index: number): ChestResult => {
  const row = {
    game_id: 2,
    order: 4_096n,
    index,
    player: "0x5a11ab",
    explorer_id: 201,
    epoch: 20_004n,
    depth: 1,
    kind: variant === "lords" ? ("Token" as const) : ("Relic" as const),
    quality: intensity,
    lords_exhausted: variant === "spent",
  };
  const outcome = readChestOutcome(row, CHEST_RULES_ROW);
  if (outcome.kind === "lords") return { outcome };
  return {
    outcome,
    relic: {
      name: relicName([String(row.game_id), String(row.order), String(row.index)]),
      offer: {
        // A relic awards +1 to +4 by its quality, capped at 5.
        amount: intensity + 1,
        choices: Object.entries(ARMY_LEVELS).map(([attribute, level]) => ({
          attribute: attribute as keyof typeof ARMY_LEVELS,
          level,
        })),
      },
    },
  };
};
