export interface StoryEventScope {
  chain: string;
  worldAddress: string;
  gameId: number;
}

const FELT_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

/** A deployment and game boundary, independent of transport URLs or display names. */
export function storyEventScopeKey(scope: StoryEventScope): string {
  if (!scope.chain || scope.chain.trim() !== scope.chain) throw new Error("StoryEvent requires a chain");
  if (!Number.isSafeInteger(scope.gameId) || scope.gameId <= 0) {
    throw new Error("StoryEvent requires a positive game id");
  }
  const world = normalizeIdentityFelt(scope.worldAddress, "world address");
  if (world === "0x0") throw new Error("StoryEvent requires a deployed world address");
  return `story:v1:${encodeURIComponent(scope.chain)}:${world}:${normalizeIdentityFelt(scope.gameId, "game_id")}`;
}

/**
 * Both Herald history and streamed values carry the contract's uuid and tx_hash.
 * Receipt event_index and streamed hashed_keys cannot identify a record across those transports.
 */
export function storyEventIdentity(scope: StoryEventScope, value: Record<string, unknown>): string {
  const scopeKey = storyEventScopeKey(scope);
  const gameId = normalizeIdentityFelt(value.game_id, "game_id");
  if (gameId !== normalizeIdentityFelt(scope.gameId, "game_id")) {
    throw new Error(`StoryEvent game ${gameId} does not match session game ${scope.gameId}`);
  }
  const transactionHash = normalizeIdentityFelt(value.tx_hash, "tx_hash");
  if (transactionHash === "0x0") throw new Error("StoryEvent requires a transaction hash");
  return `${scopeKey}:${transactionHash}:${normalizeIdentityFelt(value.id, "id")}`;
}

function normalizeIdentityFelt(value: unknown, field: string): string {
  const validRepresentation =
    typeof value === "bigint" ||
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value));
  if (!validRepresentation) throw new Error(`StoryEvent ${field} must be a felt`);
  const felt = BigInt(value as string | number | bigint);
  if (felt < 0n || felt >= FELT_PRIME) throw new Error(`StoryEvent ${field} must be a felt`);
  return `0x${felt.toString(16)}`;
}
