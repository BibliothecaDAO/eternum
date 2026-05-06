import { describe, expect, it } from "vitest";

import {
  buildTransferRouteOverlayRoutes,
  mergeRetainedTransferRouteOverlayRoutes,
  parseTransferRouteResourceIds,
} from "./transfer-route-overlay";

const resolveEntityHex = (entityId: number) => {
  const positions = new Map([
    [11, { col: 1, row: 2 }],
    [22, { col: 5, row: 8 }],
    [33, { col: -3, row: 4 }],
    [44, { col: 9, row: -1 }],
  ]);
  return positions.get(entityId) ?? null;
};

describe("transfer route overlay builders", () => {
  it("parses transfer resources from story JSON and object payloads", () => {
    expect(parseTransferRouteResourceIds('[{"resourceId":1,"amount":10},{"resource":2,"amount":4}]')).toEqual([1, 2]);
    expect(parseTransferRouteResourceIds([{ resourceId: 3 }, { resource: 4 }, { resourceId: Number.NaN }])).toEqual([
      3, 4,
    ]);
    expect(parseTransferRouteResourceIds({ resourceId: 5, amount: 10 })).toEqual([5]);
  });

  it("builds active live transfer routes and filters mint, expired, and unresolved routes", () => {
    const routes = buildTransferRouteOverlayRoutes({
      currentTimeMs: 115_000,
      liveEvents: [
        {
          event_id: "live-active",
          story: "ResourceTransferStory",
          timestamp: "0x64",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 30,
          resource_transfer_is_mint: false,
        },
        {
          event_id: "minted",
          story: "ResourceTransferStory",
          timestamp: "0x64",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 30,
          resource_transfer_is_mint: true,
        },
        {
          event_id: "expired",
          story: "ResourceTransferStory",
          timestamp: "0x32",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 10,
          resource_transfer_is_mint: false,
        },
        {
          event_id: "unresolved",
          story: "ResourceTransferStory",
          timestamp: "0x64",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 999,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 30,
          resource_transfer_is_mint: false,
        },
      ],
      automationEntries: [],
      resolveEntityHex,
    });

    expect(routes).toEqual([
      {
        id: "live:live-active",
        kind: "live",
        sourceEntityId: 11,
        destinationEntityId: 22,
        sourceHex: { col: 1, row: 2 },
        destinationHex: { col: 5, row: 8 },
        resourceIds: [1],
        startedAtMs: 100_000,
        endsAtMs: 130_000,
        progress: 0.5,
      },
    ]);
  });

  it("builds planned automation routes after live routes and applies the render cap", () => {
    const routes = buildTransferRouteOverlayRoutes({
      currentTimeMs: 115_000,
      maxRoutes: 2,
      liveEvents: [
        {
          event_id: "live-active",
          story: "ResourceTransferStory",
          timestamp: "0x64",
          resource_transfer_from_entity_id: 11,
          resource_transfer_to_entity_id: 22,
          resource_transfer_resources: '[{"resourceId":1,"amount":10}]',
          resource_transfer_travel_time: 30,
          resource_transfer_is_mint: false,
        },
      ],
      automationEntries: [
        {
          id: "automation-a",
          active: true,
          sourceEntityId: "33",
          destinationEntityId: "44",
          resourceIds: [5],
          resourceConfigs: [{ resourceId: 6, amount: 10 }],
          intervalMinutes: 5,
        },
        {
          id: "automation-b",
          active: true,
          sourceEntityId: "11",
          destinationEntityId: "22",
          resourceIds: [7],
          intervalMinutes: 5,
        },
        {
          id: "automation-paused",
          active: false,
          sourceEntityId: "11",
          destinationEntityId: "22",
          resourceIds: [8],
          intervalMinutes: 5,
        },
      ],
      resolveEntityHex,
    });

    expect(routes.map((route) => route.id)).toEqual(["live:live-active", "planned:automation-a"]);
    expect(routes[1]).toMatchObject({
      kind: "planned",
      sourceEntityId: 33,
      destinationEntityId: 44,
      sourceHex: { col: -3, row: 4 },
      destinationHex: { col: 9, row: -1 },
      resourceIds: [6],
    });
  });

  it("retains still-active live routes after they fall out of the fetched event window", () => {
    const nextRoutes = buildTransferRouteOverlayRoutes({
      currentTimeMs: 120_000,
      liveEvents: [],
      automationEntries: [
        {
          id: "automation-a",
          active: true,
          sourceEntityId: "33",
          destinationEntityId: "44",
          resourceIds: [5],
          intervalMinutes: 5,
        },
      ],
      resolveEntityHex,
    });

    const routes = mergeRetainedTransferRouteOverlayRoutes({
      currentTimeMs: 120_000,
      nextRoutes,
      previousRoutes: [
        {
          id: "live:still-active",
          kind: "live",
          sourceEntityId: 11,
          destinationEntityId: 22,
          sourceHex: { col: 1, row: 2 },
          destinationHex: { col: 5, row: 8 },
          resourceIds: [1],
          startedAtMs: 100_000,
          endsAtMs: 140_000,
          progress: 0.25,
        },
      ],
    });

    expect(routes.map((route) => route.id)).toEqual(["live:still-active", "planned:automation-a"]);
    expect(routes[0]).toMatchObject({
      progress: 0.5,
      startedAtMs: 100_000,
      endsAtMs: 140_000,
    });
  });
});
