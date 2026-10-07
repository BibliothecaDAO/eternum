import type { ChestResult } from "@/ui/features/frontier/chest/chest-moment";
import { relicName } from "@/ui/features/frontier/chest/relic-name";
import type { Intensity } from "@/ui/motion/motion-scale";

/** A ruin's chest, in whole LORDS by tier at the day price ceiling of 50 a share. */
const LORDS_BY_TIER = [50, 100, 200, 500];

/** Frontier's fixed XP, what a relic chest pays the army whatever its quality. */
const RELIC_XP = 200;

export type ChestVariant = "lords" | "relic";

/** What the chest moment is told about a chest, for the labs. */
export const chestResultFixture = (variant: ChestVariant, intensity: Intensity, index: number): ChestResult => {
  if (variant === "lords") return { outcome: { kind: "lords", intensity, lords: LORDS_BY_TIER[intensity] } };
  return {
    outcome: { kind: "relic", intensity },
    relic: { name: relicName(["0x2", "0x1000", `0x${index.toString(16)}`]), xp: RELIC_XP },
  };
};
