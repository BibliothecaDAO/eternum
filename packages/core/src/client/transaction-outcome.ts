import { batchRemaining, gameplayRejection } from "@bibliothecadao/provider";
import type { GetTransactionReceiptResponse, RpcProvider } from "starknet";

import type { GameSyncRuntime } from "../sync/game-sync-runtime";
import { forgetSentTransaction, isDroppedTransaction } from "./submit";

/**
 * How an action ended: applied (its facts are in the store), refused by the game, reverted before the roll, or dropped:
 * never included, its nonce taken by the account's next transaction.
 */
export interface ActionOutcome {
  hash: string;
  block: number | null;
  status: "SUCCEEDED" | "REJECTED" | "REVERTED" | "DROPPED";
  /** The game's reason, or the revert's, for an action that did not apply. */
  revertReason?: string;
  /** What a batched command still has to do after this transaction. */
  batchRemaining?: string;
}

const RECEIPT_POLL_MS = 250;
const DROPPED_REASON = "The transaction was dropped before it was included; nothing of it applied.";
type OutcomeRpc = Pick<RpcProvider, "getTransactionReceipt" | "getNonceForAddress">;

/**
 * An action's outcome from its receipt, then Herald: the receipt says whether the shard reverted it before the roll or
 * the game refused it (GameplayRejected, effects rolled back), and an applied action settles once Herald has applied
 * its facts, either from its streamed status or, after a reconnect that would never stream it, from the fresh
 * snapshot. A transaction with no receipt whose nonce the account has passed is dropped. Until one of these the action
 * is pending; the wait stops when the client does.
 */
export async function waitForActionOutcome(
  runtime: Pick<GameSyncRuntime, "waitForTransaction" | "subscribeResynced">,
  rpc: OutcomeRpc,
  games: string,
  transactionHash: string,
  stopped: AbortSignal,
): Promise<ActionOutcome> {
  const receipt = await receiptOf(rpc, transactionHash, stopped).finally(() => forgetSentTransaction(transactionHash));
  if (receipt === "dropped")
    return { hash: transactionHash, block: null, status: "DROPPED", revertReason: DROPPED_REASON };
  const refused = refusalIn(receipt, games, transactionHash);
  if (refused) return refused;
  const remaining = "events" in receipt ? batchRemaining(receipt.events, games, transactionHash) : undefined;
  // Herald keeps recent statuses, so one it streamed while the receipt was read is still found here.
  const { block } = await settledByHerald(runtime, transactionHash, blockOf(receipt));
  return {
    hash: transactionHash,
    block,
    status: "SUCCEEDED",
    ...(remaining !== undefined ? { batchRemaining: remaining.toString() } : {}),
  };
}

/**
 * The transaction's receipt once it is in a block, pre-confirmed or later, or dropped once its nonce has passed
 * without one (read again after the nonce, which an inclusion between the two reads moves too); not found yet is still
 * pending.
 */
async function receiptOf(
  rpc: OutcomeRpc,
  transactionHash: string,
  stopped: AbortSignal,
): Promise<GetTransactionReceiptResponse | "dropped"> {
  const read = () => rpc.getTransactionReceipt(transactionHash).catch(() => undefined);
  while (true) {
    stopped.throwIfAborted();
    const receipt = await read();
    if (receipt) return receipt;
    if (await isDroppedTransaction(rpc, transactionHash)) return (await read()) ?? "dropped";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stopped.removeEventListener("abort", abort);
        resolve();
      }, RECEIPT_POLL_MS);
      const abort = () => {
        clearTimeout(timer);
        reject(stopped.reason);
      };
      stopped.addEventListener("abort", abort, { once: true });
    });
  }
}

const blockOf = (receipt: GetTransactionReceiptResponse): number | null =>
  "block_number" in receipt && typeof receipt.block_number === "number" ? receipt.block_number : null;

/** A revert or the game's rejection, read from the receipt; nothing of either applied. */
function refusalIn(
  receipt: GetTransactionReceiptResponse,
  games: string,
  transactionHash: string,
): ActionOutcome | undefined {
  const block = blockOf(receipt);
  if ("execution_status" in receipt && receipt.execution_status === "REVERTED")
    return { hash: transactionHash, block, status: "REVERTED", revertReason: receipt.revert_reason };
  const rejection = "events" in receipt ? gameplayRejection(receipt.events, games, transactionHash) : undefined;
  if (!rejection) return undefined;
  return { hash: transactionHash, block, status: "REJECTED", revertReason: rejection.reason || rejection.statusClass };
}

/**
 * Herald's status for the transaction, or a reconnect's fresh snapshot that reaches the receipt's block and so holds
 * its facts. A snapshot older than the receipt, or a receipt with no block yet, leaves the action pending until
 * Herald's status arrives.
 */
function settledByHerald(
  runtime: Pick<GameSyncRuntime, "waitForTransaction" | "subscribeResynced">,
  transactionHash: string,
  receiptBlock: number | null,
): Promise<{ block: number | null }> {
  let stopWatching = () => {};
  const resynced = new Promise<{ block: number }>((resolve) => {
    stopWatching = runtime.subscribeResynced((throughBlock) => {
      if (receiptBlock !== null && throughBlock >= receiptBlock) resolve({ block: receiptBlock });
    });
  });
  return Promise.race([runtime.waitForTransaction(transactionHash), resynced]).finally(() => stopWatching());
}
