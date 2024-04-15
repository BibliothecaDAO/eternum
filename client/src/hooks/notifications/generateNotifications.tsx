import { divideByPrecision, getEntityIdFromKeys } from "../../ui/utils/utils";
import {
  type CombatInfo,
  LABOR_CONFIG,
  type Position,
  type Resource,
  ResourcesIds,
  type BankInterface,
  TIME_PER_TICK,
} from "@bibliothecadao/eternum";
import { type Components, Has, HasValue, NotValue, getComponentValue, runQuery } from "@dojoengine/recs";
import {
  CarrierType,
  EventType,
  type NotificationType,
  extractAndCleanKey,
  getLastLoginTimestamp,
} from "../store/useNotificationsStore";
import { calculateNextHarvest } from "../../ui/components/cityview/realm/labor/laborUtils";
import { LevelIndex } from "../helpers/useLevel";
import { getLordsAmountFromBankAuction } from "../../ui/components/worldmap/banks/utils";
import { type realmsPosition } from "./utils";

export interface UpdatedEntity {
  entityKeys: string[];
  modelNames: string[];
}

/**
 * Generate trade notifications from entity updates from graphql subscription
 * @param entityUpdates list of updated entities with keys and componentNames
 * @param Status Component
 * @returns
 */
export const generateTradeNotifications = (entityUpdates: UpdatedEntity[], components: Components) => {
  const notifications = entityUpdates
    .map((update) => {
      if (update.modelNames.includes("Trade")) {
        const status = getComponentValue(components.Status, getEntityIdFromKeys(extractAndCleanKey(update.entityKeys)));
        switch (status?.value) {
          case 0:
            return { eventType: EventType.DirectOffer, keys: update.entityKeys };
          case 1:
            return {
              eventType: EventType.AcceptOffer,
              keys: update.entityKeys,
            };
          case 2:
            return {
              eventType: EventType.CancelOffer,
              keys: update.entityKeys,
            };
          default:
            return null;
        }
      }
      return null;
    })
    .filter(Boolean) as NotificationType[];

  // Remove consecutive duplicates
  return notifications.reduce<NotificationType[]>((acc, curr, idx, array) => {
    if (idx === 0 || JSON.stringify(curr) !== JSON.stringify(array[idx - 1])) {
      acc.push(curr);
    }
    return acc;
  }, []);
};

/**
 * Generate labor notifications from realm resources
 * @param resourcesPerRealm list of objects with realmEntityId and resourceIds of the realm
 * @param nextBlockTimestamp next block timestamp
 * @param Labor Component
 * @returns
 */
