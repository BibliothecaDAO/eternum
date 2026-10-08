import { formatExact } from "@/ui/design-system/kit/amount";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { ratingPoints, tierOf } from "./ratings";

/** A tier's mark: its gilded shield, labelled with the tier's name so it reads without the picture. */
export const TierMark = ({ rating, size = 18 }: { rating: string; size?: number }) => {
  const tier = tierOf(ratingPoints(rating));
  return (
    <span role="img" aria-label={tier.name} className="inline-flex shrink-0">
      <KitIcon code={tier.mark} size={size} />
    </span>
  );
};

/** A rating on a row: its tier's mark and its whole points. */
export const RatingFigure = ({ rating }: { rating: string }) => (
  <span className="inline-flex items-center gap-1.5 font-ui text-[15px] font-bold tabular-nums text-kit-cream">
    <TierMark rating={rating} size={16} />
    {formatExact(ratingPoints(rating))}
  </span>
);
