import { cn } from "@/ui/design-system/atoms/lib/utils";

import { KitIcon } from "./kit-icon";
import { formatClockTime, formatDuration } from "./time";
import { TONE_TEXT, type Tone } from "./tone";
import { DAY_ENDS, LEFT, TOMORROW_LASTS } from "./words";

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
    className={cn("flex flex-wrap items-baseline justify-center gap-x-1 text-[12px] font-semibold", TONE_TEXT[tone])}
  >
    <span>{DAY_ENDS}</span>
    <Numeral>{formatClockTime(endsAt)}</Numeral>
    <span aria-hidden>·</span>
    <Numeral>{formatDuration(secondsLeft)}</Numeral>
    <span>{LEFT}</span>
    <span aria-hidden className="px-1">
      ·
    </span>
    <span>{TOMORROW_LASTS}</span>
    <Numeral>{formatDuration(tomorrowSeconds)}</Numeral>
  </p>
);

/**
 * When today ends, for a sheet that needs it (the army deployed now ends then): "Day ends 21:40 · 7h 14m left". The
 * clock line's own words and time rule.
 */
export const DayEnds = ({
  endsAt,
  secondsLeft,
  tone,
}: {
  endsAt: number | undefined;
  secondsLeft: number | undefined;
  tone: Tone;
}) => (
  <p className={cn("flex items-center justify-center gap-x-1 text-[13px] font-semibold", TONE_TEXT[tone])}>
    <KitIcon code="Cl" size={18} />
    <span>{DAY_ENDS}</span>
    <Numeral>{formatClockTime(endsAt)}</Numeral>
    <span aria-hidden>·</span>
    <Numeral>{formatDuration(secondsLeft)}</Numeral>
    <span>{LEFT}</span>
  </p>
);

const Numeral = ({ children }: { children: string }) => <b className="text-[14px] tabular-nums">{children}</b>;
