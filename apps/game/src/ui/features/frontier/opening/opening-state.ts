import type { OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, OPENING_MOMENTS, type OpeningContext, type OpeningMoment } from "./opening";

export const TUTORIAL_SKIPPED = "tutorial-skipped";

export type TutorialDisplayStatus = "showing" | "completed";

export interface TutorialDisplay {
  readonly moment: OpeningMoment;
  readonly rules: OpeningRules;
  readonly status: TutorialDisplayStatus;
}

export interface ReplayBaseline {
  readonly barracksCount: number;
  readonly deployedArmies: number;
  readonly exploredTiles: number;
}

export const EMPTY_OPENING_CONTEXT: OpeningContext = {
  hasRealm: false,
  hasBarracks: false,
  barracksCount: 0,
  troopsAtHome: 0,
  deployedArmies: 0,
  hasExplored: false,
  exploredTiles: 0,
  hasOpenOathPick: false,
  hasSwornOath: false,
  hasEssence: false,
  canResearch: false,
  hasResearched: false,
  dailyQuestClaimable: false,
  dailyQuestClaimed: false,
  hasWellLore: false,
  hasShrineLore: false,
  isCity: false,
  inEthereal: false,
  inDeep: false,
  hasActiveBane: false,
  hasBrokenBane: false,
  dayEndingSoon: false,
  hyperstructureAdvanced: false,
  fragmentsSold: false,
  outOfStamina: false,
  hasRelic: false,
  openedToday: false,
  openedResearch: false,
  openedSeason: false,
  openedShop: false,
  openedArmy: false,
  isSeasonZeroVeteran: false,
};

export const reachedOnContext = (ctx: OpeningContext | null): OpeningMoment[] =>
  ctx === null ? [] : OPENING_MOMENTS.filter((moment) => OPENING[moment].reachedWhen(ctx));

export const openedMoments = (kept: ReadonlySet<string>, onState: readonly OpeningMoment[]): Set<OpeningMoment> =>
  new Set([...OPENING_MOMENTS.filter((moment) => kept.has(moment)), ...onState]);

const isDueOnContext = (moment: OpeningMoment, ctx: OpeningContext, replayed?: ReadonlySet<string>): boolean => {
  const entry = OPENING[moment];
  if (entry.showsWhen(ctx)) return true;
  return Boolean(replayed?.has(moment) && "replayDueWhen" in entry && entry.replayDueWhen(ctx));
};

export const lowestSinceReplay = (baseline: ReplayBaseline | undefined, ctx: OpeningContext): ReplayBaseline => ({
  barracksCount: Math.min(baseline?.barracksCount ?? ctx.barracksCount, ctx.barracksCount),
  deployedArmies: Math.min(baseline?.deployedArmies ?? ctx.deployedArmies, ctx.deployedArmies),
  exploredTiles: Math.min(baseline?.exploredTiles ?? ctx.exploredTiles, ctx.exploredTiles),
});

const isCompletedDuringReplay = (
  moment: OpeningMoment,
  ctx: OpeningContext,
  baseline: ReplayBaseline | undefined,
): boolean => {
  if (!baseline) return false;
  if (moment === "barracks") return ctx.barracksCount > baseline.barracksCount;
  if (moment === "deploy") return ctx.deployedArmies > baseline.deployedArmies;
  if (moment === "explore") return ctx.exploredTiles > baseline.exploredTiles;
  return false;
};

const isCompletedOnContext = (
  moment: OpeningMoment,
  ctx: OpeningContext,
  isShowing: boolean,
  replayed?: ReadonlySet<string>,
  replayBaseline?: ReplayBaseline,
): boolean => {
  const entry = OPENING[moment];
  if (replayed?.has(moment) && !entry.showsWhen(ctx)) {
    if (isShowing && isCompletedDuringReplay(moment, ctx, replayBaseline)) return true;
    if (isShowing && "completesWhileShowing" in entry && entry.completesWhileShowing(ctx)) return true;
    return false;
  }
  if ("completesWhen" in entry && entry.completesWhen(ctx)) return true;
  if (isShowing && "completesWhileShowing" in entry && entry.completesWhileShowing(ctx)) return true;
  return false;
};

const completedOnContext = (
  ctx: OpeningContext | null,
  showing: OpeningMoment | null,
  seen: ReadonlySet<string>,
  replayed?: ReadonlySet<string>,
  replayBaseline?: ReplayBaseline,
): OpeningMoment[] => {
  if (ctx === null || seen.has(TUTORIAL_SKIPPED)) return [];
  const completed: OpeningMoment[] = [];
  for (const moment of OPENING_MOMENTS) {
    if (seen.has(moment)) continue;
    const isShowing = moment === showing;
    if (!isShowing && replayed?.has(moment)) continue;
    if (isCompletedOnContext(moment, ctx, isShowing, replayed, replayBaseline)) completed.push(moment);
  }
  return completed;
};

export const activeOpeningMoment = (
  ctx: OpeningContext | null,
  rules: OpeningRules | null,
  seen: ReadonlySet<string>,
  replayed?: ReadonlySet<string>,
): OpeningMoment | null => {
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) return null;
  for (const moment of OPENING_MOMENTS) {
    if (seen.has(moment)) continue;
    const entry = OPENING[moment];
    if ("skipForVeteran" in entry && entry.skipForVeteran && ctx.isSeasonZeroVeteran && !replayed?.has(moment))
      continue;
    if (!isDueOnContext(moment, ctx, replayed)) continue;
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
  replayBaseline?: ReplayBaseline;
}): TutorialTransition {
  const { showing, confirmed, ctx, rules, seen, replayed, replayBaseline } = input;
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) {
    return { nextShowing: null, confirmedMoment: null, newlyCompleted: [] };
  }
  const newlyCompleted = completedOnContext(ctx, showing, seen, replayed, replayBaseline);
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
    if (ready && isDueOnContext(showing, ctx, replayed)) {
      return { nextShowing: showing, confirmedMoment: null, newlyCompleted };
    }
  }
  const nextShowing = activeOpeningMoment(ctx, rules, completedSet, replayed);
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
  const replaying = mine && (store.replayed?.size ?? 0) > 0;
  return {
    reached: mine ? store.reached : new Set(),
    seen: mine && store.replayed ? effectiveSeen(rawSeen, store.replayed) : rawSeen,
    known: normalizedOwner === null || replaying || (mine && store.status === "ready"),
    ownsParts: normalizedOwner === null || (mine && (store.status === "ready" || store.onDevice)),
  };
}

export const siteAlertOfferDue = (
  opened: ReadonlySet<OpeningMoment>,
  seen: ReadonlySet<string>,
  known: boolean,
  offer: string,
): boolean => known && opened.has("deep") && !seen.has(offer);
