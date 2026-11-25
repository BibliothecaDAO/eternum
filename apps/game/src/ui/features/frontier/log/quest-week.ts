import { questWeek, safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { questCatalog } from "@bibliothecadao/types";

import { dayQuestFace } from "../day/day-quest-face";
import type { DayQuestFace } from "../day/quest-dock-view";

/** One day of the quest week: its quest, whether it has passed, is today or is ahead, and whether its reward was taken. */
export interface WeekDay {
  /** The day as the player counts it, from 1. */
  day: number;
  quest: DayQuestFace;
  when: "past" | "today" | "ahead";
  collected: boolean;
}

/** The seven quests of the week today falls in (the draw is the game's, the same for every realm of the game). */
export function readQuestWeek(
  store: NativeFactStore,
  game_id: number,
  home: number | bigint,
  todayIndex: number,
): WeekDay[] {
  const { seed } = store.require("GameRegistry", { game_id });
  return questWeek(seed, todayIndex).map(({ day, quest }) => {
    const id = questCatalog.find(({ id }) => id === quest)?.id;
    if (id === undefined) throw new Error(`Missing quest ${quest}`);
    return {
      day: day + 1,
      quest: dayQuestFace(id),
      when: day < todayIndex ? "past" : day === todayIndex ? "today" : "ahead",
      collected: store.get("LaborGrant", { game_id, home: safeInteger(home), day }) !== undefined,
    };
  });
}
