import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { UIPosition } from "@bibliothecadao/eternum";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";
import { useLevel } from "./useLevel";
import { HyperStructureInterface, getHyperstructureResources } from "@bibliothecadao/eternum";

export const useHyperstructure = () => {
  const {
    setup: {
      components: { HyperStructure, Resource, Position, Realm },
    },
  } = useDojo();

  const { getEntityLevel } = useLevel();

  const getHyperstructure = (orderId: number, uiPosition: UIPosition): HyperStructureInterface | undefined => {
    const position = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const hypestructureId = runQuery([Has(HyperStructure), HasValue(Position, position)]);

    if (hypestructureId.size > 0) {
      let hyperstructureId = Array.from(hypestructureId)[0];
      const level = getEntityLevel(hyperstructureId);

      let hyperstructure = getComponentValue(HyperStructure, hyperstructureId);

      if (hyperstructure) {
        let hyperstructureResources: { resourceId: number; currentAmount: number; completeAmount: number }[] = [];
        getHyperstructureResources(level?.level || 0).forEach((resource) => {
          let hyperstructureResource = getComponentValue(
            Resource,
            getEntityIdFromKeys([BigInt(hyperstructureId), BigInt(resource.resourceId)]),
          );
          hyperstructureResources.push({
            resourceId: resource.resourceId,
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
          // completed means max level
          completed: level?.level === 4,
          level: level?.level || 0,
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
