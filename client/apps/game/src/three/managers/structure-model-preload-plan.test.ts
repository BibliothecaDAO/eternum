import { describe, expect, it } from "vitest";

import { buildStructureModelPreloadPlan } from "./structure-model-preload-plan";

type VisibleStructureStub = {
  structureType: string;
  cosmeticId?: string;
  cosmeticAssetPaths?: string[];
};

describe("buildStructureModelPreloadPlan", () => {
  it("deduplicates only models that are missing from visible structure ownership", () => {
    const plan = buildStructureModelPreloadPlan<VisibleStructureStub, string>({
      visibleStructures: [
        { structureType: "Village" },
        { structureType: "Village" },
        { structureType: "Bank" },
        { structureType: "Village", cosmeticId: "gold", cosmeticAssetPaths: ["gold.glb"] },
        { structureType: "Realm", cosmeticId: "gold", cosmeticAssetPaths: ["gold.glb"] },
        { structureType: "Realm", cosmeticId: "cached", cosmeticAssetPaths: ["cached.glb"] },
      ],
      hasCosmeticSkin: (structure) => Boolean(structure.cosmeticId),
      hasStructureModel: (structureType) => structureType === "Bank",
      hasCosmeticModel: (cosmeticId) => cosmeticId === "cached",
    });

    expect(plan).toEqual({
      missingStructureModels: ["Village"],
      missingCosmeticModels: [{ cosmeticId: "gold", assetPaths: ["gold.glb"] }],
    });
  });

  it("does not request a cosmetic without asset paths", () => {
    const plan = buildStructureModelPreloadPlan<VisibleStructureStub, string>({
      visibleStructures: [{ structureType: "Village", cosmeticId: "empty", cosmeticAssetPaths: [] }],
      hasCosmeticSkin: () => true,
      hasStructureModel: () => false,
      hasCosmeticModel: () => false,
    });

    expect(plan).toEqual({ missingStructureModels: [], missingCosmeticModels: [] });
  });
});
