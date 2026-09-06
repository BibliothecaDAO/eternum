export interface StructureModelPreloadPlan<TStructureType> {
  missingStructureModels: Array<{ structureType: TStructureType; modelIndex: number }>;
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
  getStructureModelIndices: (structure: TStructure) => readonly number[];
  hasStructureModel: (structureType: TStructureType, modelIndex: number) => boolean;
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
  const missingStructureModels: StructureModelPreloadPlan<TStructureType>["missingStructureModels"] = [];
  const missingCosmeticModels: Array<{ cosmeticId: string; assetPaths: string[] }> = [];
  const requestedStructureModels = new Map<TStructureType, Set<number>>();
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

    const requestedIndices = requestedStructureModels.get(structure.structureType) ?? new Set<number>();
    for (const modelIndex of input.getStructureModelIndices(structure)) {
      if (input.hasStructureModel(structure.structureType, modelIndex) || requestedIndices.has(modelIndex)) continue;
      missingStructureModels.push({ structureType: structure.structureType, modelIndex });
      requestedIndices.add(modelIndex);
    }
    requestedStructureModels.set(structure.structureType, requestedIndices);
  });

  return { missingCosmeticModels, missingStructureModels };
}
