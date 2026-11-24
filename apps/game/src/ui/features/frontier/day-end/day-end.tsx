import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { DAY_END } from "@/ui/design-system/kit/words";

import type { useExpeditionRules } from "../frontier-home";
import { dayClock, dayEndUrgency, type DayClock } from "../hud/day-clock";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

export interface DayEnd {
  clock: DayClock;
}

export const useDayEnd = (rules: ExpeditionRules): DayEnd => ({ clock: dayClock(rules, useNowSeconds()) });

/**
 * The last hour's line in the notices band (owner's pick, 4 November 2026: day end B): when the day ends, red in its
 * last ten minutes, on one line with Open (owner, 6 November 2026: the count of what is left wrapped it to two rows);
 * Open goes to Today, which says what is left and what goes. None before the last hour.
 */
export const DayEndNotice = ({ dayEnd: { clock }, onOpen }: { dayEnd: DayEnd; onOpen: () => void }) => {
  if (clock.tone !== "ember" || clock.secondsLeft === undefined) return null;
  return (
    <HudNotice
      tone={dayEndUrgency(clock.secondsLeft)}
      icon="hourglass"
      line={DAY_END.endsIn(clock.day, clock.secondsLeft)}
      fix={{ label: DAY_END.open, onClick: onOpen }}
    />
  );
};
