import { expeditionDayEndsAt, seasonDay } from "@bibliothecadao/eternum";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { formatClock } from "./frontier-format";

const DIAL_RADIUS = 16;
const DIAL_LENGTH = 2 * Math.PI * DIAL_RADIUS;

/**
 * The expedition day: its number in a ring that drains as the day runs out; the time left is its label. The caller
 * gives the clock it reads: the game's block clock in the HUD, the wall clock in the shell.
 */
export const DayDial = ({
  rules,
  now,
  className,
}: {
  rules: { epochSeconds: number; startMainAt: number };
  now: number;
  className?: string;
}) => {
  const day = seasonDay(rules, now) + 1;
  const left = expeditionDayEndsAt(rules, now) - now;
  const share = Math.min(1, Math.max(0, left / rules.epochSeconds));
  return (
    <div
      role="timer"
      aria-label={`Day ${day}, ${formatClock(left)} left`}
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
        D{day}
      </span>
    </div>
  );
};
