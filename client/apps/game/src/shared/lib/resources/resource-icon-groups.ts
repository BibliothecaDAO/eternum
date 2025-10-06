import { ProductionType } from "@/hooks/store/use-automation-store";
import { ResourcesIds } from "@bibliothecadao/types";

export type ProductionRecipesMap = Record<number, Array<{ resource: ResourcesIds }>>;

export type ResourceIconGroup = ResourcesIds[];

interface ResourceIconGroupParams {
  productionType: ProductionType;
  resourceToUse?: ResourcesIds;
  recipes: ProductionRecipesMap;
}

// Normalizes production recipes into ordered resource groups for consistent icon rendering.
export const getResourceIconGroups = ({
  productionType,
  resourceToUse,
  recipes,
}: ResourceIconGroupParams): ResourceIconGroup[] => {
  if (resourceToUse === undefined) {
    return [];
  }

  switch (productionType) {
    case ProductionType.ResourceToResource: {
      const inputs = recipes[resourceToUse]?.map((recipe) => recipe.resource) ?? [];
      if (inputs.length === 0) {
        return [];
      }
      return [inputs, [resourceToUse]];
    }
    case ProductionType.ResourceToLabor: {
      return [[resourceToUse], [ResourcesIds.Labor]];
    }
    case ProductionType.LaborToResource: {
      return [[ResourcesIds.Labor], [resourceToUse]];
    }
    default:
      return [];
  }
};
