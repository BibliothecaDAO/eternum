export interface StoryEventScope {
  chainId: string;
  worldAddress: string;
  gameId: number;
}

const FELT_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;

/** A deployment and game boundary, independent of transport URLs or display names. */
export function storyEventScopeKey(scope: StoryEventScope): string {
  if (!scope.chainId || scope.chainId.trim() !== scope.chainId) throw new Error("StoryEvent requires a chain id");
  if (!Number.isSafeInteger(scope.gameId) || scope.gameId <= 0) {
    throw new Error("StoryEvent requires a positive game id");
  }
  const world = normalizeIdentityFelt(scope.worldAddress, "world address");
  if (world === "0x0") throw new Error("StoryEvent requires a deployed world address");
  return `story:v2:${encodeURIComponent(scope.chainId)}:${world}:${normalizeIdentityFelt(scope.gameId, "game_id")}`;
}

/** The contract's action order and local story index survive receipt reordering and confirmation. */
export function storyEventKeys(value: Record<string, unknown>): readonly [string, string, string] {
  return [
    normalizeStoryInteger(value.game_id, "game_id", 32),
    normalizeStoryInteger(value.order, "order", 64),
    normalizeStoryInteger(value.index, "index", 32),
  ];
}

/** Shared by history, streamed stories and notification deduplication. */
export function storyEventIdentity(scope: StoryEventScope, value: Record<string, unknown>): string {
  const scopeKey = storyEventScopeKey(scope);
  const [gameId, order, index] = storyEventKeys(value);
  if (gameId !== normalizeIdentityFelt(scope.gameId, "game_id")) {
    throw new Error(`StoryEvent game ${gameId} does not match session game ${scope.gameId}`);
  }
  return `${scopeKey}:${order}:${index}`;
}

function normalizeStoryInteger(value: unknown, field: string, bits: number): string {
  const normalized = normalizeIdentityFelt(value, field);
  if (BigInt(normalized) >= 1n << BigInt(bits)) throw new Error(`StoryEvent ${field} must be a u${bits}`);
  return normalized;
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
