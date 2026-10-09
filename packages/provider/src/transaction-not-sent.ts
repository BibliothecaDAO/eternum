/**
 * The positive evidence an action is in no block: another transaction spent its nonce while the node answered that
 * this hash is unknown, or the node kept answering unknown hash and unmoved nonce for the whole window.
 */
type TransactionNotSentReason = "replaced" | "dropped";

/** An action proven absent from every block: nothing of it applied, and the account's next send may go. */
export class TransactionNotSentError extends Error {
  readonly transactionHash: string;

  constructor(transactionHash: string, reason: TransactionNotSentReason) {
    super(`Transaction ${transactionHash} not sent (${reason})`);
    this.name = "TransactionNotSentError";
    this.transactionHash = transactionHash;
  }
}

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
