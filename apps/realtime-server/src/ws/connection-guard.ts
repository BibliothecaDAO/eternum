interface ConnectionGuard {
  canConnect(playerId: string): boolean;
  connected(playerId: string): void;
  disconnected(playerId: string): void;
  consume(socket: object, now?: number): boolean;
  forget(socket: object): void;
  count(): number;
}

export const frameByteLength = (data: unknown): number => {
  if (typeof data === "string") return new TextEncoder().encode(data).byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return Number.POSITIVE_INFINITY;
};

export const createConnectionGuard = ({
  globalCap,
  perPlayerCap,
  messagesPerSecond,
  messageBurst,
}: {
  globalCap: number;
  perPlayerCap: number;
  messagesPerSecond: number;
  messageBurst: number;
}): ConnectionGuard => {
  const playerConnections = new Map<string, number>();
  const buckets = new WeakMap<object, { tokens: number; updatedAt: number }>();
  let connections = 0;

  return {
    canConnect: (playerId) => connections < globalCap && (playerConnections.get(playerId) ?? 0) < perPlayerCap,
    connected: (playerId) => {
      connections += 1;
      playerConnections.set(playerId, (playerConnections.get(playerId) ?? 0) + 1);
    },
    disconnected: (playerId) => {
      connections = Math.max(0, connections - 1);
      const remaining = Math.max(0, (playerConnections.get(playerId) ?? 1) - 1);
      if (remaining === 0) playerConnections.delete(playerId);
      else playerConnections.set(playerId, remaining);
    },
    consume: (socket, now = Date.now()) => {
      const bucket = buckets.get(socket) ?? { tokens: messageBurst, updatedAt: now };
      bucket.tokens = Math.min(messageBurst, bucket.tokens + ((now - bucket.updatedAt) / 1_000) * messagesPerSecond);
      bucket.updatedAt = now;
      if (bucket.tokens < 1) {
        buckets.set(socket, bucket);
        return false;
      }
      bucket.tokens -= 1;
      buckets.set(socket, bucket);
      return true;
    },
    forget: (socket) => buckets.delete(socket),
    count: () => connections,
  };
};
