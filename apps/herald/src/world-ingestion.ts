import type { CheckpointCodec, CheckpointStore } from "./checkpoint-store";
import { LiveWorld, type LiveWorldInput } from "./live-world";
import type { MadaraRpc } from "./madara-rpc";
import type { ModelRegistry } from "./model-registry";
import { loadConfirmedWorld } from "./checkpoint-loader";
import type { WorldEventDecodeMonitor } from "./world-event-decoder";

export interface WorldIngestion {
  registry: ModelRegistry;
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
