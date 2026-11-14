import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { aspects, orders } from "@bibliothecadao/types";
import { nativeQuestConstants as quest } from "@bibliothecadao/eternum/game-client";
import { dayQuestFace } from "./day-quest-face";

import type { DayBannerProps, DayHead } from "./day-banner-view";

const noop = () => {};
const base = { collecting: false, onCollect: noop, onOpenClaim: noop };
/** Realm levels by index: Settlement, City, Kingdom, Empire. */
type Level = 0 | 1 | 2 | 3;
const LABOR_BONUS = 1.5;

/** A quest's reward (frozen design): 1,000 labor and 1,500 Essence, ×2 at each Realm level, 150% of the labor with the bonus. */
const rewardOf = (level: Level, bonus: boolean) => ({
  labor: 1_000 * 2 ** level * (bonus ? LABOR_BONUS : 1),
  essence: 1_500 * 2 ** level,
});

/** Each bane quest's count by Realm level (frozen design, Banes and Triumphs); a daily quest's is its base × the level. */
const COUNTS = {
  stand: [3, 6, 9, 12],
  lights: [20, 40, 60, 80],
  cull: [2_500, 6_000, 10_000, 15_000],
} as const;
const dailyCount = (base: number, level: Level) => base * (level + 1);

/** A bane day's quest is the bane's own: Blood Moon the Stand, Mist Tide the Lights, a rival's the Cull. */
const camps = dayQuestFace(quest.CAMPS);
const stand = { icon: "defend", name: "The Stand", unit: "sites" } as const;
const lights = { icon: "sun", name: "The Lights", unit: "tiles" } as const;
const cull = { icon: "skull", name: "The Cull", unit: "troops" } as const;

/** The daily claim waiting at the home: one claim of 1,000 labor. */
const claim = { labor: 1_000 };

/** The Aspect's four Order crests, from the catalog: every Order that plays for it. */
const crestsOf = (aspect: (typeof aspects)[number]) =>
  orders.filter((order) => order.aspect === aspect.id).map(({ orderId }) => orderMeaning(orderId));
const might = aspects[0];

const bloodMoon: DayHead = {
  tone: "warn",
  icon: "moon",
  eyebrow: "World bane",
  name: "Blood Moon",
  rule: "Each guarded site is 50% harder today",
};
const mistTide: DayHead = {
  tone: "warn",
  icon: "waves",
  eyebrow: "World bane",
  name: "Mist Tide",
  rule: "Stamina comes back at 50% today",
};
const rival: DayHead = {
  tone: "bad",
  icon: "hyperstructure",
  eyebrow: `Bane from ${might.name}`,
  name: `${might.name}'s bane`,
  rule: "Your Aspect's hyperstructure does not grow today",
  crests: crestsOf(might),
};
const triumph: DayHead = {
  tone: "good",
  icon: "eye",
  eyebrow: "Triumph",
  name: "Clear Mist",
  rule: "A reveal finds something 2 times as often today",
};

/** The banner's states on fixtures of its props: what the lab draws and the test asserts. Layout is the caller's. */
export const DAY_BANNER_CASES = {
  "Quest running": {
    ...base,
    quest: camps,
    reading: { progress: 1, target: dailyCount(1, 1), reward: rewardOf(1, false), state: "running" },
    heads: [],
    members: null,
    claim,
  },
  "Quest done, Collect waits": {
    ...base,
    quest: camps,
    reading: { progress: 2, target: dailyCount(1, 1), reward: rewardOf(1, false), state: "done" },
    heads: [],
    members: null,
    claim,
  },
  "Quest collected, claim made": {
    ...base,
    quest: camps,
    reading: { progress: 2, target: dailyCount(1, 1), reward: rewardOf(1, false), state: "collected" },
    heads: [],
    members: null,
    claim: null,
  },
  "World bane day, members at it": {
    ...base,
    quest: stand,
    reading: { progress: 1, target: COUNTS.stand[0], reward: rewardOf(0, true), state: "running" },
    heads: [bloodMoon],
    members: { completed: 4, required: 6 },
    claim,
  },
  "World bane ended, second reward": {
    ...base,
    quest: lights,
    reading: { progress: COUNTS.lights[2], target: COUNTS.lights[2], reward: rewardOf(2, false), state: "again" },
    heads: [mistTide, triumph],
    members: { ended: "Your Aspect ended the bane", endedShort: "Ended" },
    claim: null,
  },
  "Rival bane and Triumph": {
    ...base,
    quest: cull,
    reading: { progress: 0, target: COUNTS.cull[1], reward: rewardOf(1, false), state: "running" },
    heads: [rival, triumph],
    members: { completed: 1, required: 6 },
    claim,
  },
  "Facts not settled": { ...base, quest: camps, reading: null, heads: [], members: null, claim },
} as const satisfies Record<string, Omit<DayBannerProps, "layout">>;
