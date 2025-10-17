import { describe, expect, it } from "vitest";

import { createZoneRegistry } from "./zone-registry";
import type { WSContext } from "hono/ws";

const createMockSocket = () => ({} as unknown as WSContext<unknown>);

describe("createZoneRegistry", () => {
  it("adds sockets to zones and tracks membership", () => {
    const registry = createZoneRegistry();
    const socket = createMockSocket();

    registry.addSocketToZone(socket, "zone-1");

    expect(registry.getSocketsForZone("zone-1").has(socket)).toBe(true);
    expect(registry.getZonesForSocket(socket).has("zone-1")).toBe(true);
  });

  it("removes sockets from specific zones and cleans up empty state", () => {
    const registry = createZoneRegistry();
    const socket = createMockSocket();

    registry.addSocketToZone(socket, "zone-1");
    registry.removeSocketFromZone(socket, "zone-1");

    expect(registry.getSocketsForZone("zone-1").size).toBe(0);
    expect(registry.getZonesForSocket(socket).size).toBe(0);
  });

  it("removes sockets from all zones", () => {
    const registry = createZoneRegistry();
    const socket = createMockSocket();

    registry.addSocketToZone(socket, "zone-1");
    registry.addSocketToZone(socket, "zone-2");
    registry.removeSocketFromAllZones(socket);

    expect(registry.getSocketsForZone("zone-1").size).toBe(0);
    expect(registry.getSocketsForZone("zone-2").size).toBe(0);
    expect(registry.getZonesForSocket(socket).size).toBe(0);
  });
});
