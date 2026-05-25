import { describe, expect, it, vi } from "vitest";

const { getBattleTimerLeft } = vi.hoisted(() => ({
  getBattleTimerLeft: vi.fn((battleCooldownEnd?: number) => battleCooldownEnd),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft,
}));

import {
  mapPendingStructureGuardArmies,
  queuePendingBuildingLabelUpdate,
  queuePendingStructureLabelUpdate,
} from "./structure-pending-label-updates";

describe("structure pending label updates", () => {
  it("maps guard armies into pending label update records", () => {
    expect(
      mapPendingStructureGuardArmies([{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }] as any),
    ).toEqual([{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }]);
  });

  it("queues a structure pending update with owner, guards, and timer data", () => {
    const pendingLabelUpdates = new Map<number, any>();

    queuePendingStructureLabelUpdate({
      pendingLabelUpdates,
      entityId: 7,
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      guardArmies: [{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }] as any,
      battleCooldownEnd: 120,
      nowMs: 1_000,
    });

    expect(pendingLabelUpdates.get(7)).toEqual({
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      guardArmies: [{ slot: 1, category: "infantry", tier: 2, count: 10, stamina: 50 }],
      timestamp: 1_000,
      updateType: "structure",
      battleCooldownEnd: 120,
      battleTimerLeft: 120,
    });
  });

  it("lets a newer building update merge onto an existing pending record", () => {
    const pendingLabelUpdates = new Map<number, any>([
      [
        7,
        {
          owner: { address: 123n, ownerName: "Alice", guildName: "" },
          timestamp: 1_000,
          updateType: "structure",
        },
      ],
    ]);

    queuePendingBuildingLabelUpdate({
      pendingLabelUpdates,
      entityId: 7,
      activeProductions: [{ buildingCount: 2, buildingType: 4 as any }],
      nowMs: 2_000,
    });

    expect(pendingLabelUpdates.get(7)).toEqual({
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
      timestamp: 2_000,
      updateType: "building",
      activeProductions: [{ buildingCount: 2, buildingType: 4 }],
    });
  });

  it("ignores an older pending write", () => {
    const pendingLabelUpdates = new Map<number, any>([
      [
        7,
        {
          owner: { address: 123n, ownerName: "Alice", guildName: "" },
          timestamp: 2_000,
          updateType: "structure",
        },
      ],
    ]);

    queuePendingBuildingLabelUpdate({
      pendingLabelUpdates,
      entityId: 7,
      activeProductions: [{ buildingCount: 2, buildingType: 4 as any }],
      nowMs: 1_000,
    });

    expect(pendingLabelUpdates.get(7)).toEqual({
      owner: { address: 123n, ownerName: "Alice", guildName: "" },
      timestamp: 2_000,
      updateType: "structure",
    });
  });
});
