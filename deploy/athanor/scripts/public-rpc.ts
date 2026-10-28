/**
 * What a shard's public RPC answers, apart from plays: read-rpc.ts, and read-only-rpc.ts (deploy/shard), which stands
 * in for a proxy older than the write switch while a final backup is taken. Dependency-free, so a box runs that stand-in
 * from its checkout with no install.
 */
export const READ_METHODS = new Set([
  "starknet_specVersion",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_blockHashAndNumber",
  "starknet_syncing",
  "starknet_getBlockWithTxHashes",
  "starknet_getStateUpdate",
  "starknet_getStorageAt",
  "starknet_getTransactionStatus",
  "starknet_getTransactionReceipt",
  "starknet_getClass",
  "starknet_getClassHashAt",
  "starknet_getClassAt",
  "starknet_getBlockTransactionCount",
  "starknet_call",
  "starknet_estimateMessageFee",
  "starknet_getEvents",
  "starknet_getNonce",
  "starknet_getStorageProof",
  "starknet_getCompiledCasm",
]);

/** The writes a shard accepts through its proxy: a play or an account operation, judged there. */
export const WRITE_METHODS = new Set([
  "starknet_addInvokeTransaction",
  "starknet_addDeployAccountTransaction",
  "starknet_addDeclareTransaction",
]);

/** The file backup.py quiesce writes into the proxy's /config volume, and the refusal every write then gets. */
export const WRITES_CLOSED_FILE = "/config/writes-closed";
export const WRITES_CLOSED_MESSAGE = "Shard writes are closed for its final backup";

// A browser preflights every JSON POST; without a max age it keeps the answer 5 s, so nearly every player action would
// wait one extra round trip for it. Chromium honours at most two hours.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "7200",
};
