type TopHeaderPlayerStatus =
  | {
      type: "ranked";
      rank: number;
      points: number | null | undefined;
    }
  | {
      type: "spectating";
    }
  | null;

interface ResolveTopHeaderPlayerStatusInput {
  isSpectating: boolean;
  rank: number | null | undefined;
  points: number | null | undefined;
}

const hasResolvedRank = (rank: number | null | undefined): rank is number => {
  return rank !== null && rank !== undefined;
};

// Only surface the rank suffix when the player is meaningfully ranked. A brand-new
// player with rank #9000 / 0 points gains nothing from seeing it, so we hide
// the suffix until they've either scored points or climbed into the top 500.
const RANK_THRESHOLD = 500;

const isMeaningfullyRanked = (rank: number, points: number | null | undefined): boolean => {
  if (rank <= RANK_THRESHOLD) return true;
  return typeof points === "number" && points > 0;
};

export const resolveTopHeaderPlayerStatus = ({
  isSpectating,
  rank,
  points,
}: ResolveTopHeaderPlayerStatusInput): TopHeaderPlayerStatus => {
  if (isSpectating) {
    return { type: "spectating" };
  }

  if (hasResolvedRank(rank) && isMeaningfullyRanked(rank, points)) {
    return {
      type: "ranked",
      rank,
      points,
    };
  }

  return null;
};
