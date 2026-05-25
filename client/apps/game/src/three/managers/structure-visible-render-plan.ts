export interface VisibleStructureRenderPlan<TStructure, TStructureType> {
  structuresByType: Map<TStructureType, TStructure[]>;
  structuresByCosmeticId: Map<string, TStructure[]>;
  missingStructureModels: TStructureType[];
  missingCosmeticModels: Array<{ cosmeticId: string; assetPaths: string[] }>;
}

interface BuildVisibleStructureRenderPlanInput<
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

export function buildVisibleStructureRenderPlan<
  TStructure extends {
    structureType: TStructureType;
    cosmeticId?: string;
    cosmeticAssetPaths?: string[];
  },
  TStructureType,
>(
  input: BuildVisibleStructureRenderPlanInput<TStructure, TStructureType>,
): VisibleStructureRenderPlan<TStructure, TStructureType> {
  const structuresByType = new Map<TStructureType, TStructure[]>();
  const structuresByCosmeticId = new Map<string, TStructure[]>();
  const missingStructureModels: TStructureType[] = [];
  const missingCosmeticModels: Array<{ cosmeticId: string; assetPaths: string[] }> = [];
  const requestedStructureModels = new Set<TStructureType>();
  const requestedCosmeticModels = new Set<string>();

  input.visibleStructures.forEach((structure) => {
    if (input.hasCosmeticSkin(structure) && structure.cosmeticId) {
      appendGroupedStructure(structuresByCosmeticId, structure.cosmeticId, structure);

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

    appendGroupedStructure(structuresByType, structure.structureType, structure);

    if (!input.hasStructureModel(structure.structureType) && !requestedStructureModels.has(structure.structureType)) {
      missingStructureModels.push(structure.structureType);
      requestedStructureModels.add(structure.structureType);
    }
  });

  return {
    structuresByType,
    structuresByCosmeticId,
    missingStructureModels,
    missingCosmeticModels,
  };
}

function appendGroupedStructure<TKey, TStructure>(
  groupedStructures: Map<TKey, TStructure[]>,
  key: TKey,
  structure: TStructure,
): void {
  if (!groupedStructures.has(key)) {
    groupedStructures.set(key, []);
  }

  groupedStructures.get(key)!.push(structure);
}
