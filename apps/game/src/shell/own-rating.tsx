import { useIdentitySession } from "@/hooks/context/identity-session";

import { RatingFigure } from "./rating-mark";
import { ratingPoints, tierOf, useRatings } from "./ratings";
import { RATING_WORDS } from "./words";

/**
 * The signed-in player's Blitz rating now, on one line: its mark and points with the tier. A player with no linked
 * wallet is told how to carry one; an unanswered read is a dash. It is the current rating, never a game's change: the
 * rated game's change has no source yet (lobby-chat-mmr.txt, automatic MMR).
 */
export const OwnRatingLine = () => {
  const { session } = useIdentitySession();
  const realmsId = session?.user.realmsId;
  const ratings = useRatings(realmsId ? [realmsId] : []);
  if (!realmsId) return null;
  const answer = ratings.data?.ratings[realmsId];
  if (answer?.status === "unlinked") return <p className="text-[13px] text-kit-muted">{RATING_WORDS.unlinked}</p>;
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
