import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { orders } from "@bibliothecadao/types";

import type { DayBannerProps, DayHead } from "./day-banner-view";

const noop = () => {};
const base = { collecting: false, onCollect: noop, onOpenClaim: noop };
const camps = { icon: "beast-troll", name: "Camp-breakers", unit: "camps" } as const;
const stand = { icon: "defend", name: "The Stand", unit: "sites" } as const;
const reward = { labor: 1_500, essence: 150 };
const claim = { labor: 1_000, essence: 100 };

const bloodMoon: DayHead = {
  tone: "warn",
  icon: "moon",
  eyebrow: "World bane",
  name: "Blood Moon",
  rule: "Guards hit 25% harder today",
};
const rival: DayHead = {
  tone: "bad",
  icon: "hyperstructure",
  eyebrow: "Bane from Might",
  name: "Might's bane",
  rule: "Cast by a rival Aspect against yours",
  crests: orders.slice(0, 4).map(({ orderId }) => orderMeaning(orderId)),
};
const triumph: DayHead = {
  tone: "good",
  icon: "eye",
  eyebrow: "Triumph",
  name: "Clear Mist",
  rule: "Your Aspect reveals 50% more tiles today",
};

/** The banner's states on fixtures of its props: what the lab draws and the test asserts. Layout is the caller's. */
export const DAY_BANNER_CASES = {
  "Quest running": {
    ...base,
    quest: camps,
    reading: { progress: 1, target: 2, reward, state: "running" },
    heads: [],
    members: null,
    claim,
  },
  "Quest done, Collect waits": {
    ...base,
    quest: camps,
    reading: { progress: 2, target: 2, reward, state: "done" },
    heads: [],
    members: null,
    claim,
  },
  "Quest collected, claim made": {
    ...base,
    quest: camps,
    reading: { progress: 2, target: 2, reward, state: "collected" },
    heads: [],
    members: null,
    claim: null,
  },
  "World bane day, members at it": {
    ...base,
    quest: stand,
    reading: { progress: 1, target: 3, reward, state: "running" },
    heads: [bloodMoon],
    members: { completed: 4, required: 6 },
    claim,
  },
  "World bane ended, second reward": {
    ...base,
    quest: stand,
    reading: { progress: 3, target: 3, reward, state: "again" },
    heads: [bloodMoon, triumph],
    members: { ended: "Your Aspect ended the bane", endedShort: "Ended" },
    claim: null,
  },
  "Rival bane and Triumph": {
    ...base,
    quest: camps,
    reading: { progress: 0, target: 2, reward, state: "running" },
    heads: [rival, triumph],
    members: { completed: 1, required: 6 },
    claim,
  },
  "Facts not settled": { ...base, quest: camps, reading: null, heads: [], members: null, claim },
} as const satisfies Record<string, Omit<DayBannerProps, "layout">>;
