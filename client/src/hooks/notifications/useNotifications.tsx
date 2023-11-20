import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
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
import { COMBAT_EVENT, ResourcesIds } from "@bibliothecadao/eternum";
import { UpdatedEntity } from "../../dojo/createEntitySubscription";
import { Position } from "../../types";
import { getRealm } from "../../utils/realms";
import { LABOR_CONFIG } from "@bibliothecadao/eternum";
import { useRealm } from "../helpers/useRealm";
import { CombatResultInterface } from "../store/useCombatHistoryStore";
import { createCombatNotification, parseCombatEvent } from "../../utils/combat";
import { Event, pollForEvents } from "../../services/eventPoller";

export enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  Harvest,
  OrderClaimable,
  StolenResource,
  Attacked,
}

type realmsResources = { realmEntityId: number; resourceIds: number[] }[];
type realmsPosition = { realmId: number; position: Position }[];

export type NotificationType = {
  eventType: EventType;
  keys: string[] | string | undefined;
  data?: HarvestData | EmptyChestData | CombatResultInterface;
};

type HarvestData = {
  harvestAmount: number;
};

type EmptyChestData = {
  destinationRealmId: number;
  caravanId: number;
  realmEntityId: number;
  resourcesChestId: number;
};

export const useNotifications = () => {
  const {
    setup: {
      updates: {
        entityUpdates,
        eventUpdates: { createCombatEvents },
      },
      components: { Status, Realm, Labor, ArrivalTime, Position, CaravanMembers, Inventory, ForeignKey },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityIds, realmEntityId } = useRealmStore();
  const realmsResources = useRealmsResource(realmEntityIds);
  const realmPositions = useRealmsPosition(realmEntityIds);

  const { getRealmLevel } = useRealm();
  const level = getRealmLevel(realmEntityId)?.level || 0;

  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  /**
   * Trade notifications
   */
  useEffect(() => {
    const subscription = entityUpdates.subscribe((updates) => {
      const notifications = generateTradeNotifications(updates, Status);
      addUniqueNotifications(notifications, setNotifications);
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
      const notifications = nextBlockTimestamp
        ? generateLaborNotifications(realmsResources, nextBlockTimestamp, level, Labor)
        : [];
      // add only add if not already in there
      addUniqueNotifications(notifications, setNotifications);
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
    const notification = createCombatNotification(parseCombatEvent(event));
    // setNotifications((prev) => [notification, ...prev]);
    addUniqueNotifications([notification], setNotifications);
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
            const notification = createCombatNotification(parseCombatEvent(event));
            addUniqueNotifications([notification], setNotifications);
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
      const notifications = nextBlockTimestamp
        ? generateEmptyChestNotifications(
            realmPositions,
            CaravanMembers,
            Inventory,
            Position,
            ArrivalTime,
            Realm,
            ForeignKey,
            nextBlockTimestamp,
          )
        : [];

      // add only add if not already in there
      addUniqueNotifications(notifications, setNotifications);
    };

    // Call it once initially
    updateNotifications();

    // Set up interval to check for caravan notifications every 10 seconds
    // because with katana nextBlockTimestamp does not update until a new transaction is done
    const intervalId = setInterval(updateNotifications, 10000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [nextBlockTimestamp]);

  return {
    notifications,
  };
};

/**
 * Add unique notifications to the list of notifications
 * @param notifications list of notifications
 * @param setNotifications setter for notifications
 */
const addUniqueNotifications = (
  notifications: NotificationType[],
  setNotifications: React.Dispatch<React.SetStateAction<NotificationType[]>>,
) => {
  setNotifications((prev) => {
    // Extract keys from previous notifications
    const prevIds = new Set(prev.map((n) => generateUniqueId(n)));

    // Filter out notifications that are already in the prev list
    const newNotifications = notifications.filter((notification) => !prevIds.has(generateUniqueId(notification)));

    // If there are no new notifications, return the previous state to avoid re-render
    if (newNotifications.length === 0) {
      return prev;
    }

    // Otherwise, return the combined list
    return [...newNotifications, ...prev];
  });
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
  nextBlockTimestamp: number,
  level: number,
  Labor: Component,
) => {
  const notifications: NotificationType[] = [];
  resourcesPerRealm.forEach(({ realmEntityId, resourceIds }) => {
    resourceIds.forEach((resourceId) => {
      const isFood = [ResourcesIds["Wheat"], ResourcesIds["Fish"]].includes(resourceId);
      const labor = getComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)])) as
        | { balance: number; last_harvest: number; multiplier: number }
        | undefined;
      const harvest =
        labor && nextBlockTimestamp
          ? calculateNextHarvest(
              labor.balance,
              labor.last_harvest,
              labor.multiplier,
              LABOR_CONFIG.base_labor_units,
              isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
              nextBlockTimestamp,
              level,
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
  CaravanMembers: Component,
  Inventory: Component,
  Position: Component,
  ArrivalTime: Component,
  Realm: Component,
  ForeignKey: Component,
  nextBlockTimestamp: number,
) => {
  let notifications: NotificationType[] = [];
  for (const { realmId, position: realmPosition } of realmPositions) {
    const caravansAtPositionWithInventory = runQuery([
      Has(CaravanMembers),
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

    for (const caravanId of caravansAtPositionWithInventory) {
      const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(caravanId)])) as
        | { arrives_at: number }
        | undefined;

      const inventory = getComponentValue(Inventory, getEntityIdFromKeys([BigInt(caravanId)])) as
        | { items_key: number; items_count: number }
        | undefined;
      const foreignKey = inventory
        ? getComponentValue(
            ForeignKey,
            getEntityIdFromKeys([BigInt(caravanId), BigInt(inventory.items_key), BigInt(0)]),
          )
        : undefined;

      const resourcesChestId = foreignKey?.entity_id as number;

      if (arrivalTime?.arrives_at && arrivalTime.arrives_at <= nextBlockTimestamp && resourcesChestId) {
        notifications.push({
          eventType: EventType.OrderClaimable,
          keys: [caravanId.toString()],
          data: {
            destinationRealmId: realmId,
            realmEntityId,
            caravanId,
            resourcesChestId,
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
        const { resource_types_packed, resource_types_count } = realmId
          ? getRealm(realmId)
          : { resource_types_packed: 0, resource_types_count: 0 };

        if (realmId) {
          let unpackedResources = unpackResources(BigInt(resource_types_packed), resource_types_count);
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
