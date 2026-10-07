import { cn } from "@/ui/design-system/atoms/lib/utils";

import { TONE_STROKE, TONE_TEXT, type Tone } from "./tone";
import { DAY } from "./words";

const RADIUS = 15;
const LENGTH = 2 * Math.PI * RADIUS;

/**
 * The day's number in a ring that drains as today runs out. The ring is a share of today, whatever its length; the
 * clock line beside it says the times. Unknown is a dash and an empty ring.
 */
export const DayDial = ({
  day,
  shareLeft,
  tone,
}: {
  day: number | undefined;
  /** How much of today is left, from 1 at its start to 0 at its end. */
  shareLeft: number | undefined;
  tone: Tone;
}) => {
  const share = shareLeft === undefined ? 0 : Math.min(1, Math.max(0, shareLeft));
  return (
    <span
      role="img"
      aria-label={day === undefined ? DAY : `${DAY} ${day}`}
      className={cn("relative inline-flex size-10 shrink-0 items-center justify-center", TONE_TEXT[tone])}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          className="stroke-[color:var(--frontier-line)]"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={LENGTH}
          strokeDashoffset={LENGTH * (1 - share)}
          className={TONE_STROKE[tone]}
        />
      </svg>
      <span aria-hidden className="relative text-[14px] tabular-nums">
        {day ?? "—"}
      </span>
    </span>
  );
};
