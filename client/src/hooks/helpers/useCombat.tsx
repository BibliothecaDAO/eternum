import { Has, HasValue, getComponentValue } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position } from "../../types";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";

export interface CombatInfo {
  entityId?: number;
  health?: number;
  quantity?: number;
  attack?: number;
  defence?: number;
  sec_per_km?: number;
  blocked?: boolean;
  capacity?: number;
}

export function useCombat() {
  const {
    setup: {
      components: { Position, EntityOwner, Health, Quantity, Attack, Defence, Movable, Capacity, ArrivalTime },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const getBattalionsOnPosition = (position: Position) => {
    return useEntityQuery([
      Has(Health),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      HasValue(Position, position),
    ]);
  };

  const getRealmBattalions = (realmEntityId: number) => {
    return useEntityQuery([Has(Health), HasValue(EntityOwner, { entity_owner_id: realmEntityId })]);
  };

  const getDefenceOnPosition = (position: Position) => {};

  const getRaidersOnPosition = (position: Position) => {};

  const getEntitiesCombatInfo = (entityIds: number[]): CombatInfo[] => {
    return entityIds.map((entityId) => {
      let entityIndex = getEntityIdFromKeys([BigInt(entityId)]);
      const health = getComponentValue(Health, entityIndex);
      const quantity = getComponentValue(Quantity, entityIndex);
      const attack = getComponentValue(Attack, entityIndex);
      const defence = getComponentValue(Defence, entityIndex);
      const movable = getComponentValue(Movable, entityIndex);
      const capacity = getComponentValue(Capacity, entityIndex);
      const arrivalTime = getComponentValue(ArrivalTime, entityIndex);

      return {
        entityId,
        health: health?.value,
        quantity: quantity?.value || 1,
        attack: attack?.value,
        defence: defence?.value,
        sec_per_km: movable?.sec_per_km,
        blocked: movable?.blocked,
        capacity: capacity.weight_gram,
        arrivalTime: arrivalTime?.arrives_at,
      };
    });
  };

  return {
    getBattalionsOnPosition,
    getRealmBattalions,
    getDefenceOnPosition,
    getRaidersOnPosition,
    getEntitiesCombatInfo,
  };
}
