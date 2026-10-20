import { type IconMeaning } from "@/ui/design-system/icon";

import { ARMY, BEAST_NAMES, RIFT, RUIN, BEASTS } from "@/ui/design-system/kit/words";
import type { SiteKind } from "@bibliothecadao/eternum";

/** What an army can attack: a guarded site by its kind, or another player's army. */
export type AttackTargetKind = SiteKind | "Army";

/** Each target as every card draws and titles it. */
export const TARGET_MARKS: Record<AttackTargetKind, { word: string; icon: IconMeaning }> = {
  Camp: { word: BEAST_NAMES.troll, icon: "beast-troll" },
  Rift: { word: RIFT, icon: "rift" },
  Ruin: { word: RUIN, icon: "ruin" },
  Beasts: { word: BEASTS, icon: "beast-cyclops" },
  Army: { word: ARMY, icon: "attack" },
};
