import { nativeQuestConstants as quest } from "@bibliothecadao/eternum/game-client";
import { dayQuestFace } from "./day-quest-face";

import type { DayBannerProps } from "./day-banner-view";

const noop = () => {};
const base = { collecting: false, onCollect: noop };
const camps = dayQuestFace(quest.CAMPS);
const reward = { labor: 2_000, essence: 3_000 };

export const DAY_BANNER_CASES = {
  "Quest running": { ...base, quest: camps, reading: { progress: 1, target: 2, reward, state: "running" } },
  "Quest done, Collect waits": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "done" } },
  "Quest collected": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "collected" } },
  "Second reward waits": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "again" } },
  "Facts not settled": { ...base, quest: camps, reading: null },
} as const satisfies Record<string, DayBannerProps>;
