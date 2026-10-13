import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { ARMY, CAMP, RIFT, RUIN, STRAGGLERS } from "@/ui/design-system/kit/words";
import type { SiteKind } from "@bibliothecadao/eternum";

/** What an army can attack: a guarded site by its kind, or another player's army. */
export type AttackTargetKind = SiteKind | "Army";

/** Each target as every card draws and titles it. */
export const TARGET_MARKS: Record<AttackTargetKind, { word: string; icon: IconCode }> = {
  Camp: { word: CAMP, icon: "Cp" },
  Rift: { word: RIFT, icon: "Rf" },
  Ruin: { word: RUIN, icon: "Fr" },
  Stragglers: { word: STRAGGLERS, icon: "Tr" },
  Army: { word: ARMY, icon: "At" },
};
