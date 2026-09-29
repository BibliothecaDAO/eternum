import type { NativeTicketIdentity } from "@bibliothecadao/types";
import type { GameSyncRuntime } from "../sync/game-sync-runtime";
import type { GameSyncTransaction } from "../sync/game-sync-types";
import type { NativeFactStore } from "./native-fact-store";

/** The action was recorded while the stream was reconnecting, so Herald will never stream its status. */
export class ActionOutcomeUnreportedError extends Error {
  constructor(transactionHash: string) {
    super(
      `Transaction ${transactionHash} was recorded while Herald reconnected; its outcome is in the world, unreported`,
    );
    this.name = "ActionOutcomeUnreportedError";
  }
}

/**
 * A native action's wait ends with its streamed status or, after a reconnect's fresh snapshot, as soon as the store
 * shows the actor's nonce past the ticket's: that action is recorded and its status will never be streamed. The store
 * then holds the actor's current nonce, so the next action signs against it.
 */
export const waitForTransactionOutcome = (
  runtime: Pick<GameSyncRuntime, "waitForTransaction" | "subscribeResynced">,
  store: Pick<NativeFactStore, "get">,
  transactionHash: string,
  ticket: NativeTicketIdentity | undefined,
): Promise<GameSyncTransaction> => {
  const reported = runtime.waitForTransaction(transactionHash);
  if (!ticket) return reported;
  const nonceKey = { game_id: Number(ticket.gameId), actor: BigInt(ticket.actor) };
  let stopWatching = () => {};
  const recorded = new Promise<never>((_, reject) => {
    stopWatching = runtime.subscribeResynced(() => {
      const nextNonce = store.get("ActionNonce", nonceKey)?.next_nonce;
      if (nextNonce !== undefined && nextNonce > BigInt(ticket.nonce))
        reject(new ActionOutcomeUnreportedError(transactionHash));
    });
  });
  return Promise.race([reported, recorded]).finally(() => stopWatching());
};
