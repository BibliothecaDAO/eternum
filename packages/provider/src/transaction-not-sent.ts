/**
 * The positive evidence an action is in no block: the proxy refused this request before forwarding it, another
 * transaction spent its nonce while the node answered that this hash is unknown, or the node kept answering unknown
 * hash and unmoved nonce for longer than the proxy can still forward a request it holds.
 */
type TransactionNotSentReason = "refused" | "replaced" | "dropped";

/**
 * An action proven absent from every block: nothing of it applied, and the account's next send may go. A dropped
 * action is still watched until its nonce moves: `landedLate` resolves true if it lands after all.
 */
export class TransactionNotSentError extends Error {
  readonly transactionHash: string;
  readonly landedLate?: Promise<boolean>;

  constructor(transactionHash: string, reason: TransactionNotSentReason, landedLate?: Promise<boolean>) {
    super(`Transaction ${transactionHash} not sent (${reason})`);
    this.name = "TransactionNotSentError";
    this.transactionHash = transactionHash;
    this.landedLate = landedLate;
  }
}

/**
 * An action neither settled nor proven not sent by then is checking: five 2 s blocks. Its send and its player's next
 * command stop waiting on it, and it keeps being reconciled.
 */
export const ACTION_CHECKING_AFTER_MS = 10_000;

/** The node's own "transaction hash not found" (Starknet RPC error 29), which the proxy passes through unchanged. */
const TRANSACTION_HASH_NOT_FOUND = 29;

/**
 * Whether a failed transaction read is the node's answer that it does not know the hash. Only that is evidence of
 * absence: a timeout, a dropped connection or the proxy's "RPC read unavailable" (-32012) says nothing about whether
 * the node holds the action.
 */
export function isTransactionHashNotFound(error: unknown): boolean {
  const candidate = error as { code?: number; baseError?: { code?: number } } | null;
  return (candidate?.baseError?.code ?? candidate?.code) === TRANSACTION_HASH_NOT_FOUND;
}
