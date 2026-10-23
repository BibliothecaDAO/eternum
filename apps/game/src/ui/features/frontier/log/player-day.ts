import { useStoryEvents } from "@/hooks/store/use-story-events-store";

import type { DayTotals } from "./day-totals";
import { ownStoriesOfDay, totalToday } from "./today-totals";

/** Herald's largest page of one player's stories: several days of play. */
const OWN_STORIES = 500;

type DayBounds = { start: number; end: number };

/** A day the player's history cannot give: each total a dash, never a zero. */
const UNKNOWN: DayTotals = {
  reveals: undefined,
  cleared: undefined,
  chests: undefined,
  essence: undefined,
  labor: undefined,
  lords: undefined,
};

/**
 * How much of a day the player's history gives: still being read, the read failed, the read stops after the day began
 * (it keeps only the newest stories), or the whole day.
 */
export type DayHistory = "waiting" | "failed" | "short" | "whole";

/**
 * One player's day, from the one read of their own stories in Herald's history: the day's stories in order, how much
 * of the day the read gives, and the day's totals when it gives the whole day; otherwise each total is unknown rather
 * than a part of it. Today and the day-done card both read it, so they agree. (The card once counted the game's newest
 * stories instead, which an hour of everyone's play fills: on prod it showed the leading player 1 reveal for 35.)
 */
export const usePlayerDay = (player: string | null, day: DayBounds | null) => {
  const owner = player === null ? undefined : `0x${BigInt(player).toString(16)}`;
  const stories = useStoryEvents(OWN_STORIES, undefined, owner);
  const span = day && { startMs: day.start * 1_000, endMs: day.end * 1_000 };
  const history = dayHistory(stories, day);
  return {
    stories: player && span ? ownStoriesOfDay(stories.data, player, span) : [],
    history,
    totals: player && span && history === "whole" ? totalToday(stories.data, player, span) : UNKNOWN,
    retry: () => void stories.refetch(),
  };
};

const dayHistory = (
  read: { isPending: boolean; isError: boolean; holdsSince: number | undefined },
  day: DayBounds | null,
): DayHistory => {
  if (read.isPending) return "waiting";
  if (read.isError || read.holdsSince === undefined) return "failed";
  return day && read.holdsSince > day.start ? "short" : "whole";
};
