import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import { dayBounds, dayClock } from "../hud/day-clock";
import { useDockArmies } from "../hud/dock-armies";
import { dayLogLine } from "./day-line";
import { usePlayerDay } from "./player-day";
import { type LogLine, TodaySheet } from "./today-sheet";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

/**
 * Today over the stories of the realm's owner: the player's own realm, or the one a spectator watches. Today's totals
 * (the ruin's LORDS among them) and log, stepping back through earlier days, and, for the player's own realm, today's
 * armies with a tier their XP can buy, the row opening the first of them.
 */
export const FrontierToday = ({
  rules,
  realm,
  onOpenArmy,
  onClose,
}: {
  rules: ExpeditionRules;
  /** The realm whose day this is: the player's own, or the one watched. */
  realm: NativeRows["Structure"] | null;
  /** Opens an army's sheet, for the row of armies with a tier to buy; none for a realm that is not the player's. */
  onOpenArmy?: (explorerId: number) => void;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const player = realm ? `0x${BigInt(realm.owner).toString(16)}` : null;
  const clock = dayClock(rules, now);
  const today = clock.day;
  const [chosen, setChosen] = useState<number | null>(null);
  const day = chosen ?? today;
  // Only a read that answered and reaches the day counts, an empty day as zero; otherwise every total is a dash.
  const played = usePlayerDay(player, day === undefined ? null : dayBounds(rules, now, day));
  const step = (to: number) => setChosen(to === today ? null : to);
  const buyers = useDockArmies(onOpenArmy ? realm : null).filter(({ canSpendSkillPoint }) => canSpendSkillPoint);
  return (
    <TodaySheet
      day={day}
      today={day === today}
      clock={clock}
      totals={played.totals}
      lines={logLines(played.stories, setup.store)}
      armiesToUpgrade={onOpenArmy && day === today ? buyers.length : undefined}
      onArmies={onOpenArmy && buyers[0] ? () => onOpenArmy(buyers[0]!.explorerId) : undefined}
      history={played.history}
      onRetry={played.retry}
      onEarlier={day !== undefined && day > 1 ? () => step(day - 1) : undefined}
      onLater={day !== undefined && today !== undefined && day < today ? () => step(day + 1) : undefined}
      onClose={onClose}
    />
  );
};

/** The day's stories as its log: each in Frontier's own line, less the ones that only repeat another. */
const logLines = (stories: readonly ProcessedStoryEvent[], store: NativeFactStore): LogLine[] =>
  stories.flatMap((story) => {
    const text = dayLogLine(story, store);
    return text === null ? [] : [{ id: story.id, at: Math.floor(story.timestampMs / 1_000), text }];
  });
