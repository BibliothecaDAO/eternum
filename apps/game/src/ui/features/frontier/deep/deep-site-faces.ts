import { DEEP_SITE_MEANINGS } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { DEEP_WORDS } from "@/ui/design-system/kit/words";
import { nativeRuleConstants, type DeepSiteView, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { deepSites } from "@bibliothecadao/types";

export type DeepPay = keyof typeof DEEP_WORDS.kinds;

/**
 * Each Deep site's painting and who it serves, keyed by the Deep's catalog: the site card reads it, and a site the
 * game adds has no card until it has its row.
 */
export const DEEP_SITE_FACES = {
  foundation: { icon: DEEP_SITE_MEANINGS.foundation, purpose: DEEP_WORDS.purpose.foundation },
  core: { icon: DEEP_SITE_MEANINGS.core, purpose: DEEP_WORDS.purpose.core },
  mine: { icon: DEEP_SITE_MEANINGS.mine, purpose: DEEP_WORDS.purpose.mine },
  altar: { icon: DEEP_SITE_MEANINGS.altar, purpose: DEEP_WORDS.purpose.altar },
} as const satisfies Record<(typeof deepSites)[number]["key"], { icon: IconMeaning; purpose: string }>;

export function readDeepSitePays(
  store: Pick<NativeFactStore, "get" | "absenceKnown">,
  game_id: number,
  kind: number,
): DeepPay[] | null {
  const race = store.get("RaceRules", { game_id });
  if (!race && !store.absenceKnown("RaceRules", { game_id }).known) return null;
  const banes = store.get("BaneRules", { game_id });
  if (!banes && !store.absenceKnown("BaneRules", { game_id }).known) return null;
  const resources = kind === nativeRuleConstants.DEEP_CORE || kind === nativeRuleConstants.DEEP_MINE;
  const pays: (DeepPay | false)[] = [
    !resources && Boolean(race) && "glory",
    Boolean(race) && kind === nativeRuleConstants.DEEP_FOUNDATION && "height",
    kind === nativeRuleConstants.DEEP_CORE && "essence",
    kind === nativeRuleConstants.DEEP_MINE && "labor",
    Boolean(banes) && kind === nativeRuleConstants.DEEP_ALTAR && "bar",
  ];
  return pays.filter((pay): pay is DeepPay => pay !== false);
}

export function deepSitePlatePay(
  store: Pick<NativeFactStore, "get" | "absenceKnown">,
  game_id: number,
  site: Pick<DeepSiteView, "kind" | "buildingPay">,
): string | undefined {
  const pays = readDeepSitePays(store, game_id, site.kind);
  if (!pays) return undefined;
  if (pays.includes("height")) return DEEP_WORDS.foundationPlate(site.buildingPay);
  if (pays.includes("essence")) return DEEP_WORDS.purpose.core;
  if (pays.includes("labor")) return DEEP_WORDS.purpose.mine;
  if (pays.includes("bar")) return DEEP_WORDS.altarPlate;
  return undefined;
}
