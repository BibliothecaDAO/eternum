import { ClientComponents, EntityType, ID, StructureType } from "@bibliothecadao/types";
import { Entity, getComponentValue, getComponentValueStrict, HasValue, runQuery } from "@dojoengine/recs";
import { configManager } from "../managers";
import { DEFAULT_COORD_ALT } from "./tile";
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

      // back and forth
      const distance =
        calculateDistance(
          { alt: DEFAULT_COORD_ALT, x: Number(bankStructure.base.coord_x), y: Number(bankStructure.base.coord_y) },
          { alt: DEFAULT_COORD_ALT, x: Number(playerStructure.base.coord_x), y: Number(playerStructure.base.coord_y) },
        ) * 2;

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
