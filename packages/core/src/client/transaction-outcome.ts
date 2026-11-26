import { gameplayRejection } from "@bibliothecadao/provider";
import type { GetTransactionReceiptResponse, RpcProvider } from "starknet";

import { pause, transactionAnswer, TransactionNoAnswerError } from "./transaction-answer";

import type { GameSyncRuntime } from "../sync/game-sync-runtime";
import type { GameSyncTransaction } from "../sync/game-sync-types";

/** How an action ended: applied (its facts are in the store), refused by the game, or reverted before the roll. */
export interface ActionOutcome {
  hash: string;
  block: number | null;
  status: "SUCCEEDED" | "REJECTED" | "REVERTED";
  /** The game's reason, or the revert's, for an action that did not apply. */
  revertReason?: string;
}

type Runtime = Pick<GameSyncRuntime, "waitForTransaction" | "subscribeResynced">;
type Rpc = Pick<RpcProvider, "getTransactionReceipt">;

/** A source with nothing to say leaves the race to the others; one per wait, so nothing holds on to it. */
const silent = (): Promise<never> => new Promise<never>(() => {});

/** Herald settles after its facts are applied. RPC reconciliation is a fallback while Herald is silent. */
export async function waitForActionOutcome(
  runtime: Runtime,
  rpc: Rpc,
  games: string,
  transactionHash: string,
  stopped: AbortSignal,
  inBlock?: Promise<void>,
  startedAt?: number,
): Promise<ActionOutcome> {
  const settled = new AbortController();
  const until = AbortSignal.any([stopped, settled.signal]);
  let reported: GameSyncTransaction | undefined;
  const herald = runtime
    .waitForTransaction(transactionHash)
    .then((status) => (reported = status))
    .catch(silent);
  const outcome = herald.then((status) => outcomeFromHerald(status, transactionHash));
  try {
    return await Promise.race([
      transactionAnswer(
        transactionHash,
        outcome,
        async (fallbackUntil) => {
          const receipt = await rpc.getTransactionReceipt(transactionHash).catch(() => undefined);
          if (!receipt) throw new TransactionNoAnswerError(transactionHash);
          return outcomeFromReceipt(runtime, rpc, games, transactionHash, Promise.resolve(receipt), fallbackUntil);
        },
        until,
        startedAt,
      ),
      inBlock?.then(silent, (error) => {
        // A cached Herald status wins even if both answers were already available when the wait began.
        if (reported) return outcome;
        throw error;
      }) ?? silent(),
    ]);
  } finally {
    settled.abort();
  }
}

/** The receipt's refusal, or, for an applied receipt, success once an applied snapshot covers its block. */
async function outcomeFromReceipt(
  runtime: Runtime,
  rpc: Rpc,
  games: string,
  transactionHash: string,
  receipt: Promise<GetTransactionReceiptResponse>,
  until: AbortSignal,
): Promise<ActionOutcome> {
  const read = await receipt;
  const refused = refusalIn(read, games, transactionHash);
  if (refused) return refused;
  const block = await coveredBySnapshot(runtime, rpc, transactionHash, blockOf(read), until);
  return succeeded(transactionHash, block);
}

function outcomeFromHerald(status: GameSyncTransaction, transactionHash: string): ActionOutcome {
  if (appliedNothing(status)) {
    return { hash: transactionHash, block: status.block, status: status.status, revertReason: status.revertReason };
  }
  return succeeded(transactionHash, status.block);
}

/** Reverted before the roll, or refused by the game (rolled back): either way none of it applied. */
const appliedNothing = (
  transaction: GameSyncTransaction,
): transaction is GameSyncTransaction & { status: "REVERTED" | "REJECTED" } =>
  transaction.status === "REVERTED" || transaction.status === "REJECTED";

function succeeded(transactionHash: string, block: number | null): ActionOutcome {
  return { hash: transactionHash, block, status: "SUCCEEDED" };
}

export const waitForConfirmedActionReceipt = (
  rpc: Rpc,
  games: string,
  hash: string,
  stopped?: AbortSignal,
  startedAt?: number,
): Promise<ActionOutcome> =>
  transactionAnswer(
    hash,
    undefined,
    async (until) => {
      for (;;) {
        until.throwIfAborted();
        const receipt = await rpc.getTransactionReceipt(hash).catch(() => undefined);
        const preconfirmed =
          receipt && "finality_status" in receipt && String(receipt.finality_status) === "PRE_CONFIRMED";
        const block = receipt && !preconfirmed ? blockOf(receipt) : null;
        if (receipt && block !== null) return refusalIn(receipt, games, hash) ?? succeeded(hash, block);
        await pause(1_000, until);
      }
    },
    stopped,
    startedAt,
  );

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
 * The block of an applied snapshot that reaches the receipt's block and so holds its facts. The runtime replays the
 * last one when the wait starts listening, so a reconnect that finished while the receipt was being read still
 * counts. A pre-confirmed receipt has no block yet; each snapshot re-reads it, so a confirmed one can settle it once
 * its block is known. Until then, or once `until` aborts, it says nothing.
 */
function coveredBySnapshot(
  runtime: Runtime,
  rpc: Rpc,
  transactionHash: string,
  receiptBlock: number | null,
  until: AbortSignal,
): Promise<number> {
  let block = receiptBlock;
  const blockOnceKnown = async (): Promise<number | null> =>
    (block ??= await rpc.getTransactionReceipt(transactionHash).then(blockOf, () => null));
  return new Promise<number>((resolve) => {
    const stopWatching = runtime.subscribeResynced((throughBlock) => {
      void blockOnceKnown().then((known) => {
        if (known !== null && throughBlock >= known) resolve(known);
      });
    });
    until.addEventListener("abort", stopWatching, { once: true });
  });
}
