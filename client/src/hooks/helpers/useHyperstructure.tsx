import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position, UIPosition } from "../../types";
import hyperstructureData from "../../data/hyperstructures.json";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";

export interface HyperStructureInterface {
  hyperstructureId: number;
  orderId: number;
  progress: number;
  hyperstructureResources: {
    resourceId: number;
    currentAmount: number;
    completeAmount: number;
  }[];
  initialzationResources: {
    resourceId: number;
    amount: number;
  }[];
  initialized: boolean;
  completed: boolean;
  position: Position;
  uiPosition: UIPosition;
}

export const useHyperstructure = () => {
  const {
    setup: {
      components: { HyperStructure, Resource, Position },
    },
  } = useDojo();

  const getHyperstructure = (orderId: number, uiPosition: UIPosition): HyperStructureInterface | undefined => {
    const position = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const hypestructureId = runQuery([HasValue(HyperStructure, { coord_x: position.x, coord_y: position.y })]);

    if (hypestructureId.size > 0) {
      let hyperstructureId = Array.from(hypestructureId)[0];
      let hyperstructure = getComponentValue(HyperStructure, hyperstructureId);

      if (hyperstructure) {
        let hyperstructureResources: { resourceId: number; currentAmount: number; completeAmount: number }[] = [];
        hyperstructureData[orderId - 1].resources.completion.forEach((resource) => {
          let hyperstructureResource = getComponentValue(
            Resource,
            getEntityIdFromKeys([BigInt(hyperstructureId), BigInt(resource.resourceType)]),
          );
          hyperstructureResources.push({
            resourceId: resource.resourceType,
            currentAmount: Math.min(hyperstructureResource?.balance ?? 0, resource.amount),
            completeAmount: resource.amount,
          });
        });

        // calculate hypestructure progress
        let totCurrentAmount = 0;
        let totCompleteAmount = 0;
        hyperstructureResources.forEach((resource) => {
          totCurrentAmount += Math.min(resource.currentAmount, resource.completeAmount);
          totCompleteAmount += resource.completeAmount;
        });
        let progress = (totCurrentAmount / totCompleteAmount) * 100;

        return {
          hyperstructureId,
          orderId,
          progress,
          hyperstructureResources,
          initialzationResources: hyperstructureData[orderId - 1].resources.initialization.map((resource) => {
            return {
              resourceId: resource.resourceType, // Fixed: changed semicolon to comma
              amount: resource.amount,
            };
          }),
          initialized: hyperstructure.initialized_at > 0,
          completed: hyperstructure.completed_at > 0,
          position,
          uiPosition,
        };
      }
    }
  };

  const getHyperstructureIds = (): number[] => {
    return Array.from(runQuery([Has(HyperStructure), Has(Position)]));
  };

  return {
    getHyperstructure,
    getHyperstructureIds,
  };
};
