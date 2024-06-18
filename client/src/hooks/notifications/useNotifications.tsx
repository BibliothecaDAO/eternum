import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useState } from "react";
import { Subscription } from "rxjs";
import { parseCombatEvent } from "../../ui/utils/combat";
import { useDojo } from "../context/DojoContext";
import { useResources } from "../helpers/useResources";
import useBlockchainStore from "../store/useBlockchainStore";
import { NotificationType, useNotificationsStore } from "../store/useNotificationsStore";
import useRealmStore from "../store/useRealmStore";
import { generateEmptyChestNotifications } from "./generateNotifications";
import { createCombatNotification, createDirectOfferNotification, useRealmsPosition } from "./utils";

export const useNotifications = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createCombatEvents, createTravelEvents, createDirectOffersEvents },
      },
      components,
    },
  } = useDojo();

  const [closedNotifications, setClosedNotifications] = useState<Record<string, boolean>>({});
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const { realmEntityIds } = useRealmStore();
  const realmPositions = useRealmsPosition(realmEntityIds);

  const { getResourcesFromBalance } = useResources();

  const { notifications, addUniqueNotifications } = useNotificationsStore();

  useEffect(() => {
    const updateNotifications = () => {
      let newNotifications: NotificationType[] = [];
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
            parsedEvent.stolenResources = parsedEvent.stolenResources.concat();
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
