import { createNativeHistoryCodec } from "./history";
import { buildNativeDirectory, buildNativeLeaderboard } from "./read-models";
import type { NativeIngestion } from "./ingestion";
import { LiveWorld, type LiveWorldInput } from "../live-world";
import { loadNativeWorld } from "./load";

export function createNativeWorldIngestion(native: NativeIngestion) {
  return {
    registry: native.decoder.registry,
    historyCodec: createNativeHistoryCodec(
      native.decoder.manifest.native.schemas[native.decoder.manifest.native.activeSchema],
    ),
    readModels: { directory: buildNativeDirectory, leaderboard: buildNativeLeaderboard },
    load: (input: Omit<Parameters<typeof loadNativeWorld>[0], "native">) => loadNativeWorld({ ...input, native }),
    createLive: (input: LiveWorldInput) => new LiveWorld({ ...input, native }),
  };
}
