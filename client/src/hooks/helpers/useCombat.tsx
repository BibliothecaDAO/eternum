import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { DESTINATION_TYPE, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { divideByPrecision, getEntityIdFromKeys } from "../../utils/utils";
import { CombatInfo } from "@bibliothecadao/eternum";
import useBlockchainStore from "../store/useBlockchainStore";

export function useCombat() {
  const {
    account: {
      account: { address },
    },
    setup: {
      components: {
        Position,
        EntityOwner,
        HyperStructure,
        Owner,
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
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const getEntityWatchTowerId = (entityId: bigint): bigint | undefined => {
    // find realm watchtower
    const townWatch = getComponentValue(TownWatch, getEntityIdFromKeys([entityId]));
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

  const getStationaryRealmRaiders = (realmEntityId: bigint) => {
    if (!nextBlockTimestamp) return [];
    return getRealmRaidersEntities(realmEntityId).filter((id) => {
      const arrivalTime = getComponentValue(ArrivalTime, id);
      if (!arrivalTime || arrivalTime.arrives_at <= nextBlockTimestamp) {
        return id;
      }
    });
  };

  const getMovingRealmRaiders = (realmEntityId: bigint) => {
    if (!nextBlockTimestamp) return [];
    return getRealmRaidersEntities(realmEntityId).filter((id) => {
      const arrivalTime = getComponentValue(ArrivalTime, id);
      if (arrivalTime && arrivalTime.arrives_at > nextBlockTimestamp) {
        return id;
      }
    });
  };

  const getRealmRaidersEntities = (realmEntityId: bigint) => {
    return Array.from(
      runQuery([
        Has(Attack),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
        NotValue(Health, { value: 0n }),
        NotValue(Movable, { sec_per_km: 0 }),
      ]),
    );
  };

  const getRealmRaidersIds = (realmEntityId: bigint) => {
    return getRealmRaidersEntities(realmEntityId).map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const useOwnerRaiders = (owner: bigint) => {
    const entityIds = useEntityQuery([
      Has(Attack),
      HasValue(Owner, { address: owner }),
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
    const { x, y } = position;
    const realmEntityIds = Array.from(runQuery([HasValue(Position, { x, y }), Has(TownWatch)]));
    const watchTower = realmEntityIds.length === 1 ? getComponentValue(TownWatch, realmEntityIds[0]) : undefined;
    if (watchTower) {
      const watchTowerInfo = getEntitiesCombatInfo([watchTower.town_watch_id]);
      if (watchTowerInfo.length === 1) {
        return watchTowerInfo[0];
      }
    }
  };

  const useEnemyRaidersOnPosition = (owner: bigint, position: Position) => {
    const { x, y } = position;
    const entityIds = useEntityQuery([
      Has(Attack),
      Has(Movable),
      NotValue(Health, { value: 0n }),
      HasValue(Position, { x, y }),
      NotValue(Owner, { address: owner }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const useOwnerRaidersOnPosition = (owner: bigint, position: Position) => {
    const { x, y } = position;
    const entityIds = useEntityQuery([
      Has(Attack),
      Has(Movable),
      HasValue(Position, { x, y }),
      HasValue(Owner, { address: owner }),
      NotValue(Health, { value: 0n }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const useRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    const { x, y } = position;
    const entityIds = useEntityQuery([
      Has(Attack),
      Has(Movable),
      HasValue(Position, { x, y }),
      HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      NotValue(Health, { value: 0n }),
    ]);

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const getRealmRaidersOnPosition = (realmEntityId: bigint, position: Position) => {
    const { x, y } = position;
    const entityIds = Array.from(
      runQuery([
        Has(Attack),
        NotValue(Health, { value: 0n }),
        HasValue(Position, { x, y }),
        NotValue(Movable, { sec_per_km: 0 }),
        HasValue(EntityOwner, { entity_owner_id: realmEntityId }),
      ]),
    );

    return entityIds.map((id) => {
      const attack = getComponentValue(Attack, id);
      return attack!.entity_id;
    });
  };

  const getOwnerRaidersOnPosition = (position: Position) => {
    const { x, y } = position;
    const entityIds = Array.from(
      runQuery([
        Has(Attack),
        NotValue(Health, { value: 0n }),
        HasValue(Position, { x, y }),
        NotValue(Movable, { sec_per_km: 0 }),
        HasValue(Owner, { address: BigInt(address) }),
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
      const owner = getComponentValue(Owner, entityIndex);

      /// @note: determine the type of position the raider is on (home, other realm, hyperstructure, bank)
      let locationEntityId: bigint | undefined;
      let locationType: DESTINATION_TYPE | undefined;
      // if present on realm
      const locationRealmEntityIds = position
        ? Array.from(runQuery([Has(Realm), HasValue(Position, { x: position.x, y: position.y })]))
        : [];
      if (locationRealmEntityIds.length === 1) {
        locationEntityId = getComponentValue(Realm, locationRealmEntityIds[0])?.entity_id;
        locationType = DESTINATION_TYPE.REALM;
      }

      // if present on hyperstructure
      const locationHyperstructureIds = position
        ? Array.from(
            runQuery([Has(HyperStructure), Has(TownWatch), HasValue(Position, { x: position.x, y: position.y })]),
          )
        : [];
      if (locationHyperstructureIds.length === 1) {
        locationEntityId = getComponentValue(HyperStructure, locationHyperstructureIds[0])?.entity_id;
        locationType = DESTINATION_TYPE.HYPERSTRUCTURE;
      }
      if (locationEntityId === realmEntityId) {
        locationType = DESTINATION_TYPE.HOME;
      }

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
        position: position ? { x: position.x, y: position.y } : undefined,
        entityOwnerId: entityOwner?.entity_owner_id,
        owner: owner?.address,
        homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
        locationEntityId,
        locationType,
        originRealmId: originRealm?.realm_id,
        order: originRealm?.order || 0,
      };
    });
  };

  return {
    getEntityWatchTowerId,
    getDefenceOnRealm,
    getDefenceOnPosition,
    getRealmRaidersEntities,
    getRealmRaidersIds,
    getStationaryRealmRaiders,
    getMovingRealmRaiders,
    useRealmRaiders,
    useOwnerRaiders,
    useRealmRaidersOnPosition,
    getRealmRaidersOnPosition,
    getOwnerRaidersOnPosition,
    useEnemyRaidersOnPosition,
    useOwnerRaidersOnPosition,
    getEntitiesCombatInfo,
  };
}
