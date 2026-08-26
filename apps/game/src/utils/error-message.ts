// The provider package owns the single error-extractor implementation; this
// module remains as the client-side import path so existing importers keep
// working. The import reaches for the "./errors" subpath (a leaf module that
// imports nothing) instead of the package root: evaluating the provider index
// constructs the DojoProvider event-emitter class at module scope, which
// breaks tests that partially mock @dojoengine/core and needlessly drags the
// whole provider into every error-message consumer. The module is stateless,
// so single-instancing it via the subpath is hygiene, not a correctness fix.
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
