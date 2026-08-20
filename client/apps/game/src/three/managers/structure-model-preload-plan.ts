export interface StructureModelPreloadPlan<TStructureType> {
  missingStructureModels: TStructureType[];
  missingCosmeticModels: Array<{ cosmeticId: string; assetPaths: string[] }>;
}

interface BuildStructureModelPreloadPlanInput<
  TStructure extends {
    structureType: TStructureType;
    cosmeticId?: string;
    cosmeticAssetPaths?: string[];
  },
  TStructureType,
> {
  visibleStructures: TStructure[];
  hasCosmeticSkin: (structure: TStructure) => boolean;
  hasStructureModel: (structureType: TStructureType) => boolean;
  hasCosmeticModel: (cosmeticId: string) => boolean;
}

export function buildStructureModelPreloadPlan<
  TStructure extends {
    structureType: TStructureType;
    cosmeticId?: string;
    cosmeticAssetPaths?: string[];
  },
  TStructureType,
>(input: BuildStructureModelPreloadPlanInput<TStructure, TStructureType>): StructureModelPreloadPlan<TStructureType> {
  const missingStructureModels: TStructureType[] = [];
  const missingCosmeticModels: Array<{ cosmeticId: string; assetPaths: string[] }> = [];
  const requestedStructureModels = new Set<TStructureType>();
  const requestedCosmeticModels = new Set<string>();

  input.visibleStructures.forEach((structure) => {
    if (input.hasCosmeticSkin(structure) && structure.cosmeticId) {
      if (
        !input.hasCosmeticModel(structure.cosmeticId) &&
        !requestedCosmeticModels.has(structure.cosmeticId) &&
        (structure.cosmeticAssetPaths?.length ?? 0) > 0
      ) {
        missingCosmeticModels.push({
          cosmeticId: structure.cosmeticId,
          assetPaths: structure.cosmeticAssetPaths ?? [],
        });
        requestedCosmeticModels.add(structure.cosmeticId);
      }
      return;
    }

    if (!input.hasStructureModel(structure.structureType) && !requestedStructureModels.has(structure.structureType)) {
      missingStructureModels.push(structure.structureType);
      requestedStructureModels.add(structure.structureType);
    }
  });

  return { missingCosmeticModels, missingStructureModels };
}
