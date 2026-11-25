import { DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { nativeQuestConstants as quest } from "@bibliothecadao/eternum/game-client";
import { dayQuestFace } from "./day-quest-face";

import type { BaneStanding, QuestDockProps } from "./quest-dock-view";

const noop = () => {};
const base = { layout: "desktop", speaker: 1, collecting: false, onCollect: noop, onClose: noop, bane: null } as const;
const camps = dayQuestFace(quest.CAMPS);
const cull = dayQuestFace(quest.CULL);
const reward = { labor: 2_000, essence: 3_000 };
const ashFall: BaneStanding = {
  name: "Ash Fall",
  title: WORDS.worldBaneTitle("Ash Fall"),
  chip: WORDS.productionChip(50),
  effect: WORDS.productionBane(50),
  doubles: true,
  figure: "production",
  percent: 50,
  mark: "▾",
  icon: "bane-world",
  breaking: WORDS.baneBreak(4, 12),
  clears: WORDS.baneClears("5h"),
};

export const QUEST_DOCK_CASES = {
  "Quest running": { ...base, quest: camps, reading: { progress: 1, target: 2, reward, state: "running" } },
  "Quest done, Collect waits": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "done" } },
  "Quest collected": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "collected" } },
  "Second reward waits": { ...base, quest: camps, reading: { progress: 2, target: 2, reward, state: "again" } },
  "Facts not settled": { ...base, quest: camps, reading: null },
  "World bane": {
    ...base,
    speaker: 3,
    quest: cull,
    reading: { progress: 3_000, target: 6_000, reward, state: "running" },
    bane: ashFall,
  },
  "World bane on a phone": {
    ...base,
    layout: "phone",
    speaker: 3,
    quest: cull,
    reading: { progress: 3_000, target: 6_000, reward, state: "running" },
    bane: ashFall,
  },
} as const satisfies Record<string, QuestDockProps>;
