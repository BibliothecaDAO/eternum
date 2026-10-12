import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { CAMP, RIFT, RUIN, STRAGGLERS } from "@/ui/design-system/kit/words";
import type { SiteKind } from "@bibliothecadao/eternum";

/** Each guarded site as every card draws and titles it. */
export const SITE_MARKS: Record<SiteKind, { word: string; icon: IconCode }> = {
  Camp: { word: CAMP, icon: "Cp" },
  Rift: { word: RIFT, icon: "Rf" },
  Ruin: { word: RUIN, icon: "Fr" },
  Stragglers: { word: STRAGGLERS, icon: "Tr" },
};
