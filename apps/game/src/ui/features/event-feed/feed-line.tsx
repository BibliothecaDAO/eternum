import { HudRanked } from "@/ui/design-system/kit/hud-elements";
import { useGame } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { feltEquals } from "@bibliothecadao/eternum/game-client";
import { involvesPlayer } from "./event-stories";
import { usePlayerNames } from "@/hooks/use-player-profile";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { Icon } from "@/ui/design-system/icon";
import { type RankedWords } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";
import { formatClockTime, formatShortDuration } from "@bibliothecadao/types";
import { storyMeaning } from "@/ui/design-system/domain-icon-meaning";
import { useCoarseNowSeconds } from "@/hooks/helpers/use-block-timestamp";

import { type FeedReading, readFeedStory, type ToldReading } from "./feed-reading";
import { useStoryOpener } from "./story-feed-row";
import { useSiteBeastMeaning } from "./use-site-beast";

const OUTCOME_TONES = { good: "text-hud-good", bad: "text-hud-bad", neutral: "text-hud-muted" } as const;

type Concern = "world" | "own" | "good" | "bad";
const CONCERN_RULES: Record<Concern, string> = {
  world: "bg-hud-ink",
  own: "bg-hud-gold",
  good: "bg-hud-good",
  bad: "bg-hud-bad",
};

export const FeedLine = ({ story }: { story: ProcessedStoryEvent }) => {
  const line = useToldLine(story);
  return (
    <FeedRow story={story} line={line} className="ui-event ui-feed-line items-center py-2">
      <span className="ui-feed-line__tile flex size-9 shrink-0 items-center justify-center rounded-md border border-hud-divider bg-hud-surface">
        <Icon name={storyMeaning(story.story)} size={24} className="ui-event__icon" />
      </span>
      <span className="ui-feed-line__told flex min-w-0 flex-1 flex-col gap-0.5">
        {line.words}
        <span className="ui-event__time">{formatClockTime(story.timestampMs / 1000)}</span>
      </span>
    </FeedRow>
  );
};

export const FeedRuleLine = ({ story }: { story: ProcessedStoryEvent }) => {
  const line = useToldLine(story);
  const now = useCoarseNowSeconds(10);
  return (
    <FeedRow
      story={story}
      line={line}
      className="ui-event ui-feed-line items-center"
      lead={
        <span
          className={`my-1 w-1 shrink-0 self-stretch rounded-full ${CONCERN_RULES[line.concern]}`}
          aria-hidden="true"
        />
      }
      end={<span className="ui-event__time">{formatShortDuration(Math.max(1, now - story.timestampMs / 1000))}</span>}
    >
      {line.words}
    </FeedRow>
  );
};

type ToldLine = ReturnType<typeof useToldLine>;

const useToldLine = (story: ProcessedStoryEvent) => {
  const {
    setup: { store },
  } = useGame();
  const names = usePlayerNames();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const reading = readFeedStory(story, store);
  const own = involvesPlayer(story, player);
  const words = (
    <span className="ui-event__text">
      {"words" in reading ? (
        <OwnWordsLine words={reading.words} named={reading.named} name={reading.actor && names.text(reading.actor)} />
      ) : (
        <>
          <Name text={names.text(reading.actor)} /> {reading.verb}
          {reading.object && <ObjectWords object={reading.object} names={names.text} />}
          {reading.outcome && <span className={OUTCOME_TONES[reading.outcome.tone]}> · {reading.outcome.word}</span>}
        </>
      )}
    </span>
  );
  return { reading, own, concern: whoItConcerns(reading, own, own && feltEquals(reading.actor, player)), words };
};

const FeedRow = ({
  story,
  line,
  className,
  lead,
  end,
  children,
}: {
  story: ProcessedStoryEvent;
  line: ToldLine;
  className: string;
  lead?: ReactNode;
  end?: ReactNode;
  children: ReactNode;
}) => {
  const open = useStoryOpener(story);
  return (
    <div
      className={className}
      data-feed-line
      data-story={story.story}
      data-own={line.own || undefined}
      data-rule={line.concern}
    >
      {lead}
      {open ? (
        <button type="button" className="ui-event__open items-center" onClick={open}>
          {children}
        </button>
      ) : (
        children
      )}
      {"reward" in line.reading && line.reading.reward && (
        <span className="ui-feed-line__reward" data-tip={line.reading.reward.name}>
          <Icon
            name={line.reading.reward.icon}
            size={16}
            alt={line.reading.reward.name}
            className="ui-feed-line__glyph"
          />
          {line.reading.reward.amountText}
        </span>
      )}
      {end}
    </div>
  );
};

const whoItConcerns = (reading: FeedReading, own: boolean, actedByPlayer: boolean): Concern => {
  if (!own) return "world";
  const tone = actedByPlayer && "outcome" in reading ? reading.outcome?.tone : undefined;
  return tone === "good" || tone === "bad" ? tone : "own";
};

/** What the act was done to, its painting set in the line. */
const ObjectWords = ({
  object,
  names,
}: {
  object: NonNullable<ToldReading["object"]>;
  names: (address: string) => string;
}) => (
  <>
    {" "}
    {"site" in object ? (
      <SiteGlyph site={object.site} />
    ) : (
      object.icon && <Icon name={object.icon} size={16} className="ui-feed-line__glyph" />
    )}
    {"player" in object ? names(object.player) : <HudRanked words={object.name} />}
  </>
);

/** A site's guard, painted as the map paints it. */
const SiteGlyph = ({ site }: { site: number }) => {
  const meaning = useSiteBeastMeaning(site);
  return meaning ? <Icon name={meaning} size={16} className="ui-feed-line__glyph" /> : null;
};

/** Who did it. */
const Name = ({ text }: { text: string }) => <strong>{text}</strong>;

/**
 * A story in its own words with who did it named once: where its formatter wrote the actor's name (`named`), the name
 * there is the row's; where it did not ("Crate opened: 1 relic to the army"), the name leads the words, even when a
 * word in them reads like it. A story no player owns stands in its words alone.
 */
const OwnWordsLine = ({
  words,
  named,
  name,
}: {
  words: RankedWords | string;
  named: { at: number; length: number } | undefined;
  name: string | undefined;
}) => {
  if (!name) return <HudRanked words={words} />;
  if (!named || typeof words !== "string")
    return (
      <>
        <Name text={name} /> · <HudRanked words={words} />
      </>
    );
  return (
    <>
      {words.slice(0, named.at)}
      <Name text={words.slice(named.at, named.at + named.length)} />
      {words.slice(named.at + named.length)}
    </>
  );
};
