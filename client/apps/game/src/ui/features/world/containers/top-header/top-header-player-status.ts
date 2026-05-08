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

export const resolveTopHeaderPlayerStatus = ({
  isSpectating,
  rank,
  points,
}: ResolveTopHeaderPlayerStatusInput): TopHeaderPlayerStatus => {
  if (isSpectating) {
    return { type: "spectating" };
  }

  if (hasResolvedRank(rank)) {
    return {
      type: "ranked",
      rank,
      points,
    };
  }

  return null;
};
