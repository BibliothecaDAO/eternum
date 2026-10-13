/** An explicit admission refusal: this request was not accepted. Silence is never proof of a drop. */
export class TransactionNotSentError extends Error {
  readonly transactionHash: string;

  constructor(transactionHash: string, options?: ErrorOptions) {
    super(`Transaction ${transactionHash} not sent (refused)`, options);
    this.name = "TransactionNotSentError";
    this.transactionHash = transactionHash;
  }
}

/** Labels an unsettled action as checking after five 2 s blocks; it never releases a send or proves failure. */
export const ACTION_CHECKING_AFTER_MS = 10_000;
