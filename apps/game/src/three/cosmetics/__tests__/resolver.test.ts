import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../debug-controller", () => ({
  cosmeticDebugController: {
    resolveOverride: () => undefined,
  },
}));

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  StructureType: {
    1: "Realm",
    Realm: 1,
  },
}));

vi.mock("@/three/constants/scene-constants", () => ({
  getStructureModelPaths: () => ({
    1: ["structures/realm.glb"],
  }),
}));

vi.mock("../asset-cache", () => ({
  ensureCosmeticAsset: () => undefined,
}));

import { resolveArmyCosmetic, resolveStructureCosmetic } from "../resolver";
import { clearRegistry, formatArmyCosmeticTarget, registerCosmetic, seedDefaultCosmetics } from "../registry";
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
      attributes: [],
      owner: 0n,
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Knight1,
    });

    expect(result.skin.cosmeticId).toContain("army:Knight:T1");
    expect(result.skin.modelType).toBe(ModelType.Knight1);
    expect(result.skin.isFallback).toBe(true);
    expect(result.attachments).toEqual([]);
  });

  it("falls back to default structure cosmetic", () => {
    const result = resolveStructureCosmetic({
      attributes: [],
      owner: 0n,
      structureType: StructureType.Realm,
      defaultModelKey: "Realm",
    });

    expect(result.skin.cosmeticId).toContain("structure:Realm".toLowerCase());
    expect(result.skin.modelType).toBeUndefined();
    expect(result.skin.isFallback).toBe(true);
  });

  it("rejects incompatible selected skins and falls back", () => {
    playerCosmeticsStore.setSnapshot({
      owner: "0x1",
      version: 1,
      ownership: {
        owner: "0x1",
        version: 1,
        ownedAttrs: [],
        eligibleCosmeticIds: [],
      },
      selection: {
        armies: {
          [formatArmyCosmeticTarget(TroopType.Crossbowman, TroopTier.T1)]: {
            skin: "structure:realm:castle-s1-lvl2",
          },
        },
      },
    });

    const result = resolveArmyCosmetic({
      attributes: [],
      owner: "0x1",
      troopType: TroopType.Crossbowman,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Crossbowman1,
    });

    expect(result.skin.cosmeticId).toContain("army:Crossbowman:T1");
    expect(result.skin.isFallback).toBe(true);
  });

  it("rejects selected cosmetics that are not ownership-eligible", () => {
    playerCosmeticsStore.setSnapshot({
      owner: "0x1",
      version: 1,
      ownership: {
        owner: "0x1",
        version: 1,
        ownedAttrs: [],
        eligibleCosmeticIds: [],
      },
      selection: {
        armies: {
          [formatArmyCosmeticTarget(TroopType.Knight, TroopTier.T3)]: {
            skin: "army:Knight:T3:legacy",
          },
        },
      },
    });

    const result = resolveArmyCosmetic({
      attributes: [],
      owner: "0x1",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });

    expect(result.skin.cosmeticId).toBe("army:Knight:T3:base");
    expect(result.skin.isFallback).toBe(true);
  });

  it("merges per-army attachments when compatible", () => {
    registerCosmetic({
      id: "attachment:test:crossbow-banner",
      category: "attachment",
      appliesTo: [formatArmyCosmeticTarget(TroopType.Crossbowman, TroopTier.T1)],
      assetPaths: [],
      attachments: [
        {
          id: "crossbow-banner",
          slot: "back",
        },
      ],
      attachmentSlot: "back",
    });

    playerCosmeticsStore.setSnapshot({
      owner: "0x1",
      version: 1,
      ownership: {
        owner: "0x1",
        version: 1,
        ownedAttrs: [],
        eligibleCosmeticIds: ["attachment:weapon:bow-common", "attachment:test:crossbow-banner"],
      },
      selection: {
        armies: {
          [formatArmyCosmeticTarget(TroopType.Crossbowman, TroopTier.T1)]: {
            attachments: ["attachment:weapon:bow-common", "attachment:test:crossbow-banner"],
          },
        },
        globalAttachments: [],
      },
    });

    const result = resolveArmyCosmetic({
      attributes: [0x205010901n],
      owner: "0x1",
      troopType: TroopType.Crossbowman,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Crossbowman1,
    });

    const attachmentIds = result.attachments.map((attachment) => attachment.id).toSorted();
    expect(attachmentIds).toEqual(["bow-common", "crossbow-banner"]);
    expect(result.attachments.every((item) => !!item.slot)).toBe(true);
  });

  it("lets target-local attachments replace global attachments in the same slot", () => {
    playerCosmeticsStore.setSnapshot({
      owner: "0x1",
      version: 1,
      ownership: {
        owner: "0x1",
        version: 1,
        ownedAttrs: [],
        eligibleCosmeticIds: [
          "attachment:army:aura-legacy",
          "attachment:structure:aura-winter-spike",
          "attachment:structure:aura-legacy",
        ],
      },
      selection: {
        structures: {
          "structure:Realm": {
            attachments: ["attachment:structure:aura-winter-spike"],
          },
        },
        globalAttachments: ["attachment:structure:aura-legacy"],
      },
    });

    const result = resolveStructureCosmetic({
      attributes: [0x2030601n, 0x2040401n],
      owner: "0x1",
      structureType: StructureType.Realm,
      defaultModelKey: "Realm",
    });

    expect(result.attachments.filter((attachment) => attachment.slot === "aura")).toEqual([
      expect.objectContaining({ id: "winter-spike-aura" }),
    ]);
  });
  it("uses admitted attributes without a local inventory snapshot", () => {
    const result = resolveArmyCosmetic({
      attributes: [0x107050201n],
      owner: "0x123",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });
    expect(result.skin.cosmeticId).toBe("army:Knight:T3:legacy");
    expect(result.skin.isFallback).toBe(false);
  });

  it("does not authorize protected attachments from local inventory", () => {
    playerCosmeticsStore.setPendingBlitzLoadout("world", "0x123", {
      tokenIds: ["0xabc"],
      selectedBySlot: { aura: { tokenId: "0xabc", cosmeticIds: ["attachment:army:aura-legacy"] } },
    });
    playerCosmeticsStore.markAppliedBlitzLoadout("world", "0x123");
    const result = resolveArmyCosmetic({
      attributes: [],
      owner: "0x123",
      troopType: TroopType.Knight,
      tier: TroopTier.T3,
      defaultModelType: ModelType.Knight3,
    });
    expect(result.attachments).toEqual([]);
  });
});
