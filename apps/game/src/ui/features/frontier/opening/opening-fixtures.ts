import { nativeOathConstants } from "@bibliothecadao/eternum/game-client";
import type { OpeningRules } from "@/ui/design-system/kit/words";

export const OPENING_RULES: OpeningRules = {
  ownAspect: 1,
  knightsPerSecond: 100 / 3_600,
  troopsAtHome: 2_000,
  deepTickSeconds: 120,
  deepLossPerTick: 200,
  oathPassStamina: nativeOathConstants.PASS_STAMINA,
  spireDepthFactor: 2,
  staminaPerSecond: 1 / 60,
  staminaPerFragment: 2,
  relicMinutesPerTier: 30,
  scoutExploreStamina: 10,
  exploreStamina: 20,
  dayLeftSeconds: 1_800,
};
