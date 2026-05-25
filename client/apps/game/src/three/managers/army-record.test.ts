import { describe, expect, it } from "vitest";

import { createArmyRecord } from "./army-record";

describe("createArmyRecord", () => {
  it("builds an army record with cosmetic and battle fields", () => {
    const record = createArmyRecord({
      entityId: 7 as any,
      hexCoords: { kind: "position" } as any,
      isMine: true,
      owningStructureId: 11 as any,
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      cosmeticId: "army:Knight:T1:custom",
      cosmeticAssetPaths: ["custom.glb"],
      usesFallbackCosmeticSkin: false,
      attachments: [{ id: "banner", slot: "banner" }] as any,
      color: "#ff0000",
      category: "Knight" as any,
      tier: "T1" as any,
      isDaydreamsAgent: false,
      troopCount: 12,
      currentStamina: 80,
      maxStamina: 100,
      onChainStamina: { amount: 50n, updatedTick: 6 },
      attackedFromDegrees: 30,
      attackedTowardDegrees: 120,
      battleCooldownEnd: 500,
      battleTimerLeft: 25,
    });

    expect(record).toEqual({
      entityId: 7,
      hexCoords: { kind: "position" },
      isMine: true,
      owningStructureId: 11,
      owner: { address: 123n, ownerName: "Alice", guildName: "Guild" },
      cosmeticId: "army:Knight:T1:custom",
      cosmeticAssetPaths: ["custom.glb"],
      usesFallbackCosmeticSkin: false,
      attachments: [{ id: "banner", slot: "banner" }],
      color: "#ff0000",
      category: "Knight",
      tier: "T1",
      isDaydreamsAgent: false,
      troopCount: 12,
      currentStamina: 80,
      maxStamina: 100,
      onChainStamina: { amount: 50n, updatedTick: 6 },
      attackedFromDegrees: 30,
      attackedTowardDegrees: 120,
      battleCooldownEnd: 500,
      battleTimerLeft: 25,
    });
  });
});
