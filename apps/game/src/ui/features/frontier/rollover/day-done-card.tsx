import "./day-done.css";

import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudNotice, HudPanel } from "@/ui/design-system/kit/hud-elements";
import {
  CONTINUE,
  DAY,
  DAY_DONE,
  DAY_DONE_WORDS,
  DAY_SHARE_WORDS,
  DAY_TOTALS_UNKNOWN,
} from "@/ui/design-system/kit/words";

import { oneStoryPerAction } from "../../event-feed/event-stories";
import { FeedLine } from "../../event-feed/feed-line";
import type { DayClock } from "../hud/day-clock";
import { DayGains, type DayGainsReading } from "../log/day-gains";
import type { DayHistory } from "../log/player-day";

const DAY_LINES = 3;

export const DayDoneCard = ({
  endedDay,
  clock,
  gains,
  history,
  stories,
  onRetry,
  onShare,
  onContinue,
}: {
  endedDay: number;
  clock: Pick<DayClock, "day">;
  gains: DayGainsReading;
  history: Exclude<DayHistory, "waiting">;
  stories: readonly ProcessedStoryEvent[];
  onRetry: () => void;
  onShare?: () => void;
  onContinue: () => void;
}) => (
  <HudPanel
    label={`${DAY} ${endedDay} ${DAY_DONE}`}
    collapsible={false}
    className="day-done"
    bodyClassName="flex flex-col gap-3 overflow-y-auto p-5"
  >
    <header className="day-done__head">
      <Icon name="calendar" size={56} />
      <h2 className="day-done__title">
        {DAY} {endedDay} {DAY_DONE}
      </h2>
    </header>
    <DayGains gains={gains} />
    {history === "short" && <HudNotice line={DAY_TOTALS_UNKNOWN} />}
    {history === "failed" && <HudNotice tone="bad" line={DAY_TOTALS_UNKNOWN} retry={onRetry} />}
    <DayLines stories={stories} />
    <div className="day-done__actions">
      {onShare && (
        <HudButton kind="secondary" icon="share" onClick={onShare}>
          {DAY_SHARE_WORDS.share}
        </HudButton>
      )}
      <HudButton kind="primary" icon="play" data-day-continue="" onClick={onContinue}>
        {clock.day !== undefined ? DAY_DONE_WORDS.beginDay(clock.day) : CONTINUE}
      </HudButton>
    </div>
  </HudPanel>
);

const DayLines = ({ stories }: { stories: readonly ProcessedStoryEvent[] }) => {
  const lines = oneKindEach(oneStoryPerAction(stories).reverse()).slice(0, DAY_LINES);
  if (lines.length === 0) return null;
  return (
    <div data-day-lines className="day-done__lines">
      {lines.map((story) => (
        <FeedLine key={story.event_id} story={story} />
      ))}
    </div>
  );
};

const oneKindEach = (stories: readonly ProcessedStoryEvent[]) =>
  stories.filter((story, index) => stories.findIndex((other) => other.story === story.story) === index);
