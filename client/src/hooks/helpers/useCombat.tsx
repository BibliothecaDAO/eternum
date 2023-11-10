import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position } from "../../types";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "../../utils/utils";

export interface CombatInfo {
  entityId?: number | undefined;
  health?: number | undefined;
  quantity?: number | undefined;
  attack?: number | undefined;
  defence?: number | undefined;
  sec_per_km?: number | undefined;
  blocked?: boolean | undefined;
  capacity?: number | undefined;
  arrivalTime?: number | undefined;
  position?: Position | undefined;
  homePosition?: Position | undefined;
  entityOwnerId?: number | undefined;
  locationRealmEntityId?: number | undefined;
  originRealmId?: number | undefined;
}

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

  const useBattalionsOnPosition = (position: Position) => {
    return useEntityQuery([
      Has(Health),
      NotValue(Health, { value: 0 }),
      HasValue(Attack, { value: 10 }),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      HasValue(Position, position),
    ]);
  };

  const getRealmWatchTower = (realmEntityId: number): number | undefined => {
    // find realm watchtower
    const townWatch = getComponentValue(TownWatch, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return townWatch?.town_watch_id;
  };

  // todo: need to find better ways to differentiate
  const useRealmBattalions = (realmEntityId: number) => {
    return useEntityQuery([
      HasValue(Attack, { value: 10 }),
      NotValue(Health, { value: 0 }),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);
  };

  // todo: need to find better ways to differentiate
  const useRealmRaiders = (realmEntityId: number) => {
    return useEntityQuery([
      Has(Attack),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      NotValue(Health, { value: 0 }),
      NotValue(Attack, { value: 10 }),
      NotValue(Movable, { sec_per_km: 0 }),
    ]);
  };

  const getDefenceOnRealm = (realmEntityId: number): CombatInfo | undefined => {
    const watchTower = getComponentValue(TownWatch, getEntityIdFromKeys([BigInt(realmEntityId)]));
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
    return useEntityQuery([
      Has(Attack),
      NotValue(Health, { value: 0 }),
      HasValue(Position, position),
      NotValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);
  };

  const useRealmRaidersOnPosition = (realmEntityId: number, position: Position) => {
    return useEntityQuery([
      Has(Attack),
      HasValue(Position, position),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);
  };

  const getRealmRaidersOnPosition = (realmEntityId: number, position: Position) => {
    return Array.from(
      runQuery([
        Has(Attack),
        NotValue(Health, { value: 0 }),
        HasValue(Position, position),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      ]),
    );
  };

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
      const position = getComponentValue(Position, entityIndex);
      const entityOwner = getComponentValue(EntityOwner, entityIndex);
      const locationRealmEntityIds = Array.from(runQuery([Has(Realm), HasValue(Position, position)]));
      const originRealm = entityOwner
        ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))
        : undefined;
      const homePosition = entityOwner
        ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))
        : undefined;

      return {
        entityId,
        health: health?.value,
        quantity: quantity?.value || 0,
        attack: attack?.value,
        defence: defence?.value,
        sec_per_km: movable?.sec_per_km,
        blocked: movable?.blocked,
        capacity: capacity?.weight_gram,
        arrivalTime: arrivalTime?.arrives_at,
        position,
        entityOwnerId: entityOwner?.entity_owner_id,
        homePosition,
        locationRealmEntityId: locationRealmEntityIds.length === 1 ? locationRealmEntityIds[0] : undefined,
        originRealmId: originRealm?.realm_id,
      };
    });
  };

  return {
    getBattalionsOnPosition: useBattalionsOnPosition,
    useRealmBattalions,
    getRealmWatchTower,
    getDefenceOnRealm,
    getDefenceOnPosition,
    useRealmRaiders,
    useRealmRaidersOnPosition,
    getRealmRaidersOnPosition,
    useEnemyRaidersOnPosition,
    getEntitiesCombatInfo,
  };
}
