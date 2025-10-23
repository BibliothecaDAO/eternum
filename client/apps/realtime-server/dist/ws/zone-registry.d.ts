import type { ServerWebSocket } from "bun";
export interface ZoneRegistry {
    addSocketToZone(ws: ServerWebSocket<unknown>, zoneId: string): void;
    removeSocketFromZone(ws: ServerWebSocket<unknown>, zoneId: string): void;
    removeSocketFromAllZones(ws: ServerWebSocket<unknown>): void;
    getSocketsForZone(zoneId: string): ReadonlySet<ServerWebSocket<unknown>>;
    getZonesForSocket(ws: ServerWebSocket<unknown>): ReadonlySet<string>;
}
export declare const createZoneRegistry: () => ZoneRegistry;
