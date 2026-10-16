import { PLAY_REFUSALS, type PlayRefusalReason } from "./play-refusal";

/**
 * An explicit admission refusal: this request was not accepted. Silence is never proof of a drop. Its message is the
 * one a player reads: the reason the shard named, or that it refused.
 */
export class TransactionNotSentError extends Error {
  readonly transactionHash: string;

  constructor(transactionHash: string, options?: ErrorOptions & { reason?: PlayRefusalReason }) {
    super(options?.reason ? PLAY_REFUSALS[options.reason] : "The shard refused this action. Try again.", options);
    this.name = "TransactionNotSentError";
    this.transactionHash = transactionHash;
  }
}

/** Labels an unsettled action as checking after five 2 s blocks; it never releases a send or proves failure. */
export const ACTION_CHECKING_AFTER_MS = 10_000;
