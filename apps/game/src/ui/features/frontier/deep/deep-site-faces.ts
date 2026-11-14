import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import type { deepSites } from "@bibliothecadao/types";

/**
 * Each Deep site's painting and who it serves, keyed by the Deep's catalog: the site card reads it, and a site the
 * game adds has no card until it has its row.
 */
export const DEEP_SITE_FACES = {
  foundation: { icon: "hyperstructure", purpose: DEEP_WORDS.purpose.foundation },
  quarry: { icon: "pickaxe", purpose: DEEP_WORDS.purpose.quarry },
  altar: { icon: "flame", purpose: DEEP_WORDS.purpose.altar },
} as const satisfies Record<(typeof deepSites)[number]["position"], { icon: IconMeaning; purpose: string }>;
