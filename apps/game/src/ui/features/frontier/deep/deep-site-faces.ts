import { DEEP_SITE_MEANINGS } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import type { deepSites } from "@bibliothecadao/types";

/**
 * Each Deep site's painting and who it serves, keyed by the Deep's catalog: the site card reads it, and a site the
 * game adds has no card until it has its row.
 */
export const DEEP_SITE_FACES = {
  foundation: {
    icon: DEEP_SITE_MEANINGS.foundation,
    purpose: DEEP_WORDS.purpose.foundation,
    pays: (buildingPay: number) => DEEP_WORDS.foundationPlate(buildingPay),
  },
  core: { icon: DEEP_SITE_MEANINGS.core, purpose: DEEP_WORDS.purpose.core, pays: () => DEEP_WORDS.purpose.core },
  mine: { icon: DEEP_SITE_MEANINGS.mine, purpose: DEEP_WORDS.purpose.mine, pays: () => DEEP_WORDS.purpose.mine },
  altar: { icon: DEEP_SITE_MEANINGS.altar, purpose: DEEP_WORDS.purpose.altar, pays: () => DEEP_WORDS.altarPlate },
} as const satisfies Record<
  (typeof deepSites)[number]["key"],
  { icon: IconMeaning; purpose: string; pays: (buildingPay: number) => string }
>;
