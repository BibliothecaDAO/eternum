import type { Intensity } from "@/ui/motion/motion-scale";

/** What a chest gave, as the chest moment tells it. */
export type ChestOutcome =
  | { kind: "lords"; intensity: Intensity; lords: number }
  | { kind: "relic"; intensity: Intensity };
