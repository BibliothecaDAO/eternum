import { useGame } from "@/hooks/context/game-context";
import { usePlayerNames } from "@/hooks/use-player-profile";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { storyMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { formatClockTime } from "@bibliothecadao/types";

import { readFeedStory, type ToldReading } from "./feed-reading";
import { useStoryOpener } from "./story-feed-row";

const OUTCOME_TONES = { good: "text-hud-good", bad: "text-hud-bad", neutral: "text-hud-muted" } as const;

/**
 * One row of Frontier's Feed (option A, owner, 26 October 2026: "A is great for the feed, but the text is not
 * aligned"): its time, the act's painting, then who did it, what and to what, and what came of it, on one line and one
 * baseline, with what it paid at its end. Every row is one height; a row too long for the rail ends in an ellipsis. A row
 * that is the player's own is gold, words and reward (owner, 27 October: "when a row is mine should put the row in
 * yellow like it did before"); a row opens where its story happened.
 */
export const FeedLine = ({ story, own = false }: { story: ProcessedStoryEvent; own?: boolean }) => {
  const {
    setup: { store },
  } = useGame();
  const names = usePlayerNames();
  const open = useStoryOpener(story);
  const reading = readFeedStory(story, store);
  const words = (
    <>
      <span className="ui-event__time">{formatClockTime(story.timestampMs / 1000)}</span>
      <Icon name={storyMeaning(story.story)} size={16} className="ui-event__icon" />
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
    </>
  );
  return (
    <div className="ui-event ui-feed-line" data-feed-line data-own={own || undefined}>
      {open ? (
        <button type="button" className="ui-event__open" onClick={open}>
          {words}
        </button>
      ) : (
        words
      )}
      {"reward" in reading && reading.reward && (
        <span className="ui-feed-line__reward" data-tip={reading.reward.name}>
          <Icon name={reading.reward.icon} size={16} alt={reading.reward.name} className="ui-feed-line__glyph" />
          {reading.reward.amountText}
        </span>
      )}
    </div>
  );
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
    {object.icon && <Icon name={object.icon} size={16} className="ui-feed-line__glyph" />}
    {"player" in object ? names(object.player) : object.name}
  </>
);

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
  words: string;
  named: { at: number; length: number } | undefined;
  name: string | undefined;
}) => {
  if (!name) return <>{words}</>;
  if (!named)
    return (
      <>
        <Name text={name} /> · {words}
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
