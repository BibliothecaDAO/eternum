import { getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { getEntityIdFromKeys } from "../../utils/utils";
import { unpackResources } from "../../utils/packedData";

export interface LaborCostInterface {
  resourceId: number;
  amount: number;
}

export function useLabor() {
  const {
    setup: {
      components: { LaborCostResources, LaborCostAmount },
    },
  } = useDojo();

  const getLaborCost = (resourceId: number): LaborCostInterface[] => {
    const laborCostResources = getComponentValue(LaborCostResources, getEntityIdFromKeys([BigInt(resourceId)]));

    const resourceIds = laborCostResources
      ? unpackResources(BigInt(laborCostResources.resource_types_packed), laborCostResources.resource_types_count)
      : [];

    return resourceIds.map((costResourceId) => {
      const laborCostAmount = getComponentValue(
        LaborCostAmount,
        getEntityIdFromKeys([BigInt(resourceId), BigInt(costResourceId)]),
      );
      let amount = laborCostAmount?.value || 0;
      return { resourceId: costResourceId, amount };
    });
  };

  return { getLaborCost };
}
