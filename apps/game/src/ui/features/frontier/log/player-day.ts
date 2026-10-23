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
 * One player's day, from the one read of their own stories in Herald's history: the day's stories in order, and its
 * totals once the read has answered and reaches back to the day's start; until then, or for a day the read cannot reach,
 * each total is unknown rather than a part of it. Today and the day-done card both read it, so they agree. (The card
 * once counted the game's newest stories instead, which an hour of everyone's play fills: on prod it showed the leading
 * player 1 reveal for 35.)
 */
export const usePlayerDay = (player: string | null, day: DayBounds | null) => {
  const owner = player === null ? undefined : `0x${BigInt(player).toString(16)}`;
  const stories = useStoryEvents(OWN_STORIES, undefined, owner);
  const span = day && { startMs: day.start * 1_000, endMs: day.end * 1_000 };
  const reached =
    day !== null && stories.isSuccess && stories.holdsSince !== undefined && stories.holdsSince <= day.start;
  return {
    stories: player && span ? ownStoriesOfDay(stories.data, player, span) : [],
    totals: player && span && reached ? totalToday(stories.data, player, span) : UNKNOWN,
    /** The read has answered, or failed. */
    settled: !stories.isPending,
    failed: stories.isError,
    retry: () => void stories.refetch(),
  };
};
