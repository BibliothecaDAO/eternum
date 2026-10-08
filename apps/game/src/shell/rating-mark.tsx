import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatExact } from "@/ui/design-system/kit/amount";

import { ratingPoints, tierOf } from "./ratings";

/**
 * A tier's mark: a shield in the tier's colour. A stand-in until the tier marks' masters exist (icon-masters.txt); the
 * name is the mark's label, so it reads without colour.
 */
export const TierMark = ({ rating, size = 18 }: { rating: string; size?: number }) => {
  const tier = tierOf(ratingPoints(rating));
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={tier.name}
      className={cn("shrink-0 fill-current", tier.mark)}
    >
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
    </svg>
  );
};

/** A rating on a row: its tier's mark and its whole points. */
export const RatingFigure = ({ rating }: { rating: string }) => (
  <span className="inline-flex items-center gap-1.5 font-ui text-[15px] font-bold tabular-nums text-kit-cream">
    <TierMark rating={rating} size={16} />
    {formatExact(ratingPoints(rating))}
  </span>
);
