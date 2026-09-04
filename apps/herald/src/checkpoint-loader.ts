import type { ModelRegistry } from "./model-registry";
import { MadaraRpc } from "./madara-rpc";
import { buildWorldFold } from "./snapshot-builder";
import type { ReplayMetrics } from "./types";
import { WorldFold } from "./world-fold";
import type { CheckpointStore } from "./checkpoint-store";
import type { WorldEventDecodeMonitor } from "./world-event-decoder";

interface LoadConfirmedWorldInput {
  chain: string;
  checkpointStore: Pick<CheckpointStore, "initialize" | "load" | "save">;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  onPage?: (page: { number: number; eventCount: number }) => void;
  decodeMonitor: WorldEventDecodeMonitor;
}

interface LoadedConfirmedWorld {
  checkpointBlock?: number;
  confirmedBlock: number;
  fold: WorldFold;
  metrics: ReplayMetrics;
  startupMs: number;
}

export const loadConfirmedWorld = async ({
  chain,
  checkpointStore,
  registry,
  rpc,
  onPage,
  decodeMonitor,
}: LoadConfirmedWorldInput): Promise<LoadedConfirmedWorld> => {
  const startedAt = performance.now();
  await checkpointStore.initialize();
  const checkpoint = await checkpointStore.load(chain, registry);
  const head = await rpc.blockNumber();
  if (checkpoint && checkpoint.confirmedBlock > head) {
    throw new Error(`Checkpoint block ${checkpoint.confirmedBlock} is ahead of Madara head ${head}`);
  }

  const built = await buildWorldFold({
    confirmedBlock: head,
    decodeMonitor,
    fold: checkpoint?.fold,
    fromBlock: checkpoint ? checkpoint.confirmedBlock + 1 : 0,
    onPage,
    registry,
    rpc,
  });
  if (!checkpoint) await checkpointStore.save(chain, built.confirmedBlock, built.fold);

  return {
    checkpointBlock: checkpoint?.confirmedBlock,
    confirmedBlock: built.confirmedBlock,
    fold: built.fold,
    metrics: built.metrics,
    startupMs: Math.round(performance.now() - startedAt),
  };
};
