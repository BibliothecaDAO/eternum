import { beforeEach, describe, expect, it } from "vitest";

import { resolveArmyCosmetic, resolveStructureCosmetic } from "../resolver";
import {
  clearRegistry,
  formatArmyCosmeticTarget,
  registerCosmetic,
  seedDefaultCosmetics,
} from "../registry";
import { playerCosmeticsStore } from "../player-cosmetics-store";
import { ModelType } from "../../types/army";
import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";

describe("cosmetics resolver", () => {
  beforeEach(() => {
    playerCosmeticsStore.clear();
    clearRegistry();
    seedDefaultCosmetics({ force: true });
  });

  it("returns base army cosmetic when no selection present", () => {
    const result = resolveArmyCosmetic({
      owner: 0n,
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Knight1,
    });

    expect(result.cosmeticId).toContain("army:Knight:T1");
    expect(result.modelType).toBe(ModelType.Knight1);
    expect(result.attachments).toEqual([]);
  });

  it("falls back to default structure cosmetic", () => {
    const result = resolveStructureCosmetic({
      owner: 0n,
      structureType: StructureType.Realm,
      defaultModelKey: "Realm",
    });

    expect(result.cosmeticId).toContain("structure:Realm".toLowerCase());
    expect(result.modelType).toBeUndefined();
  });

  it("merges per-army attachments when compatible", () => {
    registerCosmetic({
      id: "attachment:test:knight-banner",
      category: "attachment",
      appliesTo: [formatArmyCosmeticTarget(TroopType.Knight, TroopTier.T1)],
      assetPaths: [],
      attachments: [
        {
          id: "knight-banner",
          slot: "back",
        },
      ],
      attachmentSlot: "back",
    });

    playerCosmeticsStore.setSnapshot({
      owner: "0x1",
      version: 1,
      selection: {
        armies: {
          [formatArmyCosmeticTarget(TroopType.Knight, TroopTier.T1)]: {
            attachments: ["attachment:knight:axe", "attachment:test:knight-banner"],
          },
        },
        globalAttachments: [],
        tokens: [],
      },
    });

    const result = resolveArmyCosmetic({
      owner: "0x1",
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Knight1,
    });

    const attachmentIds = result.attachments.map((attachment) => attachment.id).sort();
    expect(attachmentIds).toEqual(["knight-axe", "knight-banner"]);
    expect(result.attachments.every((item) => !!item.slot)).toBe(true);
  });
});
