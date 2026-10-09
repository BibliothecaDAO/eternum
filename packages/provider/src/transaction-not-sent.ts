/**
 * Why an action is in no block: the stamping endpoint refused it, another transaction took its nonce, or the node
 * never held it while the account's nonce stayed put.
 */
type TransactionNotSentReason = "refused" | "replaced" | "dropped";

/** An action proven absent from every block: nothing of it applied, and the account's next send may go. */
export class TransactionNotSentError extends Error {
  constructor(transactionHash: string, reason: TransactionNotSentReason) {
    super(`Transaction ${transactionHash} not sent (${reason})`);
    this.name = "TransactionNotSentError";
  }
}