export const generateLaborNotifications = (
  resourcesPerRealm: Array<{ realmEntityId: bigint; resourceIds: number[] }>,
  getRealmLevelBonus: (level: number, levelIndex: LevelIndex) => number,
  getHyperstructureLevelBonus: (level: number, levelIndex: LevelIndex) => number,
  nextBlockTimestamp: number,
  realmLevel: number,
  hyperstructureLevel: number,
  components: Components,
) => {
  const notifications: NotificationType[] = [];
  resourcesPerRealm.forEach(({ realmEntityId, resourceIds }) => {
    resourceIds.forEach((resourceId) => {
      const isFood = [ResourcesIds.Wheat, ResourcesIds.Fish].includes(resourceId);
      const labor = getComponentValue(
        components.Labor,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      ) as { balance: number; last_harvest: number; multiplier: number } | undefined;
      const realmLevelBonus = getRealmLevelBonus(realmLevel, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
      const hyperstructureLevelBonus = getHyperstructureLevelBonus(
        hyperstructureLevel,
        isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE,
      );
      const harvest =
        labor && nextBlockTimestamp
          ? calculateNextHarvest(
              labor.balance,
              labor.last_harvest,
              labor.multiplier,
              LABOR_CONFIG.base_labor_units,
              isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
              nextBlockTimestamp,
              realmLevelBonus,
              hyperstructureLevelBonus,
            )
          : 0;

      if (harvest > 0) {
        notifications.push({
          eventType: EventType.Harvest,
          keys: [realmEntityId.toString(), resourceId.toString()],
          data: {
            harvestAmount: divideByPrecision(harvest),
          },
        });
      }
    });
  });

  return notifications;
};

/**
 * Generate claimable orders notifications from realm positions by checking if any order has arrived on that position
 * @param realmPositions
 * @param FungibleEntities
 * @param Position
 * @param ArrivalTime
 * @param Trade
 * @param nextBlockTimestamp
 * @returns
 */
export const generateEmptyChestNotifications = (
  realmPositions: realmsPosition,
  components: Components,
  nextBlockTimestamp: number,
  getResourcesFromInventory: (entityId: bigint) => {
    resources: Resource[];
    indices: number[];
  },
) => {
  const notifications: NotificationType[] = [];
  for (const { realmId, position: realmPosition } of realmPositions) {
    const entitiesAtPositionWithInventory = runQuery([
      HasValue(components.Inventory, {
        items_count: 1n,
      }),
      HasValue(components.Position, {
        x: realmPosition?.x,
        y: realmPosition?.y,
      }),
    ]);

    const ids = Array.from(runQuery([HasValue(components.Realm, { realm_id: realmId })]));
    const realmEntityId = ids.length > 0 ? getComponentValue(components.Realm, ids[0])!.entity_id : undefined;

    for (const id of entitiesAtPositionWithInventory) {
      const arrivalTime = getComponentValue(components.ArrivalTime, id) as { arrives_at: number } | undefined;
      const caravanMembers = getComponentValue(components.CaravanMembers, id);

      // get key
      const entityId = getComponentValue(components.Position, id)!.entity_id;
      const { resources, indices } = getResourcesFromInventory(entityId);

      const carrierType = caravanMembers ? CarrierType.Caravan : CarrierType.Raiders;

      if (arrivalTime?.arrives_at && arrivalTime.arrives_at <= nextBlockTimestamp) {
        notifications.push({
          eventType: EventType.EmptyChest,
          keys: [entityId.toString()],
          data: {
            destinationRealmId: realmId,
            carrierType,
            realmEntityId,
            entityId: BigInt(entityId),
            resources,
            indices,
          },
        });
      }
    }
  }

  return notifications;
};

export const generateArrivedAtHyperstructureNotifications = (
  owner: bigint,
  nextBlockTimestamp: number,
  components: Components,
  hyperstructure: { position: Position; hyperstructureId: bigint },
  getResourcesFromInventory: (entityId: bigint) => {
    resources: Resource[];
    indices: number[];
  },
): NotificationType[] => {
  const notifications: NotificationType[] = [];
  const entityIds = Array.from(
    runQuery([
      Has(components.ArrivalTime),
      Has(components.CaravanMembers),
      HasValue(components.Owner, { address: owner }),
    ]),
  );

  for (const id of entityIds) {
    const arrivalTime = getComponentValue(components.ArrivalTime, id) as { arrives_at: number } | undefined;
    const entityOwner = getComponentValue(components.EntityOwner, id) as
      | { entity_id: bigint; entity_owner_id: bigint }
      | undefined;
    const position = getComponentValue(components.Position, id) as { x: number; y: number } | undefined;
    const homePosition = entityOwner
      ? (getComponentValue(components.Position, getEntityIdFromKeys([entityOwner.entity_owner_id])) as
          | { x: number; y: number }
          | undefined)
      : undefined;

    let hyperstructureId: bigint | undefined;
    if (hyperstructure.position.x === position?.x && hyperstructure.position.y === position?.y) {
      hyperstructureId = hyperstructure.hyperstructureId;
    }

    // check that arrival is bigger than current block timestamp
    // and also that notfication close is smaller than arrival (not seen yet by user)
    const timestamps = getLastLoginTimestamp();
    const hasArrivedAndNotSeen =
      arrivalTime &&
      arrivalTime.arrives_at > timestamps.lastLoginBlockTimestamp &&
      arrivalTime.arrives_at < nextBlockTimestamp;
    if (hyperstructureId && hasArrivedAndNotSeen && homePosition && entityOwner) {
      const { resources, indices } = getResourcesFromInventory(entityOwner.entity_id);
      notifications.push({
        eventType: EventType.ArrivedAtHyperstructure,
        keys: [entityOwner.entity_id.toString()],
        data: {
          hyperstructureId,
          caravanId: entityOwner.entity_id,
          realmEntityId: entityOwner.entity_owner_id,
          resources,
          indices,
          homePosition: { x: homePosition.x, y: homePosition.y },
        },
      });
    }
  }

  return notifications;
};

export const generateEnemyRaidersHaveArrivedNotifications = (
  address: bigint,
  nextBlockTimestamp: number,
  realmPositions: realmsPosition,
  components: Components,
  getCombatInfo: (raiderIds: bigint[]) => CombatInfo[],
) => {
  const notifications: NotificationType[] = [];
  for (const { position } of realmPositions) {
    const entityIds = Array.from(
      runQuery([
        Has(components.ArrivalTime),
        Has(components.Attack),
        HasValue(components.Position, position),
        NotValue(components.Owner, { address }),
      ]),
    );

    for (const id of entityIds) {
      const entityOwner = getComponentValue(components.EntityOwner, id) as
        | { entity_id: bigint; entity_owner_id: bigint }
        | undefined;

      const raidersList = entityOwner ? getCombatInfo([entityOwner.entity_id]) : undefined;
      const raiders = raidersList && raidersList.length === 1 ? raidersList[0] : undefined;

      // check that arrival is bigger than current block timestamp
      // and also that notfication close is smaller than arrival (not seen yet by user)
      const timestamps = getLastLoginTimestamp();
      const hasArrivedAndNotSeen =
        raiders?.arrivalTime &&
        raiders.arrivalTime > timestamps.lastLoginBlockTimestamp &&
        raiders.arrivalTime < nextBlockTimestamp;

      if (hasArrivedAndNotSeen) {
        notifications.push({
          eventType: EventType.EnemyRaidersHaveArrived,
          keys: [raiders.entityId.toString()],
          data: {
            raiders,
          },
        });
      }
    }
  }

  return notifications;
};

export const generateYourRaidersHaveArrivedNotifications = (
  nextBlockTimestamp: number,
  realmPositions: realmsPosition,
  components: Components,
  getCombatInfo: (raiderIds: bigint[]) => CombatInfo[],
) => {
  const notifications: NotificationType[] = [];
  for (const { position, realmEntityId } of realmPositions) {
    const entityIds = Array.from(
      runQuery([
        Has(components.ArrivalTime),
        Has(components.Attack),
        NotValue(components.Position, position),
        HasValue(components.EntityOwner, { entity_owner_id: realmEntityId }),
      ]),
    );

    for (const id of entityIds) {
      const tickMove = getComponentValue(components.TickMove, id) as
        | { entity_id: bigint; tick: number; count: number }
        | undefined;
      const arrivalTime = getComponentValue(components.ArrivalTime, id) as
        | { entity_id: bigint; arrives_at: number }
        | undefined;
      const raidersList = arrivalTime ? getCombatInfo([arrivalTime.entity_id]) : undefined;
      const raiders = raidersList && raidersList.length === 1 ? raidersList[0] : undefined;

      // check that arrival is bigger than current block timestamp
      // and also that notfication close is smaller than arrival (not seen yet by user)
      const timestamps = getLastLoginTimestamp();

      const currentTick = nextBlockTimestamp ? Math.floor(nextBlockTimestamp / TIME_PER_TICK) : 0;
      const isActiveTravel = tickMove !== undefined ? tickMove.tick >= currentTick : false;

      const hasArrivedAndNotSeen =
        !isActiveTravel &&
        raiders?.arrivalTime &&
        raiders.arrivalTime > timestamps.lastLoginBlockTimestamp &&
        raiders.arrivalTime < nextBlockTimestamp;

      if (hasArrivedAndNotSeen) {
        notifications.push({
          eventType: EventType.YourRaidersHaveArrived,
          keys: [raiders.entityId.toString()],
          data: {
            raiders,
          },
        });
      }
    }
  }

  return notifications;
};
