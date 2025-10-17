import type { WSContext } from "hono/ws";

export interface ZoneRegistry {
  addSocketToZone(ws: WSContext<unknown>, zoneId: string): void;
  removeSocketFromZone(ws: WSContext<unknown>, zoneId: string): void;
  removeSocketFromAllZones(ws: WSContext<unknown>): void;
  getSocketsForZone(zoneId: string): ReadonlySet<WSContext<unknown>>;
  getZonesForSocket(ws: WSContext<unknown>): ReadonlySet<string>;
}

export const createZoneRegistry = (): ZoneRegistry => {
  const zoneRooms = new Map<string, Set<WSContext<unknown>>>();
  const socketZones = new WeakMap<WSContext<unknown>, Set<string>>();

  const getOrCreateZoneSockets = (zoneId: string) => {
    let sockets = zoneRooms.get(zoneId);
    if (!sockets) {
      sockets = new Set<WSContext<unknown>>();
      zoneRooms.set(zoneId, sockets);
    }
    return sockets;
  };

  const getOrCreateSocketZones = (ws: WSContext<unknown>) => {
    let zones = socketZones.get(ws);
    if (!zones) {
      zones = new Set<string>();
      socketZones.set(ws, zones);
    }
    return zones;
  };

  const addSocketToZone = (ws: WSContext<unknown>, zoneId: string) => {
    getOrCreateZoneSockets(zoneId).add(ws);
    getOrCreateSocketZones(ws).add(zoneId);
  };

  const removeSocketFromZone = (ws: WSContext<unknown>, zoneId: string) => {
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

  const removeSocketFromAllZones = (ws: WSContext<unknown>) => {
    const zones = socketZones.get(ws);
    if (!zones) return;

    for (const zoneId of Array.from(zones)) {
      removeSocketFromZone(ws, zoneId);
    }
  };

  const getSocketsForZone = (zoneId: string): ReadonlySet<WSContext<unknown>> => {
    return zoneRooms.get(zoneId) ?? new Set<WSContext<unknown>>();
  };

  const getZonesForSocket = (ws: WSContext<unknown>): ReadonlySet<string> => {
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
