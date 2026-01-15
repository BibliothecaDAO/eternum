import type { ServerWebSocket } from "bun";

export interface ZoneRegistry {
  addSocketToZone(ws: ServerWebSocket<unknown>, zoneId: string): void;
  removeSocketFromZone(ws: ServerWebSocket<unknown>, zoneId: string): void;
  removeSocketFromAllZones(ws: ServerWebSocket<unknown>): void;
  getSocketsForZone(zoneId: string): ReadonlySet<ServerWebSocket<unknown>>;
  getZonesForSocket(ws: ServerWebSocket<unknown>): ReadonlySet<string>;
}

export const createZoneRegistry = (): ZoneRegistry => {
  const zoneRooms = new Map<string, Set<ServerWebSocket<unknown>>>();
  const socketZones = new WeakMap<ServerWebSocket<unknown>, Set<string>>();

  const getOrCreateZoneSockets = (zoneId: string) => {
    let sockets = zoneRooms.get(zoneId);
    if (!sockets) {
      sockets = new Set<ServerWebSocket<unknown>>();
      zoneRooms.set(zoneId, sockets);
    }
    return sockets;
  };

  const getOrCreateSocketZones = (ws: ServerWebSocket<unknown>) => {
    let zones = socketZones.get(ws);
    if (!zones) {
      zones = new Set<string>();
      socketZones.set(ws, zones);
    }
    return zones;
  };

  const addSocketToZone = (ws: ServerWebSocket<unknown>, zoneId: string) => {
    getOrCreateZoneSockets(zoneId).add(ws);
    getOrCreateSocketZones(ws).add(zoneId);
  };

  const removeSocketFromZone = (ws: ServerWebSocket<unknown>, zoneId: string) => {
    const sockets = zoneRooms.get(zoneId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        zoneRooms.delete(zoneId);
      }
    }

    const zones = socketZones.get(ws);
    if (zones) {
      zones.delete(zoneId);
      if (zones.size === 0) {
        socketZones.delete(ws);
      }
    }
  };

  const removeSocketFromAllZones = (ws: ServerWebSocket<unknown>) => {
    const zones = socketZones.get(ws);
    if (!zones) return;

    for (const zoneId of Array.from(zones)) {
      removeSocketFromZone(ws, zoneId);
    }
  };

  const getSocketsForZone = (zoneId: string): ReadonlySet<ServerWebSocket<unknown>> => {
    return zoneRooms.get(zoneId) ?? new Set<ServerWebSocket<unknown>>();
  };

  const getZonesForSocket = (ws: ServerWebSocket<unknown>): ReadonlySet<string> => {
    return socketZones.get(ws) ?? new Set<string>();
  };

  return {
    addSocketToZone,
    removeSocketFromZone,
    removeSocketFromAllZones,
    getSocketsForZone,
    getZonesForSocket,
  };
};
