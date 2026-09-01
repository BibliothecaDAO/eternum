import type { PlayerPresencePayload } from "@bibliothecadao/types";
import type { PlayerSession } from "../http/middleware/auth";

interface PresenceRegistry<Socket extends object> {
  connect(session: PlayerSession, socket: Socket): boolean;
  disconnect(playerId: string, socket: Socket): boolean;
  get(playerId: string): PlayerPresencePayload | undefined;
  snapshot(playerIds?: ReadonlySet<string>): PlayerPresencePayload[];
  socketsFor(playerId: string): ReadonlySet<Socket>;
  size(): number;
}

export const createPresenceRegistry = <Socket extends object>(): PresenceRegistry<Socket> => {
  const socketsByPlayer = new Map<string, Set<Socket>>();
  const presenceByPlayer = new Map<string, PlayerPresencePayload>();

  return {
    connect: (session, socket) => {
      const sockets = socketsByPlayer.get(session.playerId) ?? new Set<Socket>();
      const firstConnection = sockets.size === 0;
      sockets.add(socket);
      socketsByPlayer.set(session.playerId, sockets);
      presenceByPlayer.set(session.playerId, {
        playerId: session.playerId,
        displayName: session.displayName ?? null,
        isOnline: true,
        isTypingInThreadIds: [],
      });
      return firstConnection;
    },
    disconnect: (playerId, socket) => {
      const sockets = socketsByPlayer.get(playerId);
      if (!sockets) return false;
      sockets.delete(socket);
      if (sockets.size > 0) return false;
      socketsByPlayer.delete(playerId);
      presenceByPlayer.delete(playerId);
      return true;
    },
    get: (playerId) => presenceByPlayer.get(playerId),
    snapshot: (playerIds) =>
      Array.from(presenceByPlayer.values()).filter((presence) => !playerIds || playerIds.has(presence.playerId)),
    socketsFor: (playerId) => socketsByPlayer.get(playerId) ?? new Set<Socket>(),
    size: () => presenceByPlayer.size,
  };
};
