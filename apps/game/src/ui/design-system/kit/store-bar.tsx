import { cn } from "@/ui/design-system/atoms/lib/utils";

import { TONE_FILL, type Tone } from "./tone";

/**
 * How full a store is against its limit, as a thin bar. A store with no limit (Essence, LORDS) keeps the bar's room
 * empty so its neighbours stay aligned; an unknown amount draws an empty bar, never a guess.
 */
export const StoreBar = ({ amount, limit, tone }: { amount: number | undefined; limit?: number; tone: Tone }) => {
  if (limit === undefined) return <span aria-hidden className="block h-1 w-full" />;
  const share = amount === undefined || limit <= 0 ? 0 : Math.min(1, Math.max(0, amount / limit));
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={amount}
      className="block h-1 w-full overflow-hidden rounded-sm bg-kit-line"
    >
      <i className={cn("block h-full", TONE_FILL[tone])} style={{ width: `${share * 100}%` }} />
    </span>
  );
};
