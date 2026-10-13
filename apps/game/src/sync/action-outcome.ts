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
 * This resolves once the game has applied the action, with its facts in the store, and rejects with the game's reason
 * when it applied nothing. A send the shard refuses rejects earlier, with the send's own error. An action whose
 * outcome is not known yet keeps waiting: nothing here infers one from time passing.
 */
export const untilApplied = async (sent: Promise<SentCommand>): Promise<void> => {
  const outcome = await requireActiveGameClient().waitForAction(sentTransactionHash(await sent));
  if (outcome.status !== "SUCCEEDED") throw new ActionNotAppliedError(outcome.revertReason);
};
