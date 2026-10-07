import { dayOf, type SeasonCalendar } from "@bibliothecadao/eternum";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { formatClock } from "./frontier-format";

const DIAL_RADIUS = 16;
const DIAL_LENGTH = 2 * Math.PI * DIAL_RADIUS;

/**
 * The expedition day: its number in a ring that drains as the day runs out; the time left is its label. The caller
 * gives the clock it reads: the game's block clock in the HUD, the wall clock in the shell.
 */
export const DayDial = ({ rules, now, className }: { rules: SeasonCalendar; now: number; className?: string }) => {
  const today = dayOf(rules, now);
  const day = today?.index ?? null;
  const left = (today ? today.end : rules.startMainAt) - now;
  // Days differ in length, so the ring drains over today's own.
  const share = today ? Math.min(1, Math.max(0, left / (today.end - today.start))) : 1;
  return (
    <div
      role="timer"
      aria-label={day === null ? `Starts in ${formatClock(left)}` : `Day ${day + 1}, ${formatClock(left)} left`}
      title={formatClock(left)}
      className={cn("relative size-9 shrink-0 lg:size-10", className)}
    >
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={DIAL_RADIUS} fill="none" stroke="rgba(223,170,84,0.18)" strokeWidth="3.5" />
        <circle
          cx="20"
          cy="20"
          r={DIAL_RADIUS}
          fill="none"
          stroke="#e39001"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={DIAL_LENGTH}
          strokeDashoffset={DIAL_LENGTH * (1 - share)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] text-[#f3d08a] tabular-nums">
        {day === null ? "Soon" : `D${day + 1}`}
      </span>
    </div>
  );
};
