import { Entity, getComponentValue, getComponentValueStrict, HasValue, runQuery } from "@dojoengine/recs";
import { configManager } from "../managers";
import { StructureType, ClientComponents, EntityType, ID } from "@bibliothecadao/types";
import { calculateDistance, getEntityIdFromKeys } from "./utils";

export type ClosestBank = {
  bankId: ID;
  distance: number;
  travelTime?: number;
};

export const getClosestBank = (entityId: ID, components: ClientComponents): ClosestBank | undefined => {
  const banks = runQuery([
    HasValue(components.Structure, {
      category: StructureType.Bank,
    }),
  ]);

  const playerStructure = getComponentValueStrict(components.Structure, getEntityIdFromKeys([BigInt(entityId)]));

  const banksArray = Array.from(banks);

  if (banksArray.length === 0) {
    return undefined;
  }

  const secPerKm = configManager.getSpeedConfig(EntityType.DONKEY);

  const closestBank = banksArray.reduce(
    (closest: { bankId: ID; distance: number; travelTime?: number } | null, entity: Entity) => {
      const bankStructure = getComponentValue(components.Structure, entity);
      if (!bankStructure) return closest;

      const distance = calculateDistance(
        { x: Number(bankStructure.base.coord_x), y: Number(bankStructure.base.coord_y) },
        { x: Number(playerStructure.base.coord_x), y: Number(playerStructure.base.coord_y) },
      );

      // Calculate travel time if secPerKm is provided
      const travelTime = secPerKm ? Math.floor((distance * secPerKm) / 60) : undefined;

      if (closest === null) {
        return { bankId: bankStructure.entity_id, distance, travelTime };
      }

      return distance < closest.distance ? { bankId: bankStructure.entity_id, distance, travelTime } : closest;
    },
    null,
  );

  if (!closestBank) return undefined;

  return {
    bankId: closestBank.bankId,
    distance: closestBank.distance,
    travelTime: closestBank.travelTime,
  };
};
