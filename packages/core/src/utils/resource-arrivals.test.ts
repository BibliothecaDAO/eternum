import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourcesIds, TroopTier, TroopType, type ResourceArrivalInfo } from "@bibliothecadao/types";
import { configManager } from "../managers/config-manager";
import {
  deliveryLandsAt,
  formatArrivals,
  resolveTroopDescriptorFromResourceId,
  summarizeIncomingTroopArrivals,
} from "./resource-arrivals";

const makeArrival = (overrides: Partial<ResourceArrivalInfo> = {}): ResourceArrivalInfo => ({
  structureEntityId: 101,
  resources: [],
  arrivesAt: 120n,
  day: 0n,
  slot: 1n,
  ...overrides,
});

describe("resource-arrivals troop summaries", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads native arrival slots with bigint resource amounts", () => {
    vi.spyOn(configManager, "getTick").mockReturnValue(30);

    expect(
      formatArrivals([
        {
          game_id: 1,
          entity_id: 144_614,
          day: 206_998n,
          slot: 46,
          resources: [
            { resource_type: 23, amount: 0x1955bafc200n },
            { resource_type: 25, amount: 0x2e90edd000n },
          ],
        },
      ]),
    ).toEqual([
      {
        structureEntityId: 144_614,
        resources: [
          { resourceId: 23, amount: Number(0x1955bafc200n) },
          { resourceId: 25, amount: Number(0x2e90edd000n) },
        ],
        arrivesAt: 206_998n * 30n * 48n + 46n * 30n,
        day: 206_998n,
        slot: 46n,
      },
    ]);
  });

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

describe("when a delivery lands", () => {
  afterEach(() => vi.restoreAllMocks());
  const utc = (hours: number, minutes: number, seconds: number) =>
    Date.UTC(2026, 9, 17, hours, minutes, seconds) / 1000;

  it("lands at the end of the 3-minute delivery tick its road ends in, as QA run 3 saw on chain", () => {
    vi.spyOn(configManager, "getTick").mockReturnValue(180);
    // 45 s on the road from 01:35:53 ends at 01:36:38, in the 01:36-01:39 tick: landed 01:39 (offloaded 01:39:09).
    expect(deliveryLandsAt(utc(1, 35, 53), 45)).toBe(utc(1, 39, 0));
    // 27 s from 00:50:57 ends at 00:51:24: landed 00:54 (offloaded 00:54:05).
    expect(deliveryLandsAt(utc(0, 50, 57), 27)).toBe(utc(0, 54, 0));
  });

  it("agrees with the landing the arrival itself is filed for", () => {
    vi.spyOn(configManager, "getTick").mockReturnValue(180);
    const sentAt = utc(1, 35, 53);
    const tick = Math.floor((sentAt + 45) / 180);
    const [filed] = formatArrivals([
      {
        game_id: 1,
        entity_id: 7,
        day: BigInt(Math.floor(tick / 48)),
        slot: (tick % 48) + 1,
        resources: [{ resource_type: ResourcesIds.Wheat, amount: 1n }],
      },
    ] as never);
    expect(Number(filed.arrivesAt)).toBe(deliveryLandsAt(sentAt, 45));
  });

  it("agrees with arrival_key and has_arrived across exact tick and day boundaries", () => {
    vi.spyOn(configManager, "getTick").mockReturnValue(180);
    for (const sent of [179, 180, 181, 8639, 8640, 8641, 1_792_201_060])
      for (const road of [0, 1, 45, 135, 180, 8640]) {
        const tick = BigInt(sent + road) / 180n;
        const [filed] = formatArrivals([
          {
            game_id: 1,
            entity_id: 1,
            day: tick / 48n,
            slot: Number(tick % 48n) + 1,
            resources: [{ resource_type: ResourcesIds.Wheat, amount: 1n }],
          },
        ] as never);
        const lands = deliveryLandsAt(sent, road);
        expect(BigInt(lands)).toBe(filed.arrivesAt);
        // has_arrived: released at the landing, not a second before.
        expect(BigInt(lands) / 180n - 1n >= tick).toBe(true);
        expect(BigInt(lands - 1) / 180n - 1n >= tick).toBe(false);
      }
  });
});
