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
  completed: boolean;
  position: Position;
  uiPosition: UIPosition;
  level: number;
}

export const useHyperstructure = () => {
  const {
    setup: {
      components: { HyperStructure, Resource, Position, Realm },
    },
  } = useDojo();

  const getHyperstructure = (orderId: number, uiPosition: UIPosition): HyperStructureInterface | undefined => {
    const position = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const hypestructureId = runQuery([Has(HyperStructure), HasValue(Position, position)]);

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
          position,
          uiPosition,
          // todo: calculate completed
          completed: false,
          level: 0,
        };
      }
    }
  };

  const getHyperstructureIds = (): number[] => {
    return Array.from(runQuery([Has(HyperStructure), Has(Position)]));
  };

  const getHyperstructureIdByOrder = (orderId: number): number | undefined => {
    const ids = Array.from(runQuery([HasValue(HyperStructure, { order: orderId }), Has(Position)]));
    return ids.length === 1 ? ids[0] : undefined;
  };

  const getHyperstructureIdByRealmEntityId = (realmEntityId: number): number | undefined => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return realm ? getHyperstructureIdByOrder(realm.order) : undefined;
  };

  return {
    getHyperstructure,
    getHyperstructureIds,
    getHyperstructureIdByRealmEntityId,
    getHyperstructureIdByOrder,
  };
};
