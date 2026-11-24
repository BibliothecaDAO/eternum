import type { AspectId } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { OpeningRules } from "@/ui/design-system/kit/words";

export interface OpeningContext {
  readonly hasRealm: boolean;
  readonly hasBarracks: boolean;
  readonly troopsAtHome: number;
  readonly deployedArmies: number;
  readonly hasExplored: boolean;
  readonly hasOpenOathPick: boolean;
  readonly hasSwornOath: boolean;
  readonly hasEssence: boolean;
  readonly hasResearched: boolean;
  readonly dailyQuestClaimable: boolean;
  readonly dailyQuestClaimed: boolean;
  readonly hasWellLore: boolean;
  readonly hasShrineLore: boolean;
  readonly isCity: boolean;
  readonly inEthereal: boolean;
  readonly inDeep: boolean;
  readonly hasActiveBane: boolean;
  readonly hyperstructureAdvanced: boolean;
  readonly fragmentsSold: boolean;
  readonly outOfStamina: boolean;
  readonly hasRelic: boolean;
  readonly isSeasonZeroVeteran: boolean;
}

type OpeningTeacher = AspectId | "own";

interface OpeningEntry {
  readonly icon: IconMeaning;
  readonly teacher: OpeningTeacher;
  readonly parts: readonly string[];
  readonly skipForVeteran?: boolean;
  readonly reachedWhen: (ctx: OpeningContext) => boolean;
  readonly showsWhen: (ctx: OpeningContext) => boolean;
  readonly completesWhen?: (ctx: OpeningContext) => boolean;
  readonly completesWhileShowing?: (ctx: OpeningContext) => boolean;
  readonly readyWhen?: (rules: OpeningRules) => boolean;
}

export const OPENING = {
  "season0-welcome": {
    icon: "hyperstructure",
    teacher: "own",
    parts: [],
    reachedWhen: (ctx) => ctx.hasRealm && ctx.isSeasonZeroVeteran,
    showsWhen: (ctx) => ctx.hasRealm && ctx.isSeasonZeroVeteran,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  oath: {
    icon: "shrine",
    teacher: "own",
    parts: [],
    reachedWhen: (ctx) => ctx.hasOpenOathPick || ctx.hasSwornOath,
    showsWhen: (ctx) => ctx.hasOpenOathPick,
    completesWhen: (ctx) => ctx.hasSwornOath,
    completesWhileShowing: (ctx) => !ctx.hasOpenOathPick,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  bane: {
    icon: "flame",
    teacher: 3,
    parts: ["bane-row"],
    reachedWhen: (ctx) => ctx.hasActiveBane,
    showsWhen: (ctx) => ctx.hasActiveBane,
    completesWhileShowing: (ctx) => !ctx.hasActiveBane,
  },
  deep: {
    icon: "depth-3",
    teacher: "own",
    parts: ["glory"],
    reachedWhen: (ctx) => ctx.inDeep,
    showsWhen: (ctx) => ctx.inDeep,
    readyWhen: (rules) => rules.ownAspect !== undefined && rules.deepLossPerTick !== undefined,
  },
  aspects: {
    icon: "hyperstructure",
    teacher: "own",
    parts: [],
    reachedWhen: (ctx) => ctx.inDeep || ctx.hasActiveBane || ctx.hyperstructureAdvanced,
    showsWhen: (ctx) => ctx.inDeep || ctx.hasActiveBane || ctx.hyperstructureAdvanced,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  spire: {
    icon: "spire",
    teacher: 4,
    parts: [],
    reachedWhen: (ctx) => ctx.inEthereal,
    showsWhen: (ctx) => ctx.inEthereal,
  },
  "daily-quest": {
    icon: "crown",
    teacher: 1,
    parts: [],
    reachedWhen: (ctx) => ctx.dailyQuestClaimable || ctx.dailyQuestClaimed,
    showsWhen: (ctx) => ctx.dailyQuestClaimable,
    completesWhen: (ctx) => ctx.dailyQuestClaimed,
  },
  essence: {
    icon: "essence",
    teacher: 2,
    parts: ["essence-store", "research", "today"],
    reachedWhen: (ctx) => ctx.hasEssence,
    showsWhen: (ctx) => ctx.hasEssence && !ctx.hasResearched,
    completesWhen: (ctx) => ctx.hasResearched,
  },
  shop: {
    icon: "fragment",
    teacher: 2,
    parts: [],
    reachedWhen: (ctx) => ctx.fragmentsSold && ctx.outOfStamina,
    showsWhen: (ctx) => ctx.fragmentsSold && ctx.outOfStamina,
  },
  relic: {
    icon: "relics",
    teacher: 4,
    parts: ["relic-slots"],
    reachedWhen: (ctx) => ctx.hasRelic,
    showsWhen: (ctx) => ctx.hasRelic,
  },
  "well-lore": {
    icon: "well",
    teacher: 4,
    parts: [],
    reachedWhen: (ctx) => ctx.hasWellLore,
    showsWhen: (ctx) => ctx.hasWellLore,
  },
  "shrine-lore": {
    icon: "shrine",
    teacher: 4,
    parts: [],
    reachedWhen: (ctx) => ctx.hasShrineLore,
    showsWhen: (ctx) => ctx.hasShrineLore,
  },
  city: {
    icon: "scout-lodge",
    teacher: 2,
    parts: [],
    reachedWhen: (ctx) => ctx.isCity,
    showsWhen: (ctx) => ctx.isCity,
  },
  barracks: {
    icon: "barracks",
    teacher: 2,
    parts: ["building-list"],
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.hasBarracks,
    showsWhen: (ctx) => ctx.hasRealm && !ctx.hasBarracks,
    completesWhen: (ctx) => ctx.hasBarracks,
  },
  deploy: {
    icon: "knight-t1",
    teacher: 1,
    parts: [],
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.deployedArmies > 0,
    showsWhen: (ctx) => ctx.hasRealm && ctx.hasBarracks && ctx.troopsAtHome > 0 && ctx.deployedArmies === 0,
    completesWhen: (ctx) => ctx.deployedArmies > 0,
  },
  explore: {
    icon: "explore",
    teacher: 4,
    parts: [],
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.hasExplored,
    showsWhen: (ctx) => ctx.deployedArmies > 0 && !ctx.hasExplored,
    completesWhen: (ctx) => ctx.hasExplored,
  },
} as const satisfies Record<string, OpeningEntry>;

export type OpeningMoment = keyof typeof OPENING;
export type OpeningPart = (typeof OPENING)[OpeningMoment]["parts"][number];

export const OPENING_MOMENTS = Object.keys(OPENING) as OpeningMoment[];

export const TUTORIAL_WORD_BUDGET = 14;

export const teacherAspectOf = (moment: OpeningMoment, ownAspect: AspectId | undefined): AspectId | null => {
  const teacher = OPENING[moment].teacher;
  return teacher === "own" ? (ownAspect ?? null) : teacher;
};

export type Opened = "all" | ReadonlySet<OpeningMoment>;

export const partShown = (opened: Opened, part: OpeningPart): boolean =>
  opened === "all" ||
  OPENING_MOMENTS.some((moment) => opened.has(moment) && OPENING[moment].parts.some((each) => each === part));
