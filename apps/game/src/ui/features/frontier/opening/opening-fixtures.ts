import { nativeOathConstants, nativeResearchConstants } from "@bibliothecadao/eternum/game-client";
import { rankName } from "@bibliothecadao/types";
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
  shrineLoreRank: rankName(nativeResearchConstants.SHRINE_LORE_LEVEL),
  exploreStamina: 20,
  dayLeftSeconds: 1_800,
};
