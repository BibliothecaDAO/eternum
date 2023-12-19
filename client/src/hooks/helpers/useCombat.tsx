import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { divideByPrecision, getEntityIdFromKeys } from "../../utils/utils";
import { useHyperstructure } from "./useHyperstructure";
import { CombatInfo } from "@bibliothecadao/eternum";

export function useCombat() {
  const {
    setup: {
      components: {
        Position,
        EntityOwner,
        Health,
        Quantity,
        Attack,
        Defence,
        Movable,
        Capacity,
        ArrivalTime,
        TownWatch,
        Realm,
      },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { getHyperstructureIdByRealmEntityId } = useHyperstructure();

  const getRealmWatchTowerId = (realmEntityId: bigint): bigint | undefined => {
    // find realm watchtower
    const townWatch = getComponentValue(TownWatch, getEntityIdFromKeys([realmEntityId]));
    return townWatch?.town_watch_id;
  };

  // todo: need to find better ways to differentiate
  const useRealmRaiders = (realmEntityId: bigint) => {
    const entityIds = useEntityQuery([
      Has(Attack),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      NotValue(Health, { value: 0n }),
      NotValue(Movable, { sec_per_km: 0 }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const getDefenceOnRealm = (realmEntityId: bigint): CombatInfo | undefined => {
    const watchTower = getComponentValue(TownWatch, getEntityIdFromKeys([realmEntityId]));
    if (watchTower) {
      const watchTowerInfo = getEntitiesCombatInfo([watchTower.town_watch_id]);
      if (watchTowerInfo.length === 1) {
        return watchTowerInfo[0];
      }
    }
  };

  const getDefenceOnPosition = (position: Position): CombatInfo | undefined => {
    const realmEntityIds = Array.from(runQuery([HasValue(Position, position), Has(Realm)]));
    const watchTower = realmEntityIds.length === 1 ? getComponentValue(TownWatch, realmEntityIds[0]) : undefined;
    if (watchTower) {
      const watchTowerInfo = getEntitiesCombatInfo([watchTower.town_watch_id]);
      if (watchTowerInfo.length === 1 && watchTowerInfo[0].health > 0) {
        return watchTowerInfo[0];
      }
    }
  };

  const useEnemyRaidersOnPosition = (position: Position) => {
    const entityIds = useEntityQuery([
      Has(Attack),
      NotValue(Health, { value: 0n }),
      HasValue(Position, position),
      NotValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const useRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    const entityIds = useEntityQuery([
      Has(Attack),
      HasValue(Position, position),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const getRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    const entityIds = Array.from(
      runQuery([
        Has(Attack),
        NotValue(Health, { value: 0n }),
        HasValue(Position, position),
        NotValue(Movable, { sec_per_km: 0 }),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      ]),
    );

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const getEntitiesCombatInfo = (entityIds: bigint[]): CombatInfo[] => {
    return entityIds.map((entityId) => {
      let entityIndex = getEntityIdFromKeys([entityId]);
      const health = getComponentValue(Health, entityIndex);
      const quantity = getComponentValue(Quantity, entityIndex);
      const attack = getComponentValue(Attack, entityIndex);
      const defence = getComponentValue(Defence, entityIndex);
      const movable = getComponentValue(Movable, entityIndex);
      const capacity = getComponentValue(Capacity, entityIndex);
      const arrivalTime = getComponentValue(ArrivalTime, entityIndex);
      const position = getComponentValue(Position, entityIndex);
      const entityOwner = getComponentValue(EntityOwner, entityIndex);
      const hyperstructureId = entityOwner
        ? getHyperstructureIdByRealmEntityId(entityOwner.entity_owner_id)
        : undefined;
      const locationRealmEntityIds = position ? Array.from(runQuery([Has(Realm)])) : [];
      const locationRealmEntityId =
        locationRealmEntityIds.length === 1
          ? getComponentValue(Realm, locationRealmEntityIds[0])!.entity_id
          : undefined;
      const originRealm = entityOwner
        ? getComponentValue(Realm, getEntityIdFromKeys([entityOwner.entity_owner_id]))
        : undefined;
      const homePosition = entityOwner
        ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))
        : undefined;

      return {
        entityId,
        health: Number(health?.value) || 0,
        quantity: Number(quantity?.value) || 0,
        attack: Number(attack?.value) || 0,
        defence: Number(defence?.value) || 0,
        sec_per_km: movable?.sec_per_km || 0,
        blocked: movable?.blocked,
        capacity: divideByPrecision(Number(capacity?.weight_gram) || 0),
        arrivalTime: arrivalTime?.arrives_at,
        position,
        entityOwnerId: entityOwner?.entity_owner_id,
        homePosition,
        locationRealmEntityId,
        originRealmId: originRealm?.realm_id,
        hyperstructureId,
      };
    });
  };

  return {
    getRealmWatchTowerId,
    getDefenceOnRealm,
    getDefenceOnPosition,
    useRealmRaiders,
    useRealmRaidersOnPosition,
    getRealmRaidersOnPosition,
    useEnemyRaidersOnPosition,
    getEntitiesCombatInfo,
  };
}
