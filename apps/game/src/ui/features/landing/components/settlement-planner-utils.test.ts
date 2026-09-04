import { describe, expect, it } from "vitest";

import { Direction } from "@bibliothecadao/types";

import {
  buildSettlementPlannerData,
  buildSettlementPlannerVillageSlots,
  isSettlementPlannerTargetStillValid,
  resolveSettlementPlannerTarget,
  type SettlementPlannerRealmMarker,
  type SettlementPlannerSnapshot,
} from "./settlement-planner-utils";

const baseSnapshot = (partial?: Partial<SettlementPlannerSnapshot>): SettlementPlannerSnapshot => ({
  realms: [],
  villages: [],
  ...partial,
});

describe("resolveSettlementPlannerTarget", () => {
  it("prioritizes village slots over realm markers, realm slots, and terrain tiles", () => {
    const target = resolveSettlementPlannerTarget({
      x: 0,
      y: 0,
      terrainTiles: [{ id: "terrain", coordX: 1, coordY: 1, biome: 3, pixelX: 0, pixelY: 0 }],
      realmSlots: [
        {
          id: "realm-slot",
          side: 0,
          layer: 1,
          point: 0,
          coordX: 10,
          coordY: 10,
          pixelX: 0,
          pixelY: 0,
          occupied: false,
        },
      ],
      realms: [
        {
          id: "realm",
          entityId: 1,
          realmId: 1,
          ownerAddress: "0x1",
          ownerName: "Owner",
          coordX: 10,
          coordY: 10,
          villagesCount: 0,
          freeDirectionCount: 6,
          optimistic: false,
          pixelX: 0,
          pixelY: 0,
        },
      ],
      villageSlots: [
        {
          id: "village-slot",
          realmEntityId: 1,
          realmId: 1,
          ownerAddress: "0x1",
          ownerName: "Owner",
          coordX: 12,
          coordY: 10,
          direction: Direction.EAST,
          villageEntityId: null,
          occupied: false,
          pending: false,
          pixelX: 0,
          pixelY: 0,
        },
      ],
    });

    expect(target?.type).toBe("village_slot");
  });

  it("returns an occupied target when the nearest village slot is busy", () => {
    const target = resolveSettlementPlannerTarget({
      x: 0,
      y: 0,
      terrainTiles: [],
      realmSlots: [],
      realms: [],
      villageSlots: [
        {
          id: "village-slot",
          realmEntityId: 1,
          realmId: 1,
          ownerAddress: "0x1",
          ownerName: "Owner",
          coordX: 12,
          coordY: 10,
          direction: Direction.EAST,
          villageEntityId: 12,
          occupied: true,
          pending: false,
          pixelX: 0,
          pixelY: 0,
        },
      ],
    });

    expect(target).toEqual(
      expect.objectContaining({
        type: "occupied_target",
        occupiedType: "village_slot",
      }),
    );
  });
});

describe("buildSettlementPlannerVillageSlots", () => {
  it("derives free and busy slots around each realm", () => {
    const snapshot = baseSnapshot({
      realms: [
        {
          entityId: 77,
          realmId: 8,
          ownerAddress: "0x123",
          ownerName: "Ayla",
          coordX: 2147483646,
          coordY: 2147483646,
          villagesCount: 1,
          directionsLeft: [{ NorthEast: [] }, { NorthWest: [] }],
        },
      ],
      villages: [
        {
          entityId: 901,
          coordX: 2147483648,
          coordY: 2147483646,
        },
      ],
    });

    const realms: SettlementPlannerRealmMarker[] = [
      {
        id: "realm:77",
        entityId: 77,
        realmId: 8,
        ownerAddress: "0x123",
        ownerName: "Ayla",
        coordX: 2147483646,
        coordY: 2147483646,
        villagesCount: 1,
        freeDirectionCount: 2,
        optimistic: false,
        pixelX: 0,
        pixelY: 0,
      },
    ];

    const villageSlots = buildSettlementPlannerVillageSlots({
      realms,
      snapshot,
      mapCenterOffset: 0,
    });

    const busyEast = villageSlots.find((slot) => slot.direction === Direction.EAST);
    const freeNorthEast = villageSlots.find((slot) => slot.direction === Direction.NORTH_EAST);
    const busyWest = villageSlots.find((slot) => slot.direction === Direction.WEST);

    expect(villageSlots).toHaveLength(6);
    expect(busyEast).toEqual(expect.objectContaining({ occupied: true, villageEntityId: 901 }));
    expect(freeNorthEast).toEqual(expect.objectContaining({ occupied: false, pending: false }));
    expect(busyWest).toEqual(expect.objectContaining({ occupied: true }));
  });
});

describe("isSettlementPlannerTargetStillValid", () => {
  it("invalidates stale selections after planner data refresh", () => {
    const initialData = buildSettlementPlannerData({
      snapshot: baseSnapshot(),
      terrainTiles: [],
      layerMax: 1,
      layersSkipped: 0,
      baseDistance: 1,
      mapCenterOffset: 0,
    });

    const target = {
      type: "realm_slot" as const,
      slot: initialData.realmSlots[0],
    };

    const refreshedData = {
      ...initialData,
      realmSlots: initialData.realmSlots.map((slot) => ({ ...slot, occupied: true })),
    };

    expect(isSettlementPlannerTargetStillValid(target, initialData)).toBe(true);
    expect(isSettlementPlannerTargetStillValid(target, refreshedData)).toBe(false);
  });
});
