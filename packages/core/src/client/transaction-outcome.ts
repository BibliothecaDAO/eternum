import { batchRemaining, gameplayRejection, TransactionType } from "@bibliothecadao/provider";
import type { GetTransactionReceiptResponse, RpcProvider } from "starknet";

import type { GameSyncRuntime } from "../sync/game-sync-runtime";
import type { GameSyncTransaction } from "../sync/game-sync-types";

/** How an action ended: applied (its facts are in the store), refused by the game, or reverted before the roll. */
export interface ActionOutcome {
  hash: string;
  block: number | null;
  status: "SUCCEEDED" | "REJECTED" | "REVERTED";
  /** The game's reason, or the revert's, for an action that did not apply. */
  revertReason?: string;
  /** What a batched command still has to do after this transaction. */
  batchRemaining?: string;
}

type Runtime = Pick<GameSyncRuntime, "waitForTransaction" | "subscribeResynced">;
type Rpc = Pick<RpcProvider, "getTransactionReceipt">;

const RECEIPT_POLL_MS = 250;
/** Batch progress is absent from Herald's status; retain the existing receipt grace only for batch commands. */
const RECEIPT_GRACE_MS = 2_000;
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
  transactionType?: TransactionType,
): Promise<ActionOutcome> {
  const settled = new AbortController();
  const until = AbortSignal.any([stopped, settled.signal]);
  let read: GetTransactionReceiptResponse | undefined;
  let reported: GameSyncTransaction | undefined;
  const herald = runtime
    .waitForTransaction(transactionHash)
    .then((status) => (reported = status))
    .catch(silent);
  const receipt = Promise.resolve()
    .then(() =>
      reported && (appliedNothing(reported) || !isBatchCommand(transactionType))
        ? silent()
        : receiptOf(rpc, transactionHash, until),
    )
    .then((value) => (read = value));
  const outcome = herald.then(async (status) => {
    if (!appliedNothing(status) && isBatchCommand(transactionType) && !read) {
      await Promise.race([receipt.catch(() => undefined), pause(RECEIPT_GRACE_MS, until)]);
    }
    return outcomeFromHerald(status, games, transactionHash, read);
  });
  try {
    return await Promise.race([
      outcomeFromReceipt(runtime, rpc, games, transactionHash, receipt, until),
      outcome,
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

const isBatchCommand = (type: TransactionType | undefined): boolean =>
  type === TransactionType.END_GAME || type === TransactionType.BITCOIN_MINE_CLAIM_PHASE_REWARD;

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
  return succeeded(transactionHash, block, read, games);
}

/** Herald has already written the facts. Include batch progress only if its receipt is already available. */
function outcomeFromHerald(
  status: GameSyncTransaction,
  games: string,
  transactionHash: string,
  receipt: GetTransactionReceiptResponse | undefined,
): ActionOutcome {
  if (appliedNothing(status)) {
    return { hash: transactionHash, block: status.block, status: status.status, revertReason: status.revertReason };
  }
  return succeeded(transactionHash, status.block, receipt, games);
}

/** Reverted before the roll, or refused by the game (rolled back): either way none of it applied. */
const appliedNothing = (
  transaction: GameSyncTransaction,
): transaction is GameSyncTransaction & { status: "REVERTED" | "REJECTED" } =>
  transaction.status === "REVERTED" || transaction.status === "REJECTED";

function succeeded(
  transactionHash: string,
  block: number | null,
  receipt: GetTransactionReceiptResponse | undefined,
  games: string,
): ActionOutcome {
  const remaining =
    receipt && "events" in receipt
      ? batchRemaining(receipt.events, games, transactionHash, { missing: "allow" })
      : undefined;
  return {
    hash: transactionHash,
    block,
    status: "SUCCEEDED",
    ...(remaining !== undefined ? { batchRemaining: remaining.toString() } : {}),
  };
}

/** The transaction's receipt once it is in a block, pre-confirmed or later; a read that fails is retried. */
async function receiptOf(
  rpc: Rpc,
  transactionHash: string,
  until: AbortSignal,
): Promise<GetTransactionReceiptResponse> {
  while (true) {
    until.throwIfAborted();
    const receipt = await rpc.getTransactionReceipt(transactionHash).catch(() => undefined);
    until.throwIfAborted();
    if (receipt) return receipt;
    await pause(RECEIPT_POLL_MS, until);
  }
}

/** Resolves after `ms`, or rejects with the signal's reason when it aborts first. */
const pause = (ms: number, until: AbortSignal): Promise<undefined> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      until.removeEventListener("abort", abort);
      resolve(undefined);
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(until.reason);
    };
    until.addEventListener("abort", abort, { once: true });
  });

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
