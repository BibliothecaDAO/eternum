import type { GameReviewData } from "@/services/review/game-review-service";

export const canRetryMmrUpdate = (
  data: GameReviewData,
  rankingFinalized = data.finalization.rankingFinalized,
): boolean => {
  const finalization = data.finalization;
  return (
    rankingFinalized &&
    finalization.mmrEnabled &&
    !finalization.mmrCommitted &&
    Boolean(finalization.mmrTokenAddress) &&
    finalization.registeredPlayers.length >= finalization.mmrMinPlayers
  );
};

export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return "0s";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const isSingleRegistrantNoGame = (
  finalization: GameReviewData["finalization"],
  rankingFinalized = finalization.rankingFinalized,
): boolean => finalization.registrationCount === 1 && !rankingFinalized;

export const getSecondsUntilScoreSubmissionOpen = (
  finalization: GameReviewData["finalization"],
  nowTs: number,
  rankingFinalized = finalization.rankingFinalized,
): number | null => {
  if (isSingleRegistrantNoGame(finalization, rankingFinalized)) {
    return 0;
  }

  const opensAt = finalization.scoreSubmissionOpensAt;
  if (rankingFinalized) {
    return 0;
  }
  if (opensAt == null) return null;

  const remaining = opensAt - nowTs + 1;
  return remaining > 0 ? remaining : 0;
};

export const isScoreSubmissionWindowOpen = (
  finalization: GameReviewData["finalization"],
  nowTs: number,
  rankingFinalized = finalization.rankingFinalized,
): boolean => {
  const secondsUntilOpen = getSecondsUntilScoreSubmissionOpen(finalization, nowTs, rankingFinalized);
  return secondsUntilOpen == null || secondsUntilOpen === 0;
};
