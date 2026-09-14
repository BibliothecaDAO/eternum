import type { WorldIngestion } from "../world-ingestion";
import type { NativeIngestion } from "./ingestion";
import { NativeLiveWorld } from "./live-world";
import { loadNativeWorld } from "./load";
import { nativeCheckpointCodec } from "./world-fold";

export function createNativeWorldIngestion(native: NativeIngestion): WorldIngestion {
  return {
    registry: native.decoder.registry,
    checkpointCodec: nativeCheckpointCodec,
    load: (input) => loadNativeWorld({ ...input, native }),
    createLive: (input) => new NativeLiveWorld({ ...input, native }),
  };
}
