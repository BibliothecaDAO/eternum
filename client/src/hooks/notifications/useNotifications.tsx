import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { Component, Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { extractAndCleanKey, getEntityIdFromKeys, getPosition } from "../../utils/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { calculateNextHarvest } from "../../components/cityview/realm/labor/laborUtils";
import useRealmStore from "../store/useRealmStore";
import { unpackResources } from "../../utils/packedData";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { UpdatedEntity } from "../../dojo/createEntitySubscription";
import { Position } from "../../types";
import { getRealm } from "../../utils/realms";

const LABOR_CONFIG = {
  base_food_per_cycle: 14000,
  base_labor_units: 7200,
  base_resources_per_cycle: 21,
};

export enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  Harvest,
  OrderClaimable,
}

type realmsResources = { realmEntityId: number; resourceIds: number[] }[];
type realmsPosition = { realmId: number; position: Position }[];

export type NotificationType = {
  eventType: EventType;
  keys: string[] | string;
  data?: HarvestData | ClaimOrderData;
};

type HarvestData = {
  harvestAmount: number;
};

type ClaimOrderData = {
  destinationRealmId: number;
  tradeId: number;
  realmEntityId: number;
};

export const useNotifications = () => {
  const {
    setup: {
      entityUpdates,
      components: { Status, Realm, Labor, ArrivalTime, Position, Trade, FungibleEntities },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityIds } = useRealmStore();
  const realmsResources = useRealmsResource(realmEntityIds);
  const realmPositions = useRealmsPosition(realmEntityIds);

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
        ? generateLaborNotifications(realmsResources, nextBlockTimestamp, Labor)
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
   * Claimable orders notifications
   */

  useEffect(() => {
    const updateNotifications = () => {
      const notifications = nextBlockTimestamp
        ? generateClaimableOrdersNotifications(
            realmPositions,
            FungibleEntities,
            Position,
            ArrivalTime,
            Trade,
            Realm,
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
            )
          : 0;

      if (harvest > 0) {
        notifications.push({
          eventType: EventType.Harvest,
          keys: [realmEntityId.toString(), resourceId.toString()],
          data: {
            harvestAmount: harvest,
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
const generateClaimableOrdersNotifications = (
  realmPositions: realmsPosition,
  FungibleEntities: Component,
  Position: Component,
  ArrivalTime: Component,
  Trade: Component,
  Realm: Component,
  nextBlockTimestamp: number,
) => {
  let notifications: NotificationType[] = [];
  for (const { realmId, position: realmPosition } of realmPositions) {
    let orderIds = runQuery([
      Has(FungibleEntities),
      Has(ArrivalTime),
      HasValue(Position, { x: realmPosition.x, y: realmPosition.y }),
    ]);

    for (const orderId of orderIds) {
      const makerTrade = runQuery([HasValue(Trade, { maker_order_id: orderId, claimed_by_maker: 0 })]);
      const takerTrade = runQuery([HasValue(Trade, { taker_order_id: orderId, claimed_by_taker: 0 })]);
      let claimed = makerTrade.size === 0 && takerTrade.size === 0;

      if (!claimed) {
        const realms = runQuery([HasValue(Realm, { realm_id: realmId })]);
        const realmEntityId = Number(realms.values().next().value);
        const tradeId = makerTrade.size > 0 ? makerTrade.values().next().value : takerTrade.values().next().value;
        const arrivalTime = getComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(orderId)])) as
          | { arrives_at: number }
          | undefined;

        if (arrivalTime?.arrives_at && arrivalTime.arrives_at <= nextBlockTimestamp) {
          notifications.push({
            eventType: EventType.OrderClaimable,
            keys: [orderId.toString()],
            data: {
              destinationRealmId: realmId,
              realmEntityId,
              tradeId,
            },
          });
        }
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
