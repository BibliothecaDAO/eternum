import { describe, expect, it } from "vitest";
import { ResourcesIds, TroopTier, TroopType, type ResourceArrivalInfo } from "@bibliothecadao/types";
import { resolveTroopDescriptorFromResourceId, summarizeIncomingTroopArrivals } from "./resource-arrivals";

const makeArrival = (overrides: Partial<ResourceArrivalInfo> = {}): ResourceArrivalInfo => ({
  structureEntityId: 101,
  resources: [],
  arrivesAt: 120n,
  day: 0,
  slot: 1n,
  ...overrides,
});

describe("resource-arrivals troop summaries", () => {
  it("resolves troop descriptors from military resource ids", () => {
    expect(resolveTroopDescriptorFromResourceId(ResourcesIds.KnightT2)).toEqual({
      troopType: TroopType.Knight,
      troopTier: TroopTier.T2,
    });
    expect(resolveTroopDescriptorFromResourceId(ResourcesIds.Wood)).toBeNull();
  });

  it("keeps only pending military arrivals and flattens each troop resource into a separate stack", () => {
    const arrivals = [
      makeArrival({
        structureEntityId: 101,
        arrivesAt: 150n,
        resources: [
          { resourceId: ResourcesIds.Knight, amount: 1_500_000_000 },
          { resourceId: ResourcesIds.Wood, amount: 999_000_000 },
          { resourceId: ResourcesIds.PaladinT2, amount: 2_000_000_000 },
        ],
      }),
      makeArrival({
        structureEntityId: 202,
        arrivesAt: 80n,
        resources: [{ resourceId: ResourcesIds.Crossbowman, amount: 1_000_000_000 }],
      }),
    ];

    expect(summarizeIncomingTroopArrivals(arrivals, 100)).toEqual({
      "101": [
        {
          structureEntityId: 101,
          resourceId: ResourcesIds.Knight,
          troopType: TroopType.Knight,
          troopTier: TroopTier.T1,
          count: 1,
          arrivesAt: 150n,
          day: 0,
          slot: 1n,
        },
        {
          structureEntityId: 101,
          resourceId: ResourcesIds.PaladinT2,
          troopType: TroopType.Paladin,
          troopTier: TroopTier.T2,
          count: 2,
          arrivesAt: 150n,
          day: 0,
          slot: 1n,
        },
      ],
    });
  });

  it("sorts each structure by ETA, then troop tier, then troop type", () => {
    const arrivals = [
      makeArrival({
        arrivesAt: 300n,
        resources: [{ resourceId: ResourcesIds.Paladin, amount: 1_000_000_000 }],
      }),
      makeArrival({
        arrivesAt: 200n,
        resources: [{ resourceId: ResourcesIds.CrossbowmanT2, amount: 1_000_000_000 }],
      }),
      makeArrival({
        arrivesAt: 200n,
        resources: [{ resourceId: ResourcesIds.Knight, amount: 1_000_000_000 }],
      }),
      makeArrival({
        arrivesAt: 200n,
        resources: [{ resourceId: ResourcesIds.Paladin, amount: 0 }],
      }),
    ];

    expect(summarizeIncomingTroopArrivals(arrivals, 100)["101"]).toMatchObject([
      { troopType: TroopType.Knight, troopTier: TroopTier.T1, arrivesAt: 200n },
      { troopType: TroopType.Crossbowman, troopTier: TroopTier.T2, arrivesAt: 200n },
      { troopType: TroopType.Paladin, troopTier: TroopTier.T1, arrivesAt: 300n },
    ]);
  });
});
