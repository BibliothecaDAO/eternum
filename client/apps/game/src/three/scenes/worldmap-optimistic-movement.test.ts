import type { HexPosition } from "@bibliothecadao/types";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { Position } from "@bibliothecadao/eternum";

import type { ArmyData } from "../types/common";
import { buildOptimisticArmyTileUpdate, isStaleOptimisticIndexerUpdate } from "./worldmap-optimistic-movement";

function makeArmy(overrides: Partial<ArmyData> = {}): ArmyData {
  return {
    entityId: 42,
    hexCoords: new Position({ x: 2147483748, y: 2147483748 }),
    isMine: true,
    owningStructureId: 7,
    owner: {
      address: 0xabcdn,
      ownerName: "Pondering",
      guildName: "Democritus",
    },
    color: "#ff8800",
    category: TroopType.Paladin,
    tier: TroopTier.T3,
    isDaydreamsAgent: false,
    troopCount: 123,
    currentStamina: 200,
    maxStamina: 400,
    onChainStamina: { amount: 200n, updatedTick: 9999 },
    battleCooldownEnd: 0,
    ...overrides,
  } as ArmyData;
}

describe("buildOptimisticArmyTileUpdate", () => {
  it("returns null when the army is missing", () => {
    const update = buildOptimisticArmyTileUpdate(undefined, { col: 2147483750, row: 2147483750 });
    expect(update).toBeNull();
  });

  it("copies troop identity and owner fields from the tracked army", () => {
    const army = makeArmy();
    const targetHex: HexPosition = { col: 2147483750, row: 2147483749 };

    const update = buildOptimisticArmyTileUpdate(army, targetHex);

    expect(update).not.toBeNull();
    expect(update!.entityId).toBe(army.entityId);
    expect(update!.troopType).toBe(TroopType.Paladin);
    expect(update!.troopTier).toBe(TroopTier.T3);
    expect(update!.ownerAddress).toBe(0xabcdn);
    expect(update!.ownerName).toBe("Pondering");
    expect(update!.guildName).toBe("Democritus");
    expect(update!.ownerStructureId).toBe(7);
    expect(update!.isDaydreamsAgent).toBe(false);
    expect(update!.troopCount).toBe(123);
    expect(update!.currentStamina).toBe(200);
    expect(update!.maxStamina).toBe(400);
    expect(update!.onChainStamina?.amount).toBe(200n);
  });

  it("uses the requested target hex, not the army's current position", () => {
    const army = makeArmy({
      hexCoords: new Position({ x: 2147483700, y: 2147483700 }),
    });
    const targetHex: HexPosition = { col: 2147483750, row: 2147483745 };

    const update = buildOptimisticArmyTileUpdate(army, targetHex);

    expect(update!.hexCoords).toEqual(targetHex);
  });

  it("never sets the removed flag so downstream handlers treat it as a positional update", () => {
    const army = makeArmy();
    const update = buildOptimisticArmyTileUpdate(army, { col: 1, row: 2 });
    expect(update!.removed).toBeFalsy();
  });

  it("omits the battle attacker/defender history when the army has no battle state", () => {
    const army = makeArmy({ battleCooldownEnd: 0 });
    const update = buildOptimisticArmyTileUpdate(army, { col: 1, row: 2 });
    expect(update!.battleData).toBeUndefined();
  });

  it("handles a null ownerStructureId without throwing", () => {
    const army = makeArmy({ owningStructureId: null });
    const update = buildOptimisticArmyTileUpdate(army, { col: 1, row: 2 });
    expect(update!.ownerStructureId).toBeNull();
  });
});

describe("isStaleOptimisticIndexerUpdate", () => {
  it("returns false when the tracked army is missing so the caller applies the update normally", () => {
    const stale = isStaleOptimisticIndexerUpdate(undefined, {
      hexCoords: { col: 2147483750, row: 2147483750 },
    });
    expect(stale).toBe(false);
  });

  it("returns false when the incoming update matches the army's current position (authoritative convergence)", () => {
    const army = makeArmy({
      hexCoords: new Position({ x: 2147483750, y: 2147483749 }),
    });
    const stale = isStaleOptimisticIndexerUpdate(army, {
      hexCoords: { col: 2147483750, row: 2147483749 },
    });
    expect(stale).toBe(false);
  });

  it("returns true when the incoming update targets a position the client has already advanced past", () => {
    // Scenario: armies map is at C (latest optimistic target); indexer is
    // still delivering the earlier tx's update for B.
    const armyAtC = makeArmy({
      hexCoords: new Position({ x: 2147483752, y: 2147483752 }),
    });
    const staleUpdateForB = { hexCoords: { col: 2147483750, row: 2147483750 } };
    expect(isStaleOptimisticIndexerUpdate(armyAtC, staleUpdateForB)).toBe(true);
  });

  it("compares on normalized coordinates so a mix of contract/normalized inputs still matches", () => {
    // army stored with contract coords (FELT_CENTER-offset), update arriving
    // with same position expressed either way should NOT be flagged stale.
    const army = makeArmy({
      hexCoords: new Position({ x: 2147483748, y: 2147483748 }),
    });
    const sameHex = { hexCoords: { col: 2147483748, row: 2147483748 } };
    expect(isStaleOptimisticIndexerUpdate(army, sameHex)).toBe(false);
  });
});
