import { describe, expect, it, vi } from "vitest";

import { createStructureRecord } from "./structure-record";

describe("createStructureRecord", () => {
  it("builds a structure record with ownership and battle fields", () => {
    const isAddressMine = vi.fn((address: bigint) => address === 123n);

    const record = createStructureRecord({
      entityId: 7 as any,
      structureName: "Camp",
      hexCoords: { col: 1, row: 2 },
      stage: 1,
      initialized: true,
      level: 3,
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      structureType: "Village" as any,
      hasWonder: false,
      attachments: [{ slot: "banner" }] as any,
      isAlly: true,
      isAddressMine,
      guardArmies: [{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }],
      activeProductions: [{ buildingCount: 2, buildingType: 4 as any }],
      incomingTroopArrivals: [{ resourceId: 1, troopTier: 1, count: 10, arrivesAt: 120 }] as any,
      hyperstructureRealmCount: 2,
      attackedFromDegrees: 30,
      attackedTowardDegrees: 120,
      battleCooldownEnd: 500,
      battleTimerLeft: 25,
    });

    expect(isAddressMine).toHaveBeenCalledWith(123n);
    expect(record).toEqual({
      entityId: 7,
      structureName: "Camp",
      hexCoords: { col: 1, row: 2 },
      stage: 1,
      initialized: true,
      level: 3,
      isMine: true,
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      structureType: "Village",
      hasWonder: false,
      attachments: [{ slot: "banner" }],
      isAlly: true,
      guardArmies: [{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }],
      activeProductions: [{ buildingCount: 2, buildingType: 4 }],
      incomingTroopArrivals: [{ resourceId: 1, troopTier: 1, count: 10, arrivesAt: 120 }],
      hyperstructureRealmCount: 2,
      attackedFromDegrees: 30,
      attackedTowardDegrees: 120,
      battleCooldownEnd: 500,
      battleTimerLeft: 25,
    });
  });
});
