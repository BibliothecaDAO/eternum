import { confirmedGameTransactions } from "./transactions";
import type { CheckpointStore } from "../checkpoint-store";
import type { HistoryStore } from "../history-store";
import type { MadaraRpc } from "../madara-rpc";
import { WorldFold } from "../world-fold";
import { NativeReceiptRejected, type NativeIngestion } from "./ingestion";

import { replayWithFrontierDays } from "./frontier-day-ranks";

const REPLAY_WINDOW_BLOCKS = 64;

/** Each bounded replay window commits its history before its checkpoint; startup resumes at the last complete window. */
export async function loadNativeWorld(input: {
  chain: string;
  checkpointStore: Pick<CheckpointStore, "initialize" | "load" | "save">;
  history: Pick<HistoryStore, "appendEvents" | "historyProgress" | "frontierHistory" | "transactionHistoryProgress">;
  rpc: MadaraRpc;
  native: NativeIngestion;
}) {
  const started = performance.now();
  const registry = input.native.decoder.registry;
  await input.checkpointStore.initialize();
  const checkpoint = await resumableCheckpoint(input);
  const targetBlock = await input.rpc.blockNumber();
  let confirmedBlock = checkpoint?.confirmedBlock ?? 0;
  if (checkpoint && checkpoint.confirmedBlock > targetBlock) throw new Error("Native checkpoint is ahead of chain");
  if (checkpoint) await repairTransactionHistory(input, checkpoint.confirmedBlock);
  const fold = checkpoint?.fold ?? new WorldFold(registry);
  const metrics = { decoded_events: 0, event_messages: 0, store_events: 0, pages: 0 };
  let checkpointBlock = checkpoint?.confirmedBlock;
  try {
    for (let fromBlock = checkpoint ? checkpoint.confirmedBlock + 1 : 0; fromBlock <= targetBlock; ) {
      const toBlock = Math.min(fromBlock + REPLAY_WINDOW_BLOCKS - 1, targetBlock);
      const window = await replayWindow(input, fold, fromBlock, toBlock);
      for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) metrics[key] += window.metrics[key];
      confirmedBlock = window.throughBlock;
      checkpointBlock = window.throughBlock;
      fromBlock = window.throughBlock + 1;
    }
  } catch (error) {
    // Keep the last valid checkpoint available for inspection. Restart with a corrected release to resume.
    if (!(error instanceof NativeReceiptRejected)) throw error;
  }
  return {
    checkpointBlock,
    confirmedBlock,
    fold,
    metrics: { ...metrics, retained_rows: fold.retainedRowCount() },
    startupMs: Math.round(performance.now() - started),
  };
}

/** No decoded rows or receipt arrays escape a window into the startup loop. */
async function replayWindow(
  input: Parameters<typeof loadNativeWorld>[0],
  fold: WorldFold,
  fromBlock: number,
  toBlock: number,
) {
  const replay = await replayWithFrontierDays(input.native, input.history, {
    fold,
    rpc: input.rpc,
    fromBlock,
    toBlock,
    retainTransactions: true,
  });
  await input.checkpointStore.save(input.chain, replay.throughBlock, fold);
  return { metrics: replay.metrics, throughBlock: replay.throughBlock };
}

/** Legacy counts can be incomplete while the entity checkpoint is sound; repair only routing history. */
async function repairTransactionHistory(input: Parameters<typeof loadNativeWorld>[0], through: number): Promise<void> {
  const covered = await input.history.transactionHistoryProgress();
  for (
    let number = Math.max((covered ?? -1) + 1, input.native.decoder.manifest.native.deploymentBlock);
    number <= through;
    number++
  ) {
    const block = await input.rpc.readBlock(number, input.native.decoder.manifest.world.address, {
      retainTransactions: true,
    });
    if (block.block_number !== number) throw new Error("Transaction history block number mismatch");
    const transactions = block.transactions.map(({ transaction, receipt }) => ({
      transaction,
      receipt: { ...receipt, block_number: number },
    }));
    await input.history.appendEvents(
      [],
      number,
      undefined,
      confirmedGameTransactions(input.native.decoder.manifest, transactions),
    );
  }
}

/** A checkpoint the history does not reach would leave a gap in history, so both are rebuilt from genesis instead. */
async function resumableCheckpoint(input: Parameters<typeof loadNativeWorld>[0]) {
  const checkpoint = await input.checkpointStore.load(input.chain, input.native.decoder.registry);
  if (!checkpoint) return undefined;
  const historyThrough = (await input.history.historyProgress(true)) ?? -1;
  return historyThrough >= checkpoint.confirmedBlock ? checkpoint : undefined;
}
