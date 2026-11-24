import type { OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, OPENING_MOMENTS, type OpeningContext, type OpeningMoment } from "./opening";

export const TUTORIAL_SKIPPED = "tutorial:skipped";

export type TutorialDisplayStatus = "showing" | "completed";

export interface TutorialDisplay {
  readonly moment: OpeningMoment;
  readonly rules: OpeningRules;
  readonly status: TutorialDisplayStatus;
}

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
  dailyQuestClaimed: false,
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

const isCompletedOnContext = (moment: OpeningMoment, ctx: OpeningContext, isShowing: boolean): boolean => {
  const entry = OPENING[moment];
  if ("completesWhen" in entry && entry.completesWhen(ctx)) return true;
  if (isShowing && "completesWhileShowing" in entry && entry.completesWhileShowing(ctx)) return true;
  return false;
};

const completedOnContext = (
  ctx: OpeningContext | null,
  showing: OpeningMoment | null,
  seen: ReadonlySet<string>,
  replayed?: ReadonlySet<string>,
): OpeningMoment[] => {
  if (ctx === null || seen.has(TUTORIAL_SKIPPED)) return [];
  const completed: OpeningMoment[] = [];
  for (const moment of OPENING_MOMENTS) {
    if (seen.has(moment)) continue;
    const isShowing = moment === showing;
    if (!isShowing && replayed?.has(moment)) continue;
    if (isCompletedOnContext(moment, ctx, isShowing)) completed.push(moment);
  }
  return completed;
};

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

export interface TutorialTransition {
  readonly nextShowing: OpeningMoment | null;
  readonly confirmedMoment: OpeningMoment | null;
  readonly newlyCompleted: readonly OpeningMoment[];
}

export function stepTutorialMachine(input: {
  showing: OpeningMoment | null;
  confirmed: OpeningMoment | null;
  ctx: OpeningContext | null;
  rules: OpeningRules | null;
  seen: ReadonlySet<string>;
  replayed?: ReadonlySet<string>;
}): TutorialTransition {
  const { showing, confirmed, ctx, rules, seen, replayed } = input;
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) {
    return { nextShowing: null, confirmedMoment: null, newlyCompleted: [] };
  }
  const newlyCompleted = completedOnContext(ctx, showing, seen, replayed);
  const completedSet = new Set<string>(seen);
  for (const moment of newlyCompleted) completedSet.add(moment);

  if (showing !== null && newlyCompleted.includes(showing)) {
    return { nextShowing: null, confirmedMoment: showing, newlyCompleted };
  }
  if (confirmed !== null) {
    return { nextShowing: null, confirmedMoment: confirmed, newlyCompleted };
  }
  if (showing !== null && !completedSet.has(showing)) {
    const entry = OPENING[showing];
    const ready = !("readyWhen" in entry) || entry.readyWhen(rules);
    if (ready && entry.showsWhen(ctx)) {
      return { nextShowing: showing, confirmedMoment: null, newlyCompleted };
    }
  }
  const nextShowing = activeOpeningMoment(ctx, rules, completedSet);
  return { nextShowing, confirmedMoment: null, newlyCompleted };
}

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
  const normalizedOwner = owner || null;
  const mine = (store.owner || null) === normalizedOwner;
  const rawSeen = mine ? store.seen : new Set<string>();
  return {
    reached: mine ? store.reached : new Set(),
    seen: mine && store.replayed ? effectiveSeen(rawSeen, store.replayed) : rawSeen,
    known: normalizedOwner === null || (mine && store.status === "ready"),
    ownsParts: normalizedOwner === null || (mine && (store.status === "ready" || store.onDevice)),
  };
}

export const siteAlertOfferDue = (
  opened: ReadonlySet<OpeningMoment>,
  seen: ReadonlySet<string>,
  known: boolean,
  offer: string,
): boolean => known && opened.has("deep") && !seen.has(offer);
