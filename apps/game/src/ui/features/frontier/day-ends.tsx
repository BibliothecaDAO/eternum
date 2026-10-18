import { HudChip } from "@/ui/design-system/kit/hud-elements";
import { formatClockTime, formatDuration } from "@/ui/design-system/kit/time";
import { HUD_TONE, type Tone } from "@/ui/design-system/kit/tone";
import { DAY_ENDS, LEFT } from "@/ui/design-system/kit/words";

/**
 * When today ends, for a sheet that needs it (the army deployed now ends then): "Day ends 21:40 · 7h 14m left", in the
 * day's tone. The strip's clock line's own words and time rule.
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
  <HudChip icons={["clock"]} tone={HUD_TONE[tone]}>
    {`${DAY_ENDS} ${formatClockTime(endsAt)} · ${formatDuration(secondsLeft)} ${LEFT}`}
  </HudChip>
);
