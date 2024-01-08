import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { Position, UIPosition } from "@bibliothecadao/eternum";
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

  const getHyperstructure = (uiPosition: UIPosition): HyperStructureInterface | undefined => {
    const { x, y } = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const entityIds = runQuery([Has(HyperStructure), HasValue(Position, { x, y })]);

    if (entityIds.size > 0) {
      let id = Array.from(entityIds)[0];
      let hyperstructureId = getComponentValue(HyperStructure, id)!.entity_id;
      const level = getEntityLevel(hyperstructureId);

      let hyperstructure = getComponentValue(HyperStructure, getEntityIdFromKeys([hyperstructureId]));

      if (hyperstructure) {
        let hyperstructureResources: { resourceId: number; currentAmount: number; completeAmount: number }[] = [];
        getHyperstructureResources(level?.level || 0).forEach((resource) => {
          let hyperstructureResource = getComponentValue(
            Resource,
            getEntityIdFromKeys([hyperstructureId, BigInt(resource.resourceId)]),
          );
          hyperstructureResources.push({
            resourceId: resource.resourceId,
            currentAmount: Math.min(Number(hyperstructureResource?.balance) || 0, resource.amount),
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
          orderId: hyperstructure.order,
          progress,
          hyperstructureResources,
          position: { x, y },
          uiPosition,
          // completed means max level
          completed: level?.level === 4,
          level: level?.level || 0,
        };
      }
    }
  };

  const getHyperstructureIds = (): bigint[] => {
    const entityIds = Array.from(runQuery([Has(HyperStructure), Has(Position)]));
    return entityIds.map((id) => {
      return getComponentValue(HyperStructure, id)!.entity_id;
    });
  };

  const getHyperstructureIdByOrder = (orderId: number): bigint | undefined => {
    const entityIds = Array.from(runQuery([HasValue(HyperStructure, { order: orderId }), Has(Position)]));
    if (entityIds.length === 1) {
      return getComponentValue(HyperStructure, entityIds[0])!.entity_id;
    }
  };

  const getHyperstructureIdByRealmEntityId = (realmEntityId: bigint): bigint | undefined => {
    const realm = getComponentValue(Realm, getEntityIdFromKeys([realmEntityId]));
    return realm ? getHyperstructureIdByOrder(realm.order) : undefined;
  };

  const getHyperstructureEntityId = (hyperstructruePosition: Position): bigint | undefined => {
    const entityIds = Array.from(runQuery([Has(HyperStructure), HasValue(Position, hyperstructruePosition)]));
    if (entityIds.length === 1) {
      let bank = getComponentValue(HyperStructure, entityIds[0]);
      return bank?.entity_id;
    }
  };

  return {
    getHyperstructure,
    getHyperstructureIds,
    getHyperstructureIdByRealmEntityId,
    getHyperstructureIdByOrder,
    getHyperstructureEntityId,
  };
};
