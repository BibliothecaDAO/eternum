/** Unregistered shareholder points worth a transaction: a tenth of what is already registered. */
export const CLAIM_SHARE_POINTS_GROWTH = 0.1;
/** Inside the endgame every claim counts, so the runner claims whatever is unregistered. */
export const CLAIM_SHARE_POINTS_ENDGAME_SECONDS = 15 * 60;

/**
 * Standings already show live shareholder points, so registering them on chain is worth a transaction only when
 * the unregistered share has grown meaningfully, or when the game is about to end and the chain must hold them.
 */
export function shouldClaimSharePoints(input: {
  registeredPoints: number;
  unregisteredPoints: number;
  secondsToGameEnd: number | null;
}): boolean {
  if (input.unregisteredPoints <= 0) return false;
  if (input.secondsToGameEnd !== null && input.secondsToGameEnd <= CLAIM_SHARE_POINTS_ENDGAME_SECONDS) return true;
  return input.unregisteredPoints >= Math.max(1, input.registeredPoints * CLAIM_SHARE_POINTS_GROWTH);
}
