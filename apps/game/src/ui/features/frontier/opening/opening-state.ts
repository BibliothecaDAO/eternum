import type { OpeningRules } from "@/ui/design-system/kit/words";
import { OPENING, OPENING_MOMENTS, type Opened, type OpeningContext, type OpeningMoment } from "./opening";

export const TUTORIAL_SKIPPED = "tutorial-skipped";

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
  fullArmy: 0,
  deployedArmies: 0,
  hasExplored: false,
  hasOpenOathPick: false,
  hasSwornOath: false,
  hasEssence: false,
  canResearch: false,
  hasResearched: false,
  questRunning: false,
  questProgressed: false,
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
  hasAspectRace: false,
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

export const openedParts = (
  kept: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  onState: readonly OpeningMoment[],
): Opened => (seen.has(TUTORIAL_SKIPPED) ? "all" : openedMoments(kept, onState));

const isCompletedOnContext = (moment: OpeningMoment, ctx: OpeningContext, isShowing: boolean): boolean => {
  const entry = OPENING[moment];
  if ("completesWhen" in entry && entry.completesWhen(ctx)) return true;
  return isShowing && "completesWhileShowing" in entry && entry.completesWhileShowing(ctx);
};

const completedOnContext = (
  ctx: OpeningContext,
  showing: OpeningMoment | null,
  seen: ReadonlySet<string>,
): OpeningMoment[] =>
  OPENING_MOMENTS.filter((moment) => !seen.has(moment) && isCompletedOnContext(moment, ctx, moment === showing));

const isReady = (moment: OpeningMoment, rules: OpeningRules): boolean => {
  const entry = OPENING[moment];
  return !("readyWhen" in entry) || entry.readyWhen(rules);
};

const skipsVeteran = (moment: OpeningMoment, ctx: OpeningContext): boolean => {
  const entry = OPENING[moment];
  return "skipForVeteran" in entry && entry.skipForVeteran && ctx.isSeasonZeroVeteran;
};

export const activeOpeningMoment = (
  ctx: OpeningContext | null,
  rules: OpeningRules | null,
  seen: ReadonlySet<string>,
): OpeningMoment | null => {
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) return null;
  return (
    OPENING_MOMENTS.find(
      (moment) =>
        !seen.has(moment) && !skipsVeteran(moment, ctx) && OPENING[moment].showsWhen(ctx) && isReady(moment, rules),
    ) ?? null
  );
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
}): TutorialTransition {
  const { showing, confirmed, ctx, rules, seen } = input;
  if (ctx === null || rules === null || seen.has(TUTORIAL_SKIPPED)) {
    return { nextShowing: null, confirmedMoment: null, newlyCompleted: [] };
  }
  const newlyCompleted = completedOnContext(ctx, showing, seen);
  if (showing !== null && newlyCompleted.includes(showing)) {
    return { nextShowing: null, confirmedMoment: showing, newlyCompleted };
  }
  if (confirmed !== null) {
    return { nextShowing: null, confirmedMoment: confirmed, newlyCompleted };
  }
  if (showing !== null && !seen.has(showing) && OPENING[showing].showsWhen(ctx) && isReady(showing, rules)) {
    return { nextShowing: showing, confirmedMoment: null, newlyCompleted };
  }
  const nextShowing = activeOpeningMoment(ctx, rules, new Set([...seen, ...newlyCompleted]));
  return { nextShowing, confirmedMoment: null, newlyCompleted };
}

export function accountProgress(
  owner: string | null,
  store: {
    owner: string | null;
    status: "signed-out" | "loading" | "ready" | "error";
    reached: ReadonlySet<string>;
    seen: ReadonlySet<string>;
    onDevice: boolean;
  },
): { reached: ReadonlySet<string>; seen: ReadonlySet<string>; known: boolean; ownsParts: boolean } {
  const normalizedOwner = owner || null;
  const mine = (store.owner || null) === normalizedOwner;
  return {
    reached: mine ? store.reached : new Set(),
    seen: mine ? store.seen : new Set(),
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
