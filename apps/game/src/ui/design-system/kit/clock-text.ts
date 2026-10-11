import { formatClockTime, formatDuration } from "./time";
import { DAY_ENDS, LEFT, TOMORROW_LASTS } from "./words";

/**
 * The clock line as plain text, for a surface that cannot draw the kit (the Day-end reminder a device shows): "Day
 * ends 21:40 · 1h left · Tomorrow lasts 12h". The same words and time rule as ClockLine.
 */
export const clockLineText = ({
  endsAt,
  secondsLeft,
  tomorrowSeconds,
}: {
  endsAt: number | undefined;
  secondsLeft: number | undefined;
  tomorrowSeconds: number | undefined;
}): string =>
  `${DAY_ENDS} ${formatClockTime(endsAt)} · ${formatDuration(secondsLeft)} ${LEFT} · ${TOMORROW_LASTS} ${formatDuration(tomorrowSeconds)}`;
