import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../context/DojoContext";
import { Position } from "@bibliothecadao/eternum";
import { calculateDistance, getEntityIdFromKeys, getUIPositionFromColRow } from "../../utils/utils";
import { HyperStructureInterface } from "@bibliothecadao/eternum";
import hyperstructuresHexPositions from "../../geodata/hex/hyperstructuresHexPositions.json";
import { useCombat } from "./useCombat";
import { resources } from "@bibliothecadao/eternum";
import useRealmStore from "../store/useRealmStore";
import { useResources } from "./useResources";

export const useHyperstructure = () => {
  const {
    setup: {
      components: { HyperStructure, Resource, Position, TownWatch },
    },
  } = useDojo();

  const { getEntityWatchTowerId, getEntitiesCombatInfo } = useCombat();
  const { getResourceCosts } = useResources();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const getHyperstructure = (x: number, y: number): HyperStructureInterface | undefined => {
    const entityIds = runQuery([Has(HyperStructure), Has(TownWatch), HasValue(Position, { x, y })]);

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
        // todo: find true distance between 2 hex
        let distance = realmPosition ? calculateDistance(realmPosition, { x, y }) : 0;

        const uiPosition = getUIPositionFromColRow(x, y);

        return {
          hyperstructureId,
          orderId: hyperstructure.controlling_order,
          name,
          progress,
          hyperstructureResources,
          position: { x, y },
          // uiPosition: { x: uiPosition.x, y: 0.528415243525413, z: uiPosition.y },
          uiPosition: { x: uiPosition.x, y: uiPosition.y, z: 200 },
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
    const entityIds = Array.from(runQuery([Has(HyperStructure), Has(TownWatch), Has(Position)]));
    return entityIds.map((id) => {
      return getComponentValue(HyperStructure, id)!.entity_id;
    });
  };

  const getHyperstructureEntityId = (hyperstructruePosition: Position): bigint | undefined => {
    const entityIds = Array.from(
      runQuery([Has(HyperStructure), Has(TownWatch), HasValue(Position, hyperstructruePosition)]),
    );
    if (entityIds.length === 1) {
      let bank = getComponentValue(HyperStructure, entityIds[0]);
      return bank?.entity_id;
    }
  };

  const getConqueredHyperstructures = (orderId: number): HyperStructureInterface[] => {
    // @note: only 11 hyperstructures now
    return Object.values(hyperstructuresHexPositions)
      .map((values) => {
        const col = values[0].col;
        const row = values[0].row;
        return getHyperstructure(col, row);
      })
      .filter((hyperstructure) => hyperstructure?.completed && hyperstructure.orderId === orderId)
      .filter(Boolean) as HyperStructureInterface[];
  };

  const getHyperstructures = (): HyperStructureInterface[] => {
    return Object.values(hyperstructuresHexPositions)
      .map((values) => {
        const col = values[0].col;
        const row = values[0].row;
        return getHyperstructure(col, row);
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
