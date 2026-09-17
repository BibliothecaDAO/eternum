import { dojoHistoryCodec, type HistoryCodec } from "./history-store";
import type { WorldReadModels } from "./http";
import { buildGameDirectory } from "./game-directory";
import { buildLiveLeaderboard } from "./live-leaderboard";
import type { CheckpointCodec, CheckpointStore } from "./checkpoint-store";
import { LiveWorld, type LiveWorldInput } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import type { ModelRegistry } from "./model-registry";
import { loadConfirmedWorld } from "./checkpoint-loader";
import type { WorldEventDecodeMonitor } from "./world-event-decoder";

export interface WorldIngestion {
  registry: ModelRegistry;
  readModels: WorldReadModels;
  historyCodec: HistoryCodec;
  checkpointCodec?: CheckpointCodec;
  load(input: {
    chain: string;
    checkpointStore: CheckpointStore;
    rpc: MadaraRpc;
  }): ReturnType<typeof loadConfirmedWorld>;
  createLive(input: LiveWorldInput): LiveWorld;
}

export function createDojoWorldIngestion(
  registry: ModelRegistry,
  decodeMonitor: WorldEventDecodeMonitor,
): WorldIngestion {
  return {
    registry,
    historyCodec: dojoHistoryCodec,
    readModels: { directory: buildGameDirectory, leaderboard: buildLiveLeaderboard },
    load: (input) =>
      loadConfirmedWorld({
        ...input,
        registry,
        decodeMonitor,
        onPage: ({ number, eventCount }) => {
          if (number % 25 === 0)
            console.info(JSON.stringify({ event: "herald_replay_progress", eventCount, page: number }));
        },
      }),
    createLive: (input) => new LiveWorld(input),
  };
}
