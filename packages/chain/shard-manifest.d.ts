import type { ShardIdentity } from "./chain-guard.js";

export function readShardManifest<T extends ShardIdentity = ShardIdentity>(
  path: string | undefined,
): T;
