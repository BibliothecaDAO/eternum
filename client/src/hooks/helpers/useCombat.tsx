import { Has, HasValue, NotValue, getComponentValue, runQuery, Entity } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { Position } from "../../types";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export interface CombatInfo {
  entityId?: Entity | undefined;
  health?: bigint | undefined;
  quantity?: bigint | undefined;
  attack?: number | undefined;
  defence?: number | undefined;
  sec_per_km?: number | undefined;
  blocked?: boolean | undefined;
  capacity?: number | undefined;
  arrivalTime?: number | undefined;
  position?: Position | undefined;
  homePosition?: Position | undefined;
  entityOwnerId?: number | undefined;
  locationRealmEntityId?: Entity | undefined;
  originRealmId?: bigint | undefined;
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

  const getRealmWatchTowerId = (realmEntityId: bigint): bigint | undefined => {
    // find realm watchtower
    const townWatch = getComponentValue(TownWatch, getEntityIdFromKeys([BigInt(realmEntityId)]));
    return townWatch?.town_watch_id;
  };

  // todo: need to find better ways to differentiate
  const useRealmRaiders = (realmEntityId: bigint) => {
    return useEntityQuery([
      Has(Attack),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      NotValue(Health, { value: BigInt(0) }),
      NotValue(Movable, { sec_per_km: 0 }),
    ]);
  };

  const getDefenceOnRealm = (realmEntityId: Entity): CombatInfo | undefined => {
    const watchTower = getComponentValue(TownWatch, getEntityIdFromKeys([BigInt(realmEntityId)]));
    if (watchTower) {
      const watchTowerInfo = getEntitiesCombatInfo([watchTower.town_watch_id.toString() as Entity]);
      if (watchTowerInfo.length === 1) {
        return watchTowerInfo[0];
      }
    }
  };

  const getDefenceOnPosition = (position: Position): CombatInfo | undefined => {
    const realmEntityIds = Array.from(runQuery([HasValue(Position, position), Has(Realm)]));
    const watchTower = realmEntityIds.length === 1 ? getComponentValue(TownWatch, realmEntityIds[0]) : undefined;
    if (watchTower) {
      const watchTowerInfo = getEntitiesCombatInfo([watchTower.town_watch_id.toString() as Entity]);
      if (watchTowerInfo.length === 1 && watchTowerInfo[0].health > 0) {
        return watchTowerInfo[0];
      }
    }
  };

  const useEnemyRaidersOnPosition = (position: Position) => {
    return useEntityQuery([
      Has(Attack),
      NotValue(Health, { value: BigInt(0) }),
      HasValue(Position, position),
      NotValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);
  };

  const useRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    return useEntityQuery([
      Has(Attack),
      HasValue(Position, position),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
    ]);
  };

  const getRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    return Array.from(
      runQuery([
        Has(Attack),
        NotValue(Health, { value: BigInt(0) }),
        HasValue(Position, position),
        NotValue(Movable, { sec_per_km: 0 }),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      ]),
    );
  };

  const getEntitiesCombatInfo = (entityIds: Entity[]): CombatInfo[] => {
    return entityIds.map((entityId) => {
      let entityIndex = getEntityIdFromKeys([BigInt(entityId.toString())]);
      const health = getComponentValue(Health, entityIndex)?.value;
      const quantity = getComponentValue(Quantity, entityIndex)?.value || 0;
      const attack = getComponentValue(Attack, entityIndex)?.value;
      const defence = getComponentValue(Defence, entityIndex)?.value;
      const movable = getComponentValue(Movable, entityIndex);
      const capacity = getComponentValue(Capacity, entityIndex)?.weight_gram;
      const arrivalTime = getComponentValue(ArrivalTime, entityIndex);
      const position = getComponentValue(Position, entityIndex);
      const entityOwner = getComponentValue(EntityOwner, entityIndex)?.entity_owner_id;
      const locationRealmEntityIds = Array.from(runQuery([Has(Realm), HasValue(Position, position)]));
      const originRealm = entityOwner
        ? getComponentValue(Realm, getEntityIdFromKeys([BigInt(entityOwner)]))?.realm_id
        : undefined;
      const homePosition = entityOwner
        ? getComponentValue(Position, getEntityIdFromKeys([BigInt(entityOwner)]))
        : undefined;

      return {
        entityId: entityId.toString() as Entity,
        health,
        quantity,
        attack,
        defence,
        sec_per_km: movable?.sec_per_km,
        blocked: movable?.blocked,
        capacity,
        arrivalTime: arrivalTime?.arrives_at,
        position,
        entityOwnerId: entityOwner,
        homePosition,
        locationRealmEntityId: locationRealmEntityIds.length === 1 ? locationRealmEntityIds[0] : undefined,
        originRealmId: originRealm,
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
