import { TransactionNotSentError } from "@bibliothecadao/provider";

import { requireActiveGameClient } from "./active-game-client";

/** An action the game did not apply: refused by its rules or reverted, with the reason the game gave. */
export class ActionNotAppliedError extends Error {
  constructor(reason: string | undefined) {
    super(reason ?? "The game refused the action.");
    this.name = "ActionNotAppliedError";
  }
}

/** What a command resolves with as soon as it is sent; its transaction names the action from then on. */
export type SentCommand = object;

/** The sent command's transaction. A command that resolves without one cannot be followed, which is a bug to hear of. */
export const sentTransactionHash = (sent: SentCommand): string => {
  const hash = "transaction_hash" in sent ? sent.transaction_hash : undefined;
  if (typeof hash !== "string") throw new Error("The command was sent without a transaction hash");
  return hash;
};

/**
 * A sent command's own outcome. A queued command resolves as soon as it is sent, which says nothing of what it did.
 * This resolves with the action's transaction once the game has applied it, with its facts in the store, and rejects
 * with the game's reason when it applied nothing. A send the shard refuses rejects earlier, with the send's own
 * error. When neither Herald nor the node answers in the client's window, it rejects with the client's own no-answer
 * error, whose message says the action may still apply: that frees the surface, and claims nothing of the action.
 */
export const untilApplied = async (sent: Promise<SentCommand>): Promise<string> => {
  const transactionHash = sentTransactionHash(await sent);
  const outcome = await requireActiveGameClient().waitForAction(transactionHash);
  if (outcome.status !== "SUCCEEDED") throw new ActionNotAppliedError(outcome.revertReason);
  return transactionHash;
};

/**
 * Whether a send or its outcome proves the action did not apply: the game refused it (ActionNotAppliedError) or the
 * shard never took it (TransactionNotSentError). Any other failure, a no-answer above all, leaves it unknown: it may
 * still apply, so a surface says so and never sends it again on its own.
 */
export const isDefinitelyNotApplied = (error: unknown): boolean =>
  error instanceof ActionNotAppliedError || error instanceof TransactionNotSentError;
