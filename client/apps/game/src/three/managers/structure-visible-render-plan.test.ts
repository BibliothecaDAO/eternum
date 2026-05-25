import { describe, expect, it } from "vitest";

import { buildVisibleStructureRenderPlan } from "./structure-visible-render-plan";

type VisibleStructureStub = {
  entityId: number;
  structureType: string;
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
};

describe("buildVisibleStructureRenderPlan", () => {
  it("groups visible structures by base type versus cosmetic skin and records only missing preload requests", () => {
    const renderPlan = buildVisibleStructureRenderPlan<VisibleStructureStub, string>({
      visibleStructures: [
        { entityId: 1, structureType: "Village" },
        { entityId: 2, structureType: "Bank" },
        { entityId: 3, structureType: "Village", cosmeticId: "gold", cosmeticAssetPaths: ["gold.glb"] },
        { entityId: 4, structureType: "Village", cosmeticId: "gold", cosmeticAssetPaths: ["gold.glb"] },
        { entityId: 5, structureType: "Realm", cosmeticId: "cached", cosmeticAssetPaths: ["cached.glb"] },
      ],
      hasCosmeticSkin: (structure) => Boolean(structure.cosmeticId),
      hasStructureModel: (structureType) => structureType === "Bank",
      hasCosmeticModel: (cosmeticId) => cosmeticId === "cached",
    });

    expect(renderPlan.structuresByType.get("Village")?.map((structure) => structure.entityId)).toEqual([1]);
    expect(renderPlan.structuresByType.get("Bank")?.map((structure) => structure.entityId)).toEqual([2]);
    expect(renderPlan.structuresByCosmeticId.get("gold")?.map((structure) => structure.entityId)).toEqual([3, 4]);
    expect(renderPlan.structuresByCosmeticId.get("cached")?.map((structure) => structure.entityId)).toEqual([5]);
    expect(renderPlan.missingStructureModels).toEqual(["Village"]);
    expect(renderPlan.missingCosmeticModels).toEqual([{ cosmeticId: "gold", assetPaths: ["gold.glb"] }]);
  });

  it("skips cosmetic preload requests when the cosmetic has no asset paths", () => {
    const renderPlan = buildVisibleStructureRenderPlan<VisibleStructureStub, string>({
      visibleStructures: [{ entityId: 9, structureType: "Village", cosmeticId: "empty", cosmeticAssetPaths: [] }],
      hasCosmeticSkin: (structure) => Boolean(structure.cosmeticId),
      hasStructureModel: () => true,
      hasCosmeticModel: () => false,
    });

    expect(renderPlan.structuresByCosmeticId.get("empty")?.map((structure) => structure.entityId)).toEqual([9]);
    expect(renderPlan.missingCosmeticModels).toEqual([]);
    expect(renderPlan.missingStructureModels).toEqual([]);
  });
});
