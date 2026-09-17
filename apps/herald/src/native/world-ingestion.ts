import { createNativeHistoryCodec } from "./history";
import { buildNativeDirectory, buildNativeLeaderboard } from "./read-models";
import type { WorldIngestion } from "../world-ingestion";
import type { NativeIngestion } from "./ingestion";
import { NativeLiveWorld } from "./live-world";
import { loadNativeWorld } from "./load";
import { nativeCheckpointCodec } from "./world-fold";

export function createNativeWorldIngestion(native: NativeIngestion): WorldIngestion {
  return {
    registry: native.decoder.registry,
    historyCodec: createNativeHistoryCodec(
      native.decoder.manifest.native.schemas[native.decoder.manifest.native.activeSchema],
    ),
    readModels: { directory: buildNativeDirectory, leaderboard: buildNativeLeaderboard },
    checkpointCodec: nativeCheckpointCodec,
    load: (input) => loadNativeWorld({ ...input, native }),
    createLive: (input) => new NativeLiveWorld({ ...input, native }),
  };
}
