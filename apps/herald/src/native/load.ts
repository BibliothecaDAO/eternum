import type { CheckpointStore } from "../checkpoint-store";
import type { HistoryStore } from "../history-store";
import type { MadaraRpc } from "../madara-rpc";
import { WorldFold } from "../world-fold";
import { NativeReceiptRejected, type NativeIngestion } from "./ingestion";

/** One replay brings the fold and the history to the chain head; history is always written before the checkpoint. */
export async function loadNativeWorld(input: {
  chain: string;
  checkpointStore: Pick<CheckpointStore, "initialize" | "load" | "save">;
  history: Pick<HistoryStore, "appendEvents" | "historyProgress">;
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
  const fold = checkpoint?.fold ?? new WorldFold(registry);
  let metrics = { decoded_events: 0, event_messages: 0, store_events: 0, pages: 0 };
  try {
    const replay = await input.native.replay({
      fold,
      rpc: input.rpc,
      fromBlock: checkpoint ? checkpoint.confirmedBlock + 1 : 0,
      toBlock: targetBlock,
    });
    metrics = replay.metrics;
    await input.history.appendEvents(
      replay.events.filter((event) => event.kind === "event"),
      targetBlock,
    );
    confirmedBlock = targetBlock;
    if (!checkpoint) await input.checkpointStore.save(input.chain, confirmedBlock, fold);
  } catch (error) {
    // Keep the last valid checkpoint available for inspection. Restart with a corrected release to resume.
    if (!(error instanceof NativeReceiptRejected)) throw error;
  }
  return {
    checkpointBlock: checkpoint?.confirmedBlock,
    confirmedBlock,
    fold,
    metrics: { ...metrics, retained_rows: fold.retainedRowCount() },
    startupMs: Math.round(performance.now() - started),
  };
}

/** A checkpoint the history does not reach would leave a gap in history, so both are rebuilt from genesis instead. */
async function resumableCheckpoint(input: Parameters<typeof loadNativeWorld>[0]) {
  const checkpoint = await input.checkpointStore.load(input.chain, input.native.decoder.registry);
  if (!checkpoint) return undefined;
  const historyThrough = (await input.history.historyProgress()) ?? -1;
  return historyThrough >= checkpoint.confirmedBlock ? checkpoint : undefined;
}
