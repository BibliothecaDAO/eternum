import { cn } from "@/ui/design-system/atoms/lib/utils";

import { TONE_TEXT, type Tone } from "./tone";
import { type ClockPhrase, dayEnds, dayLeft, tomorrowLasts } from "./words";

/**
 * The clock line, ruled to stay in words: "Day ends 21:40 · 7h 14m left · Tomorrow lasts 12h". Days run 8 to 24 hours,
 * so it always says when today ends in local clock time, the time left, and how long tomorrow lasts. Unknown is a dash.
 */
export const ClockLine = ({
  endsAt,
  secondsLeft,
  tomorrowSeconds,
  tone,
}: {
  /** When today ends, unix seconds. */
  endsAt: number | undefined;
  secondsLeft: number | undefined;
  /** How long tomorrow lasts. */
  tomorrowSeconds: number | undefined;
  tone: Tone;
}) => (
  <p
    role="timer"
    className={cn("flex flex-wrap items-baseline justify-center gap-x-1 text-sm font-semibold", TONE_TEXT[tone])}
  >
    <Phrase phrase={dayEnds(endsAt)} />
    <span aria-hidden>·</span>
    <Phrase phrase={dayLeft(secondsLeft)} />
    <span aria-hidden className="px-1">
      ·
    </span>
    <Phrase phrase={tomorrowLasts(tomorrowSeconds)} />
  </p>
);

/** A clock phrase with its reading set apart in bold numerals. */
const Phrase = ({ phrase }: { phrase: ClockPhrase }) => {
  const reading = <b className="tabular-nums">{phrase.reading}</b>;
  const words = <span>{phrase.words}</span>;
  return phrase.readingFirst ? (
    <>
      {reading}
      {words}
    </>
  ) : (
    <>
      {words}
      {reading}
    </>
  );
};
