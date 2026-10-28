/**
 * The bounds of a shard's public RPC: its proxy (read-rpc.ts) and the read-only stand-in that replaces an older proxy
 * during a final backup (deploy/shard/read-only-rpc.ts) refuse anything larger before the node is asked, and the relay
 * batches its reads within them. Dependency-free, so the stand-in runs from a checkout with no install.
 */
export const SHARD_RPC_MAX_BATCH_CALLS = 32;
/** One request's body, a signed transaction included. */
export const SHARD_RPC_MAX_REQUEST_BYTES = 1024 * 1024;
