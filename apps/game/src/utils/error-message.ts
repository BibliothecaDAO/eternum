// Keep error extraction on the provider’s leaf module so display code does not load transaction handling.
export {
  extractErrorMessage as extractReadableErrorMessage,
  formatErrorForConsole as formatReadableErrorForConsole,
} from "@bibliothecadao/provider/errors";

/**
 * The game's resource assert reverts with "Insufficient Balance: {RESOURCE}
 * (id: N, balance: N) < N" (contracts models/resource). The trailing colon
 * distinguishes it from account fee-token errors, which must never trigger
 * game-state repairs. Lives here — the client's one error-message chokepoint
 * — so every consumer classifies the game's revert the same way.
 */
export const isInsufficientResourceBalanceRevert = (message: string): boolean =>
  message.toLowerCase().includes("insufficient balance:");
