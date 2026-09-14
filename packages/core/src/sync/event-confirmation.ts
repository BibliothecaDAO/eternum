import type { GameSyncEventConfirmation } from "./game-sync-types";

/** Unknown metadata is never proof of confirmation. Higher ranks may replace lower ones, never the reverse. */
export function eventConfirmationRank(confirmation?: GameSyncEventConfirmation | null): 0 | 1 | 2 {
  if (!confirmation) return 0;
  if (confirmation.preconfirmed === true) return 1;
  return confirmation.preconfirmed === false &&
    Number.isSafeInteger(confirmation.block) &&
    confirmation.block !== null &&
    confirmation.block >= 0
    ? 2
    : 0;
}
