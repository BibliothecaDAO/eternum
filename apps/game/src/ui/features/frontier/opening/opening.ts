import type { AspectId } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import type { OpeningRules } from "@/ui/design-system/kit/words";

export interface OpeningContext {
  readonly hasRealm: boolean;
  readonly hasBarracks: boolean;
  readonly barracksCount: number;
  readonly troopsAtHome: number;
  readonly deployedArmies: number;
  readonly hasExplored: boolean;
  readonly exploredTiles: number;
  readonly hasOpenOathPick: boolean;
  readonly hasSwornOath: boolean;
  readonly hasEssence: boolean;
  readonly canResearch: boolean;
  readonly hasResearched: boolean;
  readonly dailyQuestClaimable: boolean;
  readonly dailyQuestClaimed: boolean;
  readonly hasWellLore: boolean;
  readonly hasShrineLore: boolean;
  readonly isCity: boolean;
  readonly inEthereal: boolean;
  readonly inDeep: boolean;
  readonly hasActiveBane: boolean;
  readonly hasBrokenBane: boolean;
  readonly dayEndingSoon: boolean;
  readonly hyperstructureAdvanced: boolean;
  readonly fragmentsSold: boolean;
  readonly outOfStamina: boolean;
  readonly hasRelic: boolean;
  readonly openedToday: boolean;
  readonly openedSeason: boolean;
  readonly openedShop: boolean;
  readonly openedArmy: boolean;
  readonly isSeasonZeroVeteran: boolean;
}

type OpeningTeacher = AspectId | "own";

interface OpeningEntry {
  readonly icon: IconMeaning;
  readonly teacher: OpeningTeacher;
  readonly parts: readonly string[];
  readonly replayDueWhen?: (ctx: OpeningContext) => boolean;
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
    completesWhileShowing: (ctx) => ctx.openedSeason,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  barracks: {
    icon: "barracks",
    teacher: 2,
    parts: ["building-list"],
    replayDueWhen: (ctx) => ctx.hasRealm,
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.hasBarracks,
    showsWhen: (ctx) => ctx.hasRealm && !ctx.hasBarracks && !ctx.inDeep && !ctx.inEthereal,
    completesWhen: (ctx) => ctx.hasBarracks,
  },
  deploy: {
    icon: "knight-t1",
    teacher: 1,
    parts: [],
    replayDueWhen: (ctx) => ctx.hasRealm && ctx.hasBarracks && ctx.troopsAtHome > 0,
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.deployedArmies > 0,
    showsWhen: (ctx) => ctx.hasRealm && ctx.hasBarracks && ctx.troopsAtHome > 0 && ctx.deployedArmies === 0,
    completesWhen: (ctx) => ctx.deployedArmies > 0,
  },
  explore: {
    icon: "explore",
    teacher: 4,
    parts: [],
    replayDueWhen: (ctx) => ctx.deployedArmies > 0,
    skipForVeteran: true,
    reachedWhen: (ctx) => ctx.hasExplored,
    showsWhen: (ctx) => ctx.deployedArmies > 0 && !ctx.hasExplored,
    completesWhen: (ctx) => ctx.hasExplored,
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
    showsWhen: (ctx) => ctx.canResearch && !ctx.hasResearched,
    completesWhen: (ctx) => ctx.hasResearched,
  },
  "day-end": {
    icon: "hourglass",
    teacher: "own",
    parts: [],
    reachedWhen: (ctx) => ctx.hasRealm && ctx.dayEndingSoon,
    showsWhen: (ctx) => ctx.hasRealm && ctx.dayEndingSoon,
    completesWhileShowing: (ctx) => ctx.openedToday,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  bane: {
    icon: "flame",
    teacher: 3,
    parts: ["bane-row"],
    reachedWhen: (ctx) => ctx.hasActiveBane || ctx.hasBrokenBane,
    showsWhen: (ctx) => ctx.hasActiveBane && ctx.deployedArmies > 0,
    completesWhileShowing: (ctx) => ctx.openedToday,
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
    parts: ["aspects"],
    reachedWhen: (ctx) => ctx.inDeep || ctx.hasActiveBane || ctx.hyperstructureAdvanced,
    showsWhen: (ctx) => ctx.hasExplored && (ctx.inDeep || ctx.hasActiveBane || ctx.hyperstructureAdvanced),
    completesWhileShowing: (ctx) => ctx.openedSeason,
    readyWhen: (rules) => rules.ownAspect !== undefined,
  },
  spire: {
    icon: "spire",
    teacher: 4,
    parts: [],
    reachedWhen: (ctx) => ctx.inEthereal,
    showsWhen: (ctx) => ctx.inEthereal,
  },
  shop: {
    icon: "fragment",
    teacher: 2,
    parts: ["fragments-chip"],
    reachedWhen: (ctx) => ctx.fragmentsSold && ctx.outOfStamina,
    showsWhen: (ctx) => ctx.fragmentsSold && ctx.outOfStamina,
    completesWhileShowing: (ctx) => ctx.openedShop,
  },
  relic: {
    icon: "relics",
    teacher: 4,
    parts: ["relic-slots"],
    reachedWhen: (ctx) => ctx.hasRelic,
    showsWhen: (ctx) => ctx.hasRelic,
    completesWhileShowing: (ctx) => ctx.openedArmy,
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
