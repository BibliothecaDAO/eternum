import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBattleTimerLeft, getCombatAngles } = vi.hoisted(() => ({
  getBattleTimerLeft: vi.fn((battleCooldownEnd?: number) =>
    battleCooldownEnd !== undefined ? battleCooldownEnd - 100 : undefined,
  ),
  getCombatAngles: vi.fn(() => ({
    attackedFromDegrees: 30,
    attackTowardDegrees: 120,
  })),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft,
  getCombatAngles,
}));

import {
  resolveStructureTileUpdateRecord,
  takeFreshPendingLabelUpdate,
  type PendingLabelUpdate,
} from "./structure-update-reconciliation";

describe("resolveStructureTileUpdateRecord", () => {
  beforeEach(() => {
    getBattleTimerLeft.mockClear();
    getCombatAngles.mockClear();
  });

  it("preserves an existing owner when the incoming tile update is temporarily unowned", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 0n, ownerName: "Tile Owner", guildName: "" },
        guardArmies: [],
        activeProductions: [],
        battleData: {},
      } as any,
      existingStructure: {
        owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
        activeProductions: [],
      },
    });

    expect(result.owner).toEqual({
      address: 123n,
      ownerName: "Alice",
      guildName: "Guild",
    });
  });

  it("keeps live building production data over stale tile-cache production data", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        guardArmies: [],
        activeProductions: [{ buildingCount: 1, buildingType: 1 }],
        battleData: {},
      } as any,
      existingStructure: {
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        activeProductions: [{ buildingCount: 2, buildingType: 2 }],
      },
    });

    expect(result.activeProductions).toEqual([{ buildingCount: 2, buildingType: 2 }]);
  });

  it("applies pending structure updates without letting placeholder owners clobber tile owners", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        guardArmies: [],
        activeProductions: [],
        battleData: {},
      } as any,
      pendingUpdate: {
        owner: { address: 0n, ownerName: "The Vanguard", guildName: "Watch" },
        activeProductions: [{ buildingCount: 2, buildingType: 7 }],
        timestamp: Date.now(),
        updateType: "building",
      },
    });

    expect(result.owner).toEqual({
      address: 123n,
      ownerName: "The Vanguard",
      guildName: "Watch",
    });
    expect(result.activeProductions).toEqual([{ buildingCount: 2, buildingType: 7 }]);
  });

  it("lets a pending structure owner explicitly move a structure to unowned", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        guardArmies: [],
        activeProductions: [],
        battleData: {},
      } as any,
      pendingUpdate: {
        owner: { address: 0n, ownerName: "The Vanguard", guildName: "" },
        timestamp: Date.now(),
        updateType: "structure",
      },
    });

    expect(result.owner).toEqual({
      address: 0n,
      ownerName: "The Vanguard",
      guildName: "",
    });
  });

  it("overrides the resolved owner with live component data when available", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
        guardArmies: [],
        activeProductions: [],
        battleData: {},
      } as any,
      resolveLiveOwner: () => ({ address: 456n, ownerName: "Bob" }),
    });

    expect(result.owner).toEqual({
      address: 456n,
      ownerName: "Bob",
      guildName: "Guild",
    });
  });

  it("recomputes battle state after applying a pending cooldown override", () => {
    const result = resolveStructureTileUpdateRecord({
      update: {
        hexCoords: { col: 10, row: 15 },
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        guardArmies: [],
        activeProductions: [],
        battleData: {
          battleCooldownEnd: 140,
        },
      } as any,
      pendingUpdate: {
        owner: { address: 123n, ownerName: "Alice", guildName: "" },
        timestamp: Date.now(),
        updateType: "structure",
        attackedFromDegrees: 60,
        attackedTowardDegrees: 180,
        battleCooldownEnd: 220,
      },
    });

    expect(result.battle).toEqual({
      attackedFromDegrees: 60,
      attackTowardDegrees: 180,
      battleCooldownEnd: 220,
      battleTimerLeft: 120,
    });
  });
});

describe("takeFreshPendingLabelUpdate", () => {
  it("returns and removes a fresh pending update", () => {
    const pendingLabelUpdates = new Map<number, PendingLabelUpdate>([
      [
        7,
        {
          owner: { address: 123n, ownerName: "Alice", guildName: "" },
          timestamp: 1_000,
          updateType: "structure",
        },
      ],
    ]);

    const result = takeFreshPendingLabelUpdate(pendingLabelUpdates, 7, 20_000);

    expect(result?.owner.address).toBe(123n);
    expect(pendingLabelUpdates.has(7)).toBe(false);
  });

  it("drops stale pending updates", () => {
    const pendingLabelUpdates = new Map<number, PendingLabelUpdate>([
      [
        7,
        {
          owner: { address: 123n, ownerName: "Alice", guildName: "" },
          timestamp: 1_000,
          updateType: "structure",
        },
      ],
    ]);

    const result = takeFreshPendingLabelUpdate(pendingLabelUpdates, 7, 40_000);

    expect(result).toBeUndefined();
    expect(pendingLabelUpdates.has(7)).toBe(false);
  });
});
