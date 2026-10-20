import { type IconMeaning } from "@/ui/design-system/icon";

import { ARMY } from "@/ui/design-system/kit/words";
import { frontierSiteName, StructureType } from "@bibliothecadao/types";
import type { SiteKind } from "@bibliothecadao/eternum";

/** What an army can attack: a guarded site by its kind, or another player's army. */
export type AttackTargetKind = SiteKind | "Army";

/** Each target as every card draws and titles it. */
export const TARGET_MARKS: Record<AttackTargetKind, { word: string; icon: IconMeaning }> = {
  Camp: { word: frontierSiteName(StructureType.Camp), icon: "beast-troll" },
  Rift: { word: frontierSiteName(StructureType.Rift), icon: "rift" },
  Ruin: { word: frontierSiteName(StructureType.Ruin), icon: "ruin" },
  Beasts: { word: frontierSiteName(StructureType.Beasts), icon: "beast-cyclops" },
  Army: { word: ARMY, icon: "attack" },
};

/** Roaming beasts and camps are the creature itself; rifts and ruins retain their landmark's kind. */
export const attackTargetName = (kind: AttackTargetKind, guard?: { name: string }): string =>
  kind === "Army" ? ARMY : frontierSiteName(StructureType[kind], guard);
