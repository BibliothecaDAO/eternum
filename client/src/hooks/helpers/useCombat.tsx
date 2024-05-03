import { Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../context/DojoContext";
import { DESTINATION_TYPE, Position } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { divideByPrecision, getEntityIdFromKeys } from "../../ui/utils/utils";
import { CombatInfo } from "@bibliothecadao/eternum";

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
        Movable,
        Capacity,
        ArrivalTime,
        Realm,
        Army,
        EntityName,
      },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const useOwnerArmies = (owner: bigint) => {
    let entityIds = useEntityQuery([Has(Army)]);

    return entityIds.map((id) => {
      const army = getComponentValue(Army, id);
      return { ...army };
    });
  };

  // const useEnemeyRaiders = (owner: bigint) => {
  //   let entityIds = useEntityQuery([
  //     Has(Attack),
  //     Has(Movable),
  //     NotValue(Health, { value: 0n }),
  //     NotValue(Movable, { sec_per_km: 0 }), // exclude town watch
  //     NotValue(Owner, { address: owner }),
  //   ]);

  //   // find dead enemy entities with items in inventory
  //   const deadEntitiesWithResources = useEntityQuery([
  //     Has(Attack),
  //     Has(Movable),
  //     NotValue(Movable, { sec_per_km: 0 }), // exclude town watch
  //     HasValue(Health, { value: 0n }),
  //     NotValue(Owner, { address: owner }),
  //   ]);

  //   entityIds = entityIds.concat(deadEntitiesWithResources);

  //   return entityIds.map((id) => {
  //     const attack = getComponentValue(Attack, id);
  //     return attack!.entity_id;
  //   });
  // };

  // const useEnemyRaidersOnPosition = (owner: bigint, position: Position) => {
  //   const { x, y } = position;
  //   const entityIds = useEntityQuery([
  //     Has(Attack),
  //     Has(Movable),
  //     NotValue(Health, { value: 0n }),
  //     HasValue(Position, { x, y }),
  //     NotValue(Owner, { address: owner }),
  //   ]);

  //   return entityIds.map((id) => {
  //     const attack = getComponentValue(Attack, id);
  //     return attack!.entity_id;
  //   });
  // };

  // const useOwnerRaidersOnPosition = (owner: bigint, position: Position) => {
  //   const { x, y } = position;
  //   const entityIds = useEntityQuery([
  //     Has(Attack),
  //     Has(Movable),
  //     HasValue(Position, { x, y }),
  //     HasValue(Owner, { address: owner }),
  //     NotValue(Health, { value: 0n }),
  //   ]);

  //   return entityIds.map((id) => {
  //     const attack = getComponentValue(Attack, id);
  //     return attack!.entity_id;
  //   });
  // };

  const getOwnerRaidersOnPosition = (position: Position) => {
    const { x, y } = position;
    const entityIds = Array.from(
      runQuery([
        Has(Army),
        NotValue(Health, { current: 0n }),
        HasValue(Position, { x, y }),
        NotValue(Movable, { sec_per_km: 0 }),
        HasValue(Owner, { address: BigInt(address) }),
      ]),
    );

    return entityIds.map((id) => {
      const attack = getComponentValue(Army, id);
      return attack!.entity_id;
    });
  };

  const getEntitiesCombatInfo = (entityIds: bigint[]): CombatInfo[] => {
    return entityIds.map((entityId) => {
      let entityIndex = getEntityIdFromKeys([entityId]);
      const health = getComponentValue(Health, entityIndex);
      const quantity = getComponentValue(Quantity, entityIndex);
      const movable = getComponentValue(Movable, entityIndex);
      const capacity = getComponentValue(Capacity, entityIndex);
      const arrivalTime = getComponentValue(ArrivalTime, entityIndex);
      const position = getComponentValue(Position, entityIndex);
      const entityOwner = getComponentValue(EntityOwner, entityIndex);
      const owner = getComponentValue(Owner, entityIndex);
      const army = getComponentValue(Army, entityIndex);

      /// @note: determine the type of position the raider is on (home, other realm, hyperstructure, bank)
      let locationEntityId: bigint | undefined;
      let locationType: DESTINATION_TYPE | undefined;

      if (position) {
        const realmQueryResult = runQuery([Has(Realm), HasValue(Position, { x: position.x, y: position.y })]);
        const hyperStructureQueryResult = runQuery([
          Has(HyperStructure),
          HasValue(Position, { x: position.x, y: position.y }),
        ]);

        if (realmQueryResult.size === 1) {
          locationEntityId = getComponentValue(Realm, realmQueryResult.values().next().value)?.entity_id;
          locationType = DESTINATION_TYPE.REALM;
        } else if (hyperStructureQueryResult.size === 1) {
          locationEntityId = getComponentValue(
            HyperStructure,
            hyperStructureQueryResult.values().next().value,
          )?.entity_id;
          locationType = DESTINATION_TYPE.HYPERSTRUCTURE;
        }

        if (locationEntityId === realmEntityId) {
          locationType = DESTINATION_TYPE.HOME;
        }
      }

      const originRealm = entityOwner
        ? getComponentValue(Realm, getEntityIdFromKeys([entityOwner.entity_owner_id]))
        : undefined;
      const homePosition = originRealm
        ? getComponentValue(Position, getEntityIdFromKeys([originRealm.entity_id]))
        : undefined;

      return {
        entityId,
        health: Number(health?.current) || 0,
        quantity: Number(quantity?.value) || 0,
        attack: 0,
        defence: 0,
        sec_per_km: movable?.sec_per_km || 0,
        blocked: movable?.blocked,
        capacity: divideByPrecision(Number(capacity?.weight_gram) * Number(quantity?.value) || 0),
        arrivalTime: arrivalTime?.arrives_at,
        position: position ? { x: position.x, y: position.y } : undefined,
        entityOwnerId: entityOwner?.entity_owner_id,
        owner: owner?.address,
        homePosition: homePosition ? { x: homePosition.x, y: homePosition.y } : undefined,
        locationEntityId,
        locationType,
        originRealmId: originRealm?.realm_id,
        order: originRealm?.order ?? 0,
        troops: {
          knightCount: army?.troops.knight_count || 0,
          paladinCount: army?.troops.paladin_count || 0,
          crossbowmanCount: army?.troops.crossbowman_count || 0,
        },
        battleId: BigInt(army?.battle_id || 0),
        battleSide: army?.battle_side || 0,
      };
    });
  };

  return {
    // getEntityWatchTowerId,
    // getDefenceOnRealm,
    // getDefenceOnPosition: getWatchTowerOnPosition,
    // getRealmRaidersEntities,
    // getRealmRaidersIds,
    // useRealmRaiders,
    // useRealmRaidersOnPosition,
    // getRealmRaidersOnPosition,
    getOwnerRaidersOnPosition,
    // useEnemeyRaiders,
    // useEnemyRaidersOnPosition,
    // useOwnerRaidersOnPosition,
    getEntitiesCombatInfo,
    useOwnerArmies,
  };
}
