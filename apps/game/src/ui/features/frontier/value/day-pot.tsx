import { formatExact } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { LORDS } from "@/ui/design-system/kit/words";
import { useId } from "react";

/**
 * One game day of the LORDS pot: what unlocked that day, what earlier days left and carried in, what its chests spent,
 * and its day price (the common chest).
 */
export type PotDay = { day: number; unlocked: number; carried: number; spent: number; price: number };

const COLUMN = 34;
const WIDTH = 300;
const BASE = 108;
const TOP = 6;

/**
 * The day's pot as a picture (value screens, c): a column a day, today's lit last. Gold is what the day's chests spent,
 * hatched is what it left, and an arrow carries what it left into the next day, so a busy day after quiet ones stands
 * taller and its common chest, written under it, pays more.
 */
export const DayPot = ({ days }: { days: readonly PotDay[] }) => {
  const id = useId();
  const most = Math.max(...days.map((day) => day.unlocked + day.carried), 1);
  const scale = (BASE - TOP) / most;
  const gap = days.length > 1 ? (WIDTH - days.length * COLUMN) / (days.length - 1) : 0;
  const x = (index: number) => index * (COLUMN + gap);
  return (
    <figure
      aria-label={`${LORDS} ${days.map((day) => `${day.day}: ${formatExact(day.price)}`).join(", ")}`}
      className="frontier-card flex gap-2 !rounded-2xl px-3 pb-1.5 pt-3"
    >
      <span aria-hidden className="flex flex-col justify-end gap-0.5 pb-0.5">
        <KitIcon code="Cl" size={18} />
        <KitIcon code="Ch" size={18} />
      </span>
      <svg aria-hidden width={WIDTH} height={BASE + 44} viewBox={`-3 -3 ${WIDTH + 6} ${BASE + 47}`}>
        <defs>
          <pattern id={`${id}left`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#20170c" />
            <rect width="2.5" height="6" fill="#7a5823" />
          </pattern>
          <linearGradient id={`${id}today`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffc24a" />
            <stop offset="1" stopColor="#b76f00" />
          </linearGradient>
          <linearGradient id={`${id}past`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c98a1e" />
            <stop offset="1" stopColor="#6d4300" />
          </linearGradient>
          <marker
            id={`${id}arrow`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" style={{ fill: "var(--gold2)" }} />
          </marker>
        </defs>
        {days.map((day, index) => {
          const today = index === days.length - 1;
          const pot = day.unlocked + day.carried;
          const spent = Math.min(day.spent, pot);
          const next = days[index + 1];
          const left = pot - spent;
          return (
            <g key={day.day}>
              <rect
                x={x(index)}
                y={BASE - pot * scale}
                width={COLUMN}
                height={pot * scale}
                rx={5}
                fill={`url(#${id}left)`}
                style={{ stroke: today ? "var(--hot)" : "var(--line2)" }}
                strokeWidth={today ? 2 : 1}
              />
              <rect
                x={x(index) + 3}
                y={BASE - spent * scale}
                width={COLUMN - 6}
                height={Math.max(0, spent * scale - 1)}
                rx={3}
                fill={`url(#${id}${today ? "today" : "past"})`}
              />
              {next && next.carried > 0 && left > 0 && (
                <path
                  d={`M${x(index) + COLUMN + 2} ${BASE - (spent + left / 2) * scale} C ${x(index) + COLUMN + gap / 2} ${BASE - (spent + left / 2) * scale}, ${x(index + 1) - gap / 2} ${BASE - (next.unlocked + next.carried / 2) * scale}, ${x(index + 1) - 3} ${BASE - (next.unlocked + next.carried / 2) * scale}`}
                  style={{ stroke: "var(--gold2)" }}
                  strokeWidth={2.2}
                  fill="none"
                  markerEnd={`url(#${id}arrow)`}
                />
              )}
              <text
                x={x(index) + COLUMN / 2}
                y={BASE + 18}
                textAnchor="middle"
                style={{ fill: today ? "var(--cream)" : "var(--muted)" }}
                fontSize={13}
                fontWeight={700}
              >
                {day.day}
              </text>
              <text
                x={x(index) + COLUMN / 2}
                y={BASE + 38}
                textAnchor="middle"
                style={{ fill: today ? "var(--gold2)" : "var(--muted)" }}
                fontSize={today ? 16 : 13}
                fontWeight={700}
              >
                {formatExact(day.price)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
};
