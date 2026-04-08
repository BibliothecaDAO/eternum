import { describe, expect, it, vi } from "vitest";

const { getBattleTimerLeft } = vi.hoisted(() => ({
  getBattleTimerLeft: vi.fn((battleCooldownEnd?: number) => battleCooldownEnd),
}));

vi.mock("../utils/combat-directions", () => ({
  getBattleTimerLeft,
}));

import {
  queuePendingExplorerTroopsUpdate,
  resolvePendingArmySpawnState,
  takeFreshPendingExplorerTroopsUpdate,
  type PendingExplorerTroopsUpdate,
} from "./army-explorer-delta";

describe("army explorer delta", () => {
  it("returns and removes a fresh pending explorer update", () => {
    const pendingExplorerTroopsUpdate = new Map<number, PendingExplorerTroopsUpdate>([
      [
        7,
        {
          troopCount: 10,
          onChainStamina: { amount: 30n, updatedTick: 4 },
          ownerAddress: 123n,
          ownerName: "Alice",
          timestamp: 1_000,
          updateTick: 4,
        },
      ],
    ]);

    const result = takeFreshPendingExplorerTroopsUpdate(pendingExplorerTroopsUpdate, 7, 20_000);

    expect(result?.troopCount).toBe(10);
    expect(pendingExplorerTroopsUpdate.has(7)).toBe(false);
  });

  it("drops stale pending explorer updates", () => {
    const pendingExplorerTroopsUpdate = new Map<number, PendingExplorerTroopsUpdate>([
      [
        7,
        {
          troopCount: 10,
          onChainStamina: { amount: 30n, updatedTick: 4 },
          ownerAddress: 123n,
          ownerName: "Alice",
          timestamp: 1_000,
          updateTick: 4,
        },
      ],
    ]);

    const result = takeFreshPendingExplorerTroopsUpdate(pendingExplorerTroopsUpdate, 7, 40_000);

    expect(result).toBeUndefined();
    expect(pendingExplorerTroopsUpdate.has(7)).toBe(false);
  });

  it("stores only the newest pending explorer update by tick", () => {
    const pendingExplorerTroopsUpdate = new Map<number, PendingExplorerTroopsUpdate>();

    queuePendingExplorerTroopsUpdate({
      pendingExplorerTroopsUpdate,
      entityId: 7,
      troopCount: 10,
      onChainStamina: { amount: 30n, updatedTick: 4 },
      ownerAddress: 123n,
      ownerName: "Alice",
      ownerStructureId: 22 as any,
      battleCooldownEnd: 90,
      updateTick: 4,
      nowMs: 1_000,
    });
    queuePendingExplorerTroopsUpdate({
      pendingExplorerTroopsUpdate,
      entityId: 7,
      troopCount: 12,
      onChainStamina: { amount: 40n, updatedTick: 6 },
      ownerAddress: 456n,
      ownerName: "Bob",
      ownerStructureId: 44 as any,
      battleCooldownEnd: 120,
      updateTick: 6,
      nowMs: 2_000,
    });

    expect(pendingExplorerTroopsUpdate.get(7)).toEqual({
      troopCount: 12,
      onChainStamina: { amount: 40n, updatedTick: 6 },
      ownerAddress: 456n,
      ownerName: "Bob",
      timestamp: 2_000,
      updateTick: 6,
      ownerStructureId: 44,
      attackedFromDegrees: undefined,
      attackedTowardDegrees: undefined,
      battleCooldownEnd: 120,
      battleTimerLeft: 120,
    });
  });

  it("ignores older pending explorer updates", () => {
    const pendingExplorerTroopsUpdate = new Map<number, PendingExplorerTroopsUpdate>([
      [
        7,
        {
          troopCount: 12,
          onChainStamina: { amount: 40n, updatedTick: 6 },
          ownerAddress: 456n,
          ownerName: "Bob",
          timestamp: 2_000,
          updateTick: 6,
        },
      ],
    ]);

    queuePendingExplorerTroopsUpdate({
      pendingExplorerTroopsUpdate,
      entityId: 7,
      troopCount: 10,
      onChainStamina: { amount: 30n, updatedTick: 4 },
      ownerAddress: 123n,
      ownerName: "Alice",
      updateTick: 4,
      nowMs: 3_000,
    });

    expect(pendingExplorerTroopsUpdate.get(7)?.ownerName).toBe("Bob");
  });

  it("merges pending explorer deltas into army spawn state", () => {
    const result = resolvePendingArmySpawnState({
      troopCount: 1,
      currentStamina: 5,
      onChainStamina: { amount: 10n, updatedTick: 1 },
      owner: { address: 111n, ownerName: "Alice", guildName: "Guild" },
      owningStructureId: 2 as any,
      category: "Knight" as any,
      tier: "T2" as any,
      battleCooldownEnd: 90,
      battleTimerLeft: 12,
      attackedFromDegrees: 30,
      attackTowardDegrees: 120,
      pendingUpdate: {
        troopCount: 12,
        onChainStamina: { amount: 40n, updatedTick: 6 },
        ownerAddress: 111n,
        ownerName: "",
        timestamp: 2_000,
        updateTick: 6,
        ownerStructureId: 44 as any,
        attackedFromDegrees: 60,
        attackedTowardDegrees: 180,
        battleCooldownEnd: 120,
        battleTimerLeft: 120,
      },
      resolveCurrentStamina: ({ troopCount }) => troopCount * 10,
    });

    expect(result).toEqual({
      troopCount: 12,
      currentStamina: 120,
      onChainStamina: { amount: 40n, updatedTick: 6 },
      owner: { address: 111n, ownerName: "Alice", guildName: "Guild" },
      owningStructureId: 44,
      attackedFromDegrees: 60,
      attackTowardDegrees: 180,
      battleCooldownEnd: 120,
      battleTimerLeft: 120,
    });
  });
});
