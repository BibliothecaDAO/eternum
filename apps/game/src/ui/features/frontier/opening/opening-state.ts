import type { OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, OPENING_MOMENTS, type OpeningContext, type OpeningMoment } from "./opening";

export const TUTORIAL_SKIPPED = "tutorial:skipped";

export const EMPTY_OPENING_CONTEXT: OpeningContext = {
  hasRealm: false,
  hasBarracks: false,
  troopsAtHome: 0,
  deployedArmies: 0,
  hasExplored: false,
  hasOpenOathPick: false,
  hasSwornOath: false,
  hasEssence: false,
  hasResearched: false,
  dailyQuestClaimable: false,
  hasWellLore: false,
  hasShrineLore: false,
  isCity: false,
  inEthereal: false,
  inDeep: false,
  hasActiveBane: false,
  hyperstructureAdvanced: false,
  fragmentsSold: false,
  outOfStamina: false,
  hasRelic: false,
  isSeasonZeroVeteran: false,
};

export const reachedOnContext = (ctx: OpeningContext | null): OpeningMoment[] =>
  ctx === null ? [] : OPENING_MOMENTS.filter((moment) => OPENING[moment].reachedWhen(ctx));

export const openedMoments = (kept: ReadonlySet<string>, onState: readonly OpeningMoment[]): Set<OpeningMoment> =>
  new Set([...OPENING_MOMENTS.filter((moment) => kept.has(moment)), ...onState]);

export const activeOpeningMoment = (
  ctx: OpeningContext | null,
  rules: OpeningRules | null,
  seen: ReadonlySet<string>,
): OpeningMoment | null => {
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) return null;
  for (const moment of OPENING_MOMENTS) {
    if (seen.has(moment)) continue;
    const entry = OPENING[moment];
    if ("skipForVeteran" in entry && entry.skipForVeteran && ctx.isSeasonZeroVeteran) continue;
    if (!entry.showsWhen(ctx)) continue;
    if ("readyWhen" in entry && !entry.readyWhen(rules)) continue;
    return moment;
  }
  return null;
};

export const effectiveSeen = (seen: ReadonlySet<string>, replayed: ReadonlySet<string>): ReadonlySet<string> => {
  if (replayed.size === 0) return seen;
  const result = new Set<string>();
  for (const item of seen) {
    if (!replayed.has(item)) result.add(item);
  }
  return result;
};

export function accountProgress(
  owner: string | null,
  store: {
    owner: string | null;
    status: "signed-out" | "loading" | "ready" | "error";
    reached: ReadonlySet<string>;
    seen: ReadonlySet<string>;
    replayed?: ReadonlySet<string>;
    onDevice: boolean;
  },
): { reached: ReadonlySet<string>; seen: ReadonlySet<string>; known: boolean; ownsParts: boolean } {
  const mine = store.owner === owner;
  const rawSeen = mine ? store.seen : new Set<string>();
  return {
    reached: mine ? store.reached : new Set(),
    seen: mine && store.replayed ? effectiveSeen(rawSeen, store.replayed) : rawSeen,
    known: owner === null || (mine && store.status === "ready"),
    ownsParts: owner === null || (mine && (store.status === "ready" || store.onDevice)),
  };
}

export const siteAlertOfferDue = (
  opened: ReadonlySet<OpeningMoment>,
  seen: ReadonlySet<string>,
  known: boolean,
  offer: string,
): boolean => known && opened.has("deep") && !seen.has(offer);
