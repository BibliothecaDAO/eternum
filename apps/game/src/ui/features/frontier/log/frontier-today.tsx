import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { fightConcludedBy, oneStoryPerAction } from "@/ui/features/event-feed/event-stories";
import type { readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { type ReactNode, useState } from "react";

import { dayBounds, dayClock, seasonDay } from "../hud/day-clock";

import { useDayShare } from "../rollover/day-share-sheet";
import { OpeningPartGate } from "../opening/opening-context";
import { readQuestWeek } from "./quest-week";
import { TodayWeek } from "./today-week";
import { dayLogLine } from "./day-line";
import { usePlayerDay } from "./player-day";
import { type LogLine, TodaySheet } from "./today-sheet";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

export const FrontierToday = ({
  rules,
  realm,
  dayEnd,
  own,
  onClose,
}: {
  rules: ExpeditionRules;
  /** The realm whose day this is: the player's own, or the one watched. */
  realm: NativeRows["Structure"] | null;
  /** The player's own day end (DayEndBlock); none for a realm that is not theirs. */
  dayEnd?: ReactNode;
  /** Whether this is the player’s own realm, whose quests can be shown. */
  own?: boolean;
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
  const week =
    own && realm && today !== undefined && day === today ? (
      <OpeningPartGate part="today">
        <TodayWeek week={readQuestWeek(setup.store, realm.game_id, realm.entity_id, today - 1)} />
      </OpeningPartGate>
    ) : undefined;
  return (
    <>
      <TodaySheet
        day={day}
        lastDay={season?.lastDay}
        today={day === today}
        clock={clock}
        totals={played.totals}
        dayEnd={dayEnd}
        week={week}
        lines={logLines(played.stories, setup.store)}
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
