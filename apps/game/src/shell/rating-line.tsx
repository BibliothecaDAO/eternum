import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { useIdentitySession } from "@/hooks/context/identity-session";

import { RatingFigure } from "./rating-mark";
import { ratingPoints, tierOf, useRatings } from "./ratings";
import { RATING_WORDS } from "./words";

/**
 * A player's Blitz rating now, on one line: its mark and points with the tier, read by the wallet that played. A reader
 * with no wallet is told how to carry one; an unanswered read is a dash. It is the current rating, never a game's
 * change: rating stays read-only (the owner, 8 October).
 */
export const RatingLine = ({ wallet }: { wallet: string | null }) => {
  if (wallet === null) return <p className="text-[13px] text-kit-muted">{RATING_WORDS.unlinked}</p>;
  return <WalletRating wallet={wallet} />;
};

/** The reader's own rating: their payout wallet's, the wallet they play with. */
export const OwnRatingLine = () => {
  const { session } = useIdentitySession();
  return <RatingLine wallet={session ? payoutAddressOf(session.user) : null} />;
};

const WalletRating = ({ wallet }: { wallet: string }) => {
  const answer = useRatings([wallet]).data?.ratings[wallet];
  return (
    <p className="flex items-center gap-2 text-[14px] text-kit-muted">
      {answer ? (
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
