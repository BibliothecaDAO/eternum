import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import { Component, getComponentValue } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "../../utils/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { calculateNextHarvest } from "../../components/cityview/realm/labor/laborUtils";
import { getRealm } from "../../components/cityview/realm/SettleRealmComponent";
import useRealmStore from "../store/useRealmStore";
import { unpackResources } from "../../utils/packedData";
import { ResourcesIds } from "../../constants/resources";
import { UpdatedEntity } from "../../dojo/createEntitySubscription";

const LABOR_CONFIG = {
  base_food_per_cycle: 14000,
  base_labor_units: 7200,
  base_resources_per_cycle: 21,
};

export enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  ReceiveResources,
  CreateRealm,
  Trade,
  Harvest,
}

type realmsResources = { realmEntityId: number; resourceIds: number[] }[];

export type NotificationType = {
  eventType: EventType;
  keys: string[];
};

export const useNotifications = () => {
  const {
    setup: {
      entityUpdates,
      components: { Status, Labor },
    },
  } = useDojo();

  const { nextBlockTimestamp } = useBlockchainStore();
  const { realmEntityIds } = useRealmStore();
  const realmsResources = useRealmsResource(realmEntityIds);

  // const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);

  /**
   * Trade notifications
   */
  useEffect(() => {
    const subscription = entityUpdates.subscribe((updates) => {
      const notifications = generateTradeNotifications(updates, Status);
      // console.log({ notifications });
      // TODO: need to solve this because it keeps growing with duplicate for some reason
      setNotifications((prev) => {
        const newKeys = new Set(
          notifications.map((n) => JSON.stringify(n.keys)),
        );
        const filteredPrev = prev.filter(
          (notification) => !newKeys.has(JSON.stringify(notification.keys)),
        );
        return [...notifications, ...filteredPrev];
      });
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
      // TODO: need to only add if not already in there
      setNotifications((prev) => [...new Set([...notifications, ...prev])]);
    };
    // Call it once initially
    updateNotifications();

    // Set up interval to check for labor notifications every 10 seconds
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
 * Generate trade notifications from entity updates from graphql subscription
 * @param entityUpdates list of updated entities with keys and componentNames
 * @param Status Component
 * @returns
 */

const generateTradeNotifications = (
  entityUpdates: UpdatedEntity[],
  Status: Component,
) => {
  const notifications = entityUpdates
    .map((update) => {
      if (update.componentNames.includes("Trade")) {
        const status = getComponentValue(
          Status,
          getEntityIdFromKeys(update.entityKeys.map((str) => BigInt(str))),
        );
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
      const isFood = [ResourcesIds["Wheat"], ResourcesIds["Fish"]].includes(
        resourceId,
      );
      const labor = getComponentValue(
        Labor,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      ) as
        | { balance: number; last_harvest: number; multiplier: number }
        | undefined;
      const harvest =
        labor && nextBlockTimestamp
          ? calculateNextHarvest(
              labor.balance,
              labor.last_harvest,
              labor.multiplier,
              LABOR_CONFIG.base_labor_units,
              isFood
                ? LABOR_CONFIG.base_food_per_cycle
                : LABOR_CONFIG.base_resources_per_cycle,
              nextBlockTimestamp,
            )
          : 0;

      if (harvest > 0) {
        notifications.push({
          eventType: EventType.Harvest,
          keys: [realmEntityId.toString(), resourceId.toString()],
        });
      }
    });
  });

  return notifications;
};

/**
 * Get all resources for each realm
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
          let unpackedResources = unpackResources(
            BigInt(resource_types_packed),
            resource_types_count,
          );
          return {
            realmEntityId,
            resourceIds: [ResourcesIds["Wheat"], ResourcesIds["Fish"]].concat(
              unpackedResources,
            ),
          };
        }
        return null;
      })
      .filter(Boolean) as { realmEntityId: number; resourceIds: number[] }[];
  }, [realms]);
};

/**
 * Cannot use defineQuery atm because it we don't setComponentValue in the true order of the events. If you click
 * on the Market tab, then we load all the trades, which will trigger these notifications, even if the trades were
 * done a long time ago.
 */
// const { update$: realmUpdate$ } = useMemo(
//   () => defineQuery([Has(Realm)]),
//   [],
// );

// useMemo(() => {
//   realmUpdate$
//     .pipe(
//       distinctUntilChanged((a, b) => isEqual(a, b)),
//       filter((update) => !isEqual(update.value[0], update.value[1])),
//     )
//     .subscribe((update) => {
//       console.log("RealmMUDentityUpdates", update);
//     });
// }, []);

// const { update$: resourceUpdate$ } = useMemo(
//   () => defineQuery([Has(Resource)]),
//   [],
// );

// useMemo(() => {
//   resourceUpdate$
//     .pipe(
//       distinctUntilChanged((a, b) => isEqual(a, b)),
//       filter((update) => {
//         return !isEqual(update.value[0], update.value[1]);
//       }),
//     )
//     .subscribe((update) => {
//       console.log("ResourceMUDentityUpdates", update);
//     });
// }, []);

// const { update$: tradeUpdate$ } = useMemo(
//   () =>
//     defineQuery([
//       Has(Trade),
//       HasValue(Trade, {
//         taker_id: 0,
//         claimed_by_maker: 0,
//         claimed_by_taker: 0,
//       }),
//     ]),
//   [],
// );

// useMemo(() => {
//   tradeUpdate$
//     .pipe(
//       distinctUntilChanged((a, b) => isEqual(a, b)),
//       filter((update) => {
//         return !isEqual(update.value[0], update.value[1]);
//       }),
//     )
//     .subscribe((update) => {
//       console.log("TradeMUDentityUpdates", update);
//       setNotifications((notifications) => [
//         { eventType: EventType.Trade, update },
//         ...notifications,
//       ]);
//     });
// }, []);
