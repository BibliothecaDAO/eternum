import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../context/DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import useRealmStore from "../store/useRealmStore";
import { useLevel } from "../helpers/useLevel";
import { EventType, NotificationType, useNotificationsStore } from "../store/useNotificationsStore";
import { useResources } from "../helpers/useResources";
import {
  generateEmptyChestNotifications,
  generateLaborNotifications,
  // generateArrivedAtHyperstructureNotifications,
  generateEnemyRaidersHaveArrivedNotifications,
  generateYourRaidersHaveArrivedNotifications,
} from "./generateNotifications";
import { useRealmsPosition, useRealmsResource, createCombatNotification, createDirectOfferNotification } from "./utils";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
// import { useHyperstructure } from "../helpers/useHyperstructure";
import { parseCombatEvent } from "../../ui/utils/combat";
import useUIStore from "../store/useUIStore";
import { Subscription } from "rxjs";

export const useNotifications = () => {
  const {
    setup: {
      account: { account },
      updates: {
        eventUpdates: { createCombatEvents, createTravelEvents, createDirectOffersEvents },
      },
      components,
    },
  } = useDojo();

  const [closedNotifications, setClosedNotifications] = useState<Record<string, boolean>>({});
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityIds, realmEntityId } = useRealmStore();
  const realmsResources = useRealmsResource(realmEntityIds);
  const realmPositions = useRealmsPosition(realmEntityIds);
  // const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);
  const conqueredHyperstructureNumber = 0;

  // const hyperstructure = useMemo(() => {
  //   const hyperstructureId = getHyperstructureIdByRealmEntityId(realmEntityId);
  //   if (hyperstructureId) {
  //     const position = getComponentValue(components.Position, getEntityIdFromKeys([hyperstructureId]));
  //     return position ? { hyperstructureId, position: { x: position.x, y: position.y } } : undefined;
  //   }
  // }, [hyperstructureId]);

  const { getEntityLevel, getHyperstructureLevelBonus, getRealmLevelBonus } = useLevel();
  const { getResourcesFromBalance } = useResources();

  const { notifications, addUniqueNotifications } = useNotificationsStore();

  // get harvest bonuses
  const [realmLevel, hyperstructureLevel] = useMemo(() => {
    const realmLevel = getEntityLevel(realmEntityId)?.level || 0;
    return [realmLevel, conqueredHyperstructureNumber * 25 + 100];
  }, [realmEntityId]);

  /**
   * Labor notifications
   */
  useEffect(() => {
    const updateNotifications = () => {
      let newNotifications: NotificationType[] = [];

      if (nextBlockTimestamp) {
        let laborNotifications = generateLaborNotifications(
          realmsResources,
          getRealmLevelBonus,
          getHyperstructureLevelBonus,
          nextBlockTimestamp,
          realmLevel,
          hyperstructureLevel || 0,
          components,
        );
        newNotifications = newNotifications.concat(laborNotifications);

        // let emptyChestNotifications =
        // generateEmptyChestNotifications(
        //   realmPositions,
        //   components,
        //   nextBlockTimestamp,
        //   getResourcesFromBalance,
        // );
        // newNotifications = newNotifications.concat(emptyChestNotifications);

        // if (hyperstructure) {
        //   let arrivedAtHyperstructureNotifications = generateArrivedAtHyperstructureNotifications(
        //     BigInt(account.address),
        //     nextBlockTimestamp,
        //     components,
        //     hyperstructure,
        //     getResourcesFromBalance,
        //   );
        //   newNotifications = newNotifications.concat(arrivedAtHyperstructureNotifications);
        // }
      }
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
   * Direct Offers notifications
   */
  // New combat notitications from createCombatEvents (subscription)
  useEffect(() => {
    const subscriptions: Subscription[] = [];

    const subscribeToDirectOffersEvents = async () => {
      for (const { realmEntityId } of realmEntityIds) {
        const observable = await createDirectOffersEvents(realmEntityId);
        const subscription = observable.subscribe((event) => {
          if (event) {
            const newNotification = createDirectOfferNotification(event);
            addUniqueNotifications([newNotification]);
          }
        });
        subscriptions.push(subscription);
      }
    };
    subscribeToDirectOffersEvents();

    // Cleanup function
    return () => {
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
    };
  }, [realmEntityIds]);

  /**
   * Combat notifications
   */
  // New combat notitications from createCombatEvents (subscription)
  useEffect(() => {
    const subscriptions: Subscription[] = [];

    const subscribeToCombatEvents = async () => {
      for (const { realmEntityId } of realmEntityIds) {
        const observable = await createCombatEvents(realmEntityId);
        const subscription = observable.subscribe((event) => {
          if (event) {
            let parsedEvent = parseCombatEvent(event);
            parsedEvent.stolenResources = parsedEvent.stolenResources
              .concat
              // getResourcesFromResourceChestIds(parsedEvent.stolenChestsIds),
              ();
            const newNotification = createCombatNotification(parsedEvent);
            addUniqueNotifications([newNotification]);
          }
        });
        subscriptions.push(subscription);
      }
    };

    subscribeToCombatEvents();

    // Cleanup function
    return () => {
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
    };
  }, [realmEntityIds]);

  /**
   * Enemies arriving notifications
   */
  useEffect(() => {
    const subscriptions: Subscription[] = [];

    // Cleanup function
    return () => {
      subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
    };
  }, [
    realmEntityIds,
    components,
    getEntityIdFromKeys,
    createTravelEvents,
    getComponentValue,
    addUniqueNotifications,
    nextBlockTimestamp,
  ]);

  /**
   * Claimable orders notifications
   */

  useEffect(() => {
    const updateNotifications = () => {
      const newNotifications = nextBlockTimestamp
        ? generateEmptyChestNotifications(realmPositions, components, nextBlockTimestamp, getResourcesFromBalance)
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
    closedNotifications,
    handleCloseNotification,
  };
};
