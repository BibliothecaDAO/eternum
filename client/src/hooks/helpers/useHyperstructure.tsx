import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { Position, UIPosition } from "@bibliothecadao/eternum";
import { calculateDistance, getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";
import { HyperStructureInterface } from "@bibliothecadao/eternum";
import hyperStructures from "../../data/hyperstructures.json";
import { useCombat } from "./useCombat";
import { resources } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";
import { useResources } from "./useResources";

export const useHyperstructure = () => {
  const {
    setup: {
      components: { HyperStructure, Resource, Position, Realm },
    },
  } = useDojo();

  const { getEntityWatchTowerId, getEntitiesCombatInfo } = useCombat();
  const { getResourceCosts } = useResources();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const getHyperstructure = (uiPosition: UIPosition): HyperStructureInterface | undefined => {
    const position = getContractPositionFromRealPosition({ x: uiPosition.x, y: uiPosition.z });
    const entityIds = runQuery([Has(HyperStructure), HasValue(Position, { x: position.x, y: position.y })]);

    if (entityIds.size > 0) {
      let id = Array.from(entityIds)[0];
      let hyperstructure = getComponentValue(HyperStructure, id);

      if (hyperstructure !== undefined) {
        const hyperstructureId = hyperstructure.entity_id;
        let hyperstructureResources: { resourceId: number; currentAmount: number; completeAmount: number }[] = [];
        getResourceCosts(hyperstructure.completion_cost_id, hyperstructure.completion_resource_count).forEach(
          (resource) => {
            let hyperstructureResource = getComponentValue(
              Resource,
              getEntityIdFromKeys([BigInt(hyperstructureId), BigInt(resource.resourceId)]),
            );
            hyperstructureResources.push({
              resourceId: resource.resourceId,
              currentAmount: Math.min(Number(hyperstructureResource?.balance) || 0, resource.amount),
              completeAmount: resource.amount,
            });
          },
        );

        // calculate hypestructure progress
        let totCurrentAmount = 0;
        let totCompleteAmount = 0;
        hyperstructureResources.forEach((resource) => {
          totCurrentAmount += Math.min(resource.currentAmount, resource.completeAmount);
          totCompleteAmount += resource.completeAmount;
        });
        let progress = (totCurrentAmount / totCompleteAmount) * 100;

        let watchTowerId = getEntityWatchTowerId(hyperstructureId);
        let combatInfo = watchTowerId ? getEntitiesCombatInfo([watchTowerId]) : undefined;

        let defence = 0;
        let attack = 0;
        let health = 0;
        let watchTowerQuantity = 0;

        if (combatInfo?.length === 1) {
          defence = combatInfo[0].defence;
          attack = combatInfo[0].attack;
          health = combatInfo[0].health;
          watchTowerQuantity = combatInfo[0].quantity;
        }

        const name = hyperstructureResources
          .filter((resourceCost) => ![254, 255].includes(resourceCost.resourceId))
          .reduce(
            (acc, resourceCost, i) =>
              acc +
                (i !== 0 ? "-" : "") +
                resources.find((resource) => resourceCost.resourceId === resource.id)?.trait || "-",
            "",
          );

        let realmPosition = realmEntityIds[0]?.realmEntityId
          ? getComponentValue(Position, getEntityIdFromKeys([realmEntityIds[0].realmEntityId]))
          : undefined;
        let distance = realmPosition ? calculateDistance(realmPosition, { x: position.x, y: position.y }) : 0;

        return {
          hyperstructureId,
          orderId: hyperstructure.controlling_order,
          name,
          progress,
          hyperstructureResources,
          position: { x: position.x, y: position.y },
          uiPosition,
          completed: hyperstructure.completed,
          defence,
          attack,
          health,
          watchTowerQuantity,
          distance,
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

  const getHyperstructureEntityId = (hyperstructruePosition: Position): bigint | undefined => {
    const entityIds = Array.from(runQuery([Has(HyperStructure), HasValue(Position, hyperstructruePosition)]));
    if (entityIds.length === 1) {
      let bank = getComponentValue(HyperStructure, entityIds[0]);
      return bank?.entity_id;
    }
  };

  const getConqueredHyperstructures = (orderId: number): HyperStructureInterface[] => {
    // @note: only 11 hyperstructures now
    return hyperStructures
      .slice(0, 11)
      .map((uiPosition) => {
        return getHyperstructure(uiPosition);
      })
      .filter((hyperstructure) => hyperstructure?.completed && hyperstructure.orderId === orderId)
      .filter(Boolean) as HyperStructureInterface[];
  };

  const getHyperstructures = (): HyperStructureInterface[] => {
    return hyperStructures
      .map((uiPosition) => {
        return getHyperstructure(uiPosition);
      })
      .filter(Boolean) as HyperStructureInterface[];
  };

  return {
    getHyperstructure,
    getHyperstructures,
    getHyperstructureIds,
    getHyperstructureEntityId,
    getConqueredHyperstructures,
  };
};
