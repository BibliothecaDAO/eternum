import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { fightConcludedBy, oneStoryPerAction } from "@/ui/features/event-feed/event-stories";
import type { readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { type ReactNode, useState } from "react";

import { QuestWeek } from "../day/quest-week";
import { dayBounds, dayClock, seasonDay } from "../hud/day-clock";
import { useDockArmies } from "../hud/dock-armies";
import { useDayShare } from "../rollover/day-share-sheet";
import { dayLogLine } from "./day-line";
import { usePlayerDay } from "./player-day";
import { type LogLine, TodaySheet } from "./today-sheet";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

/**
 * Today over the stories of the realm's owner: the player's own realm, or the one a spectator watches. Today's totals
 * (the ruin's LORDS among them) and log, stepping back through earlier days, and, for the player's own realm, the
 * week's quests, today's armies with a tier their XP can buy, the row opening the first of them, and on an earlier day
 * they played the way to share it.
 */
export const FrontierToday = ({
  rules,
  realm,
  dayEnd,
  onOpenArmy,
  onClose,
}: {
  rules: ExpeditionRules;
  /** The realm whose day this is: the player's own, or the one watched. */
  realm: NativeRows["Structure"] | null;
  /** The player's own day end (DayEndBlock); none for a realm that is not theirs. */
  dayEnd?: ReactNode;
  /** Opens an army's sheet, for the row of armies with a tier to buy; none for a realm that is not the player's. */
  onOpenArmy?: (explorerId: number) => void;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const player = realm ? `0x${BigInt(realm.owner).toString(16)}` : null;
  const clock = dayClock(rules, now);
  const season = seasonDay(rules, now);
  const today = clock.day;
  const [chosen, setChosen] = useState<number | null>(null);
  const day = chosen ?? today;
  // Only a read that answered and reaches the day counts, an empty day as zero; otherwise every total is a dash.
  const played = usePlayerDay(player, day === undefined ? null : dayBounds(rules, now, day));
  const step = (to: number) => setChosen(to === today ? null : to);
  const ended = day !== undefined && today !== undefined && day < today;
  const { onShare, sheet } = useDayShare(realm, ended ? day : undefined, played);
  const buyers = useDockArmies(onOpenArmy ? realm : null).filter(({ canSpendSkillPoint }) => canSpendSkillPoint);
  return (
    <>
      <TodaySheet
        day={day}
        lastDay={season?.lastDay}
        today={day === today}
        clock={clock}
        totals={played.totals}
        dayEnd={dayEnd}
        week={onOpenArmy && realm && <QuestWeek realm={realm} />}
        lines={logLines(played.stories, setup.store)}
        armiesToUpgrade={onOpenArmy && day === today ? buyers.length : undefined}
        onArmies={onOpenArmy && buyers[0] ? () => onOpenArmy(buyers[0]!.explorerId) : undefined}
        history={played.history}
        onRetry={played.retry}
        onShare={onShare}
        onEarlier={day !== undefined && day > 1 ? () => step(day - 1) : undefined}
        onLater={day !== undefined && today !== undefined && day < today ? () => step(day + 1) : undefined}
        onClose={onClose}
      />
      {sheet}
    </>
  );
};

/** The day's stories as its log: each action once, in Frontier's own line, a clear with the attack that won it. */
const logLines = (stories: readonly ProcessedStoryEvent[], store: NativeFactStore): LogLine[] =>
  oneStoryPerAction(stories).map((story) => ({
    id: story.id,
    at: Math.floor(story.timestampMs / 1_000),
    text: dayLogLine(story, store, fightConcludedBy(story, stories)),
  }));
