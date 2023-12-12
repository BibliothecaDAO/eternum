import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { Component, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import {
  divideByPrecision,
  extractAndCleanKey,
  getEntityIdFromKeys,
  getPosition,
  numberToHex,
} from "../../utils/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { calculateNextHarvest } from "../../components/cityview/realm/labor/laborUtils";
import useRealmStore from "../store/useRealmStore";
import { unpackResources } from "../../utils/packedData";
import { COMBAT_EVENT, Resource, ResourcesIds } from "@bibliothecadao/eternum";
import { UpdatedEntity } from "../../dojo/createEntitySubscription";
import { Position } from "@bibliothecadao/eternum";
import { getRealm } from "../../utils/realms";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";
import { createCombatNotification, parseCombatEvent } from "../../utils/combat";
import { Event, pollForEvents } from "../../services/eventPoller";
import { LevelIndex, useLevel } from "../helpers/useLevel";
import { CarrierType, EventType, NotificationType, useNotificationsStore } from "../store/useNotificationsStore";
import { useResources } from "../helpers/useResources";

type realmsResources = { realmEntityId: number; resourceIds: number[] }[];
type realmsPosition = { realmId: number; position: Position }[];

export const useNotifications = () => {
  const {
    setup: {
      updates: {
        entityUpdates,
        eventUpdates: { createCombatEvents },
      },
      components: { Status, Realm, Labor, ArrivalTime, CaravanMembers, Position, Inventory, ForeignKey },
    },
  } = useDojo();

  const [closedNotifications, setClosedNotifications] = useState<Record<string, boolean>>({});
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityIds, realmEntityId, hyperstructureId } = useRealmStore();
  const realmsResources = useRealmsResource(realmEntityIds);
  const realmPositions = useRealmsPosition(realmEntityIds);

  const { getEntityLevel, getHyperstructureLevelBonus, getRealmLevelBonus } = useLevel();
  const { getResourcesFromInventory } = useResources();

  const { notifications, addUniqueNotifications } = useNotificationsStore();

  // get harvest bonuses
  const [realmLevel, hyperstructureLevel] = useMemo(() => {
    const realmLevel = getEntityLevel(realmEntityId)?.level || 0;
    const hyperstructureLevel = hyperstructureId ? getEntityLevel(hyperstructureId)?.level || 0 : undefined;
    return [realmLevel, hyperstructureLevel];
  }, [realmEntityId]);

  /**
   * Trade notifications
   */
  useEffect(() => {
    const subscription = entityUpdates.subscribe((updates) => {
      const newNotifications = generateTradeNotifications(updates, Status);
      addUniqueNotifications(newNotifications);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Labor notifications
   */
  useEffect(() => {
    const updateNotifications = () => {
      const newNotifications = nextBlockTimestamp
        ? generateLaborNotifications(
            realmsResources,
            getRealmLevelBonus,
            getHyperstructureLevelBonus,
            nextBlockTimestamp,
            realmLevel,
            hyperstructureLevel || 0,
            Labor,
          )
        : [];
      // add only add if not already in there
      addUniqueNotifications(newNotifications);
    };

    // Call it once initially
    updateNotifications();

    // Set up interval to check for labor notifications every 10 seconds
    // because with katana nextBlockTimestamp does not update until a new transaction is done
    const intervalId = setInterval(updateNotifications, 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [nextBlockTimestamp]);

  /**
   * Combat notifications
   */
  const setCombatNotificationsFromEvents = (event: Event) => {
    const newNotification = createCombatNotification(parseCombatEvent(event));
    addUniqueNotifications([newNotification]);
  };

  useEffect(() => {
    // poll for each of the realmEntityIds
    for (const realmEntityId of realmEntityIds) {
      // Keccak for Combat event
      pollForEvents([COMBAT_EVENT, "*", numberToHex(realmEntityId.realmEntityId)], setCombatNotificationsFromEvents, 5);
    }
  }, [realmEntityIds]);

  /**
   * New Combat notifications
   */
  // New combat notitications from createCombatEvents (subscription)
  useEffect(() => {
    const subscribeToCombatEvents = async () => {
      for (const { realmEntityId } of realmEntityIds) {
        const observable = await createCombatEvents(realmEntityId);
        observable.subscribe((event) => {
          if (event) {
            const newNotification = createCombatNotification(parseCombatEvent(event));
            addUniqueNotifications([newNotification]);
          }
        });
      }
    };
    subscribeToCombatEvents();
  }, [realmEntityId]);

  /**
   * Claimable orders notifications
   */

  useEffect(() => {
    const updateNotifications = () => {
      const newNotifications = nextBlockTimestamp
        ? generateEmptyChestNotifications(
            realmPositions,
            Inventory,
            Position,
            ArrivalTime,
            CaravanMembers,
            Realm,
            ForeignKey,
            nextBlockTimestamp,
            getResourcesFromInventory,
          )
        : [];

      // add only add if not already in there
      addUniqueNotifications(newNotifications);
    };

    // Call it once initially
    updateNotifications();

    // Set up interval to check for caravan notifications every 10 seconds
    // because with katana nextBlockTimestamp does not update until a new transaction is done
    const intervalId = setInterval(updateNotifications, 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [nextBlockTimestamp]);

  const handleCloseNotification = (notificationId: string) => {
    setClosedNotifications((prev) => ({ ...prev, [notificationId]: true }));
  };

  return {
    notifications,
    // removeNotification,
    closedNotifications,
    handleCloseNotification,
  };
};

/**
 * Generate trade notifications from entity updates from graphql subscription
 * @param entityUpdates list of updated entities with keys and componentNames
 * @param Status Component
 * @returns
 */
const generateTradeNotifications = (entityUpdates: UpdatedEntity[], Status: Component) => {
  const notifications = entityUpdates
    .map((update) => {
      if (update.model_names.includes("Trade")) {
        const status = getComponentValue(Status, getEntityIdFromKeys(extractAndCleanKey(update.entityKeys)));
        switch (status?.value) {
          case 0:
            return { eventType: EventType.MakeOffer, keys: update.entityKeys };
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
  return notifications.reduce((acc, curr, idx, array) => {
    if (idx === 0 || JSON.stringify(curr) !== JSON.stringify(array[idx - 1])) {
      acc.push(curr);
    }
    return acc;
  }, [] as NotificationType[]);
};

/**
 * Generate labor notifications from realm resources
 * @param resourcesPerRealm list of objects with realmEntityId and resourceIds of the realm
 * @param nextBlockTimestamp next block timestamp
 * @param Labor Component
 * @returns
 */
const generateLaborNotifications = (
  resourcesPerRealm: { realmEntityId: number; resourceIds: number[] }[],
  getRealmLevelBonus: (level: number, levelIndex: LevelIndex) => number,
  getHyperstructureLevelBonus: (level: number, levelIndex: LevelIndex) => number,
  nextBlockTimestamp: number,
  realmLevel: number,
  hyperstructureLevel: number,
  Labor: Component,
) => {
  const notifications: NotificationType[] = [];
  resourcesPerRealm.forEach(({ realmEntityId, resourceIds }) => {
    resourceIds.forEach((resourceId) => {
      const isFood = [ResourcesIds["Wheat"], ResourcesIds["Fish"]].includes(resourceId);
      const labor = getComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)])) as
        | { balance: number; last_harvest: number; multiplier: number }
        | undefined;
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
const generateEmptyChestNotifications = (
  realmPositions: realmsPosition,
  Inventory: Component,
  Position: Component,
  ArrivalTime: Component,
  CaravanMembers: Component,
  Realm: Component,
  ForeignKey: Component,
  nextBlockTimestamp: number,
  getResourcesFromInventory: (entityId: number) => {
    resources: Resource[];
    indices: number[];
  },
) => {
  let notifications: NotificationType[] = [];
  for (const { realmId, position: realmPosition } of realmPositions) {
    const entitiesAtPositionWithInventory = runQuery([
      HasValue(Inventory, {
        items_count: 1,
      }),
      HasValue(Position, {
        x: realmPosition?.x,
        y: realmPosition?.y,
      }),
    ]);

    const realms = runQuery([HasValue(Realm, { realm_id: realmId })]);
    const realmEntityId = Number(realms.values().next().value);

    for (const entityId of entitiesAtPositionWithInventory) {
      const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(entityId)])) as
        | { arrives_at: number }
        | undefined;

      const { resources, indices } = getResourcesFromInventory(entityId);

      const caravanMembers = getComponentValue(CaravanMembers, getEntityIdFromKeys([BigInt(entityId)]));

      let carrierType = caravanMembers ? CarrierType.Caravan : CarrierType.Raiders;

      if (arrivalTime?.arrives_at && arrivalTime.arrives_at <= nextBlockTimestamp) {
        notifications.push({
          eventType: EventType.EmptyChest,
          keys: [entityId.toString()],
          data: {
            destinationRealmId: realmId,
            carrierType,
            realmEntityId,
            entityId,
            resources,
            indices,
          },
        });
      }
    }
  }

  return notifications;
};

/**
 * Get all resources present on each realm
 * @param realms
 * @returns
 */
const useRealmsResource = (
  realms: {
    realmEntityId: number;
    realmId: number;
  }[],
): realmsResources => {
  return useMemo(() => {
    return realms
      .map(({ realmEntityId, realmId }) => {
        const { resourceTypesPacked, resourceTypesCount } = realmId
          ? getRealm(realmId)
          : { resourceTypesPacked: 0, resourceTypesCount: 0 };

        if (realmId) {
          let unpackedResources = unpackResources(BigInt(resourceTypesPacked), resourceTypesCount);
          return {
            realmEntityId,
            resourceIds: [ResourcesIds["Wheat"], ResourcesIds["Fish"]].concat(unpackedResources),
          };
        }
        return null;
      })
      .filter(Boolean) as { realmEntityId: number; resourceIds: number[] }[];
  }, [realms]);
};

/**
 * Gets all positions of each realm
 * @param realms
 * @returns
 */
const useRealmsPosition = (
  realms: {
    realmEntityId: number;
    realmId: number;
  }[],
): realmsPosition => {
  return useMemo(() => {
    return realms.map(({ realmId }) => {
      return { realmId, position: getPosition(realmId) };
    });
  }, [realms]);
};

/**
 *  Generate unique id for each notification based on keys and eventType
 * @param notification
 * @returns
 */
export const generateUniqueId = (notification: NotificationType): string => {
  return `${notification.eventType}_${extractAndCleanKey(notification.keys).join("_")}`;
};
