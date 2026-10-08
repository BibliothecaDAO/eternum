import { RatingFigure } from "./rating-mark";
import { ratingPoints, tierOf, useRatings } from "./ratings";
import { RATING_WORDS } from "./words";

/**
 * A player's Blitz rating now, on one line: its mark and points with the tier, read by their gameplay account. The
 * reader with no linked wallet is told how to carry one; anyone else without a rating, and an unanswered read, is a
 * dash. It is the current rating, never a game's change: rating stays read-only (the owner, 8 October).
 */
export const RatingLine = ({ account, own }: { account: string; own: boolean }) => {
  const ratings = useRatings([account]);
  const answer = ratings.data?.ratings[account];
  if (own && answer?.status === "unlinked")
    return <p className="text-[13px] text-kit-muted">{RATING_WORDS.unlinked}</p>;
  return (
    <p className="flex items-center gap-2 text-[14px] text-kit-muted">
      {answer?.status === "rated" ? (
        <>
          <RatingFigure rating={answer.rating} />
          {tierOf(ratingPoints(answer.rating)).name}
        </>
      ) : (
        <b className="text-kit-cream">—</b>
      )}
      <span>· {RATING_WORDS.blitzRating}</span>
    </p>
  );
};
