import { readFileSync } from "node:fs";

import { shardChainId } from "./chain-guard.js";

export function readShardManifest(path) {
  if (!path) throw new Error("NATIVE_WORLD_MANIFEST is required");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  shardChainId(manifest);
  return manifest;
}
