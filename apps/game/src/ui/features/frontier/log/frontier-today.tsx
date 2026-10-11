import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type ProcessedStoryEvent, useStoryEvents } from "@/hooks/store/use-story-events-store";
import type { readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { dayBounds, dayClock } from "../hud/day-clock";
import { useDockArmies } from "../hud/dock-armies";
import { ownStoriesOfDay, totalToday } from "./today-totals";
import { type LogLine, TodaySheet } from "./today-sheet";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

/** How many of the player's own stories the log reads: a few days of play. */
const OWN_STORIES = 350;

/**
 * Today over the player's own stories: today's totals (the ruin's LORDS among them) and log, stepping back through
 * earlier days, and today's armies with a tier their XP can buy, the row opening the first of them.
 */
export const FrontierToday = ({
  rules,
  realm,
  onOpenArmy,
  onClose,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  /** Opens an army's sheet, for the row of armies with a tier to buy. */
  onOpenArmy: (explorerId: number) => void;
  onClose: () => void;
}) => {
  const now = useNowSeconds();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const stories = useStoryEvents(OWN_STORIES, undefined, player ?? undefined);
  const today = dayClock(rules, now).day;
  const [chosen, setChosen] = useState<number | null>(null);
  const day = chosen ?? today;
  const bounds = day === undefined ? null : dayBounds(rules, now, day);
  const span = bounds && { startMs: bounds.start * 1_000, endMs: bounds.end * 1_000 };
  const own = player && span ? ownStoriesOfDay(stories.data, player, span) : [];
  // Unknown until the stories answer: every total shows as a dash, never a zero.
  const totals = player && span && !stories.isPending ? totalToday(stories.data, player, span) : undefined;
  const step = (to: number) => setChosen(to === today ? null : to);
  const buyers = useDockArmies(realm).filter(({ canBuyTier }) => canBuyTier);
  return (
    <TodaySheet
      day={day}
      today={day === today}
      totals={{ ...unknownTotals, ...totals }}
      lines={own.map(logLine)}
      armiesToUpgrade={day === today ? buyers.length : undefined}
      onArmies={buyers[0] ? () => onOpenArmy(buyers[0]!.explorerId) : undefined}
      failed={stories.isError}
      onRetry={() => void stories.refetch()}
      onEarlier={day !== undefined && day > 1 ? () => step(day - 1) : undefined}
      onLater={day !== undefined && today !== undefined && day < today ? () => step(day + 1) : undefined}
      onClose={onClose}
    />
  );
};

const unknownTotals = {
  reveals: undefined,
  cleared: undefined,
  chests: undefined,
  essence: undefined,
  labor: undefined,
  lords: undefined,
};

const logLine = (story: ProcessedStoryEvent): LogLine => ({
  id: story.id,
  at: Math.floor(story.timestampMs / 1_000),
  text: story.presentation.title,
});
