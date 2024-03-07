import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import useRealmStore from "../store/useRealmStore";
import { useLevel } from "../helpers/useLevel";
import { EventType, NotificationType, useNotificationsStore } from "../store/useNotificationsStore";
import { useResources } from "../helpers/useResources";
import {
  generateEmptyChestNotifications,
  generateLaborNotifications,
  generateArrivedAtBankNotifications,
  // generateArrivedAtHyperstructureNotifications,
  generateEnemyRaidersHaveArrivedNotifications,
  generateYourRaidersHaveArrivedNotifications,
} from "./generateNotifications";
import { useRealmsPosition, useRealmsResource, createCombatNotification, createDirectOfferNotification } from "./utils";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useCombat } from "../helpers/useCombat";
import { useBanks } from "../helpers/useBanks";
// import { useHyperstructure } from "../helpers/useHyperstructure";
import { parseCombatEvent } from "../../utils/combat";
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
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);

  const { getBanks } = useBanks();
  const banks = useMemo(() => getBanks(), []);

  // const hyperstructure = useMemo(() => {
  //   const hyperstructureId = getHyperstructureIdByRealmEntityId(realmEntityId);
  //   if (hyperstructureId) {
  //     const position = getComponentValue(components.Position, getEntityIdFromKeys([hyperstructureId]));
  //     return position ? { hyperstructureId, position: { x: position.x, y: position.y } } : undefined;
  //   }
  // }, [hyperstructureId]);

  const { getEntityLevel, getHyperstructureLevelBonus, getRealmLevelBonus } = useLevel();
  const { getResourcesFromInventory } = useResources();
  const { getEntitiesCombatInfo } = useCombat();

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

        let emptyChestNotifications = generateEmptyChestNotifications(
          realmPositions,
          components,
          nextBlockTimestamp,
          getResourcesFromInventory,
        );
        newNotifications = newNotifications.concat(emptyChestNotifications);

        let arrivedAtBankNotifications = generateArrivedAtBankNotifications(
          BigInt(account.address),
          components,
          nextBlockTimestamp,
          banks,
          getResourcesFromInventory,
        );
        newNotifications = newNotifications.concat(arrivedAtBankNotifications);

        // if (hyperstructure) {
        //   let arrivedAtHyperstructureNotifications = generateArrivedAtHyperstructureNotifications(
        //     BigInt(account.address),
        //     nextBlockTimestamp,
        //     components,
        //     hyperstructure,
        //     getResourcesFromInventory,
        //   );
        //   newNotifications = newNotifications.concat(arrivedAtHyperstructureNotifications);
        // }

        let enemyRaidersHaveArrivedNotifications = generateEnemyRaidersHaveArrivedNotifications(
          BigInt(account.address),
          nextBlockTimestamp,
          realmPositions,
          components,
          getEntitiesCombatInfo,
        );
        newNotifications = newNotifications.concat(enemyRaidersHaveArrivedNotifications);

        let yourRaidersHaveArrivedNotifications = generateYourRaidersHaveArrivedNotifications(
          nextBlockTimestamp,
          realmPositions,
          components,
          getEntitiesCombatInfo,
        );
        newNotifications = newNotifications.concat(yourRaidersHaveArrivedNotifications);
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
            const newNotification = createCombatNotification(parseCombatEvent(event));
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

    const subscribeToCombatEvents = async () => {
      for (const { realmEntityId } of realmEntityIds) {
        let position = getComponentValue(components.Position, getEntityIdFromKeys([realmEntityId]));
        if (position) {
          const observable = await createTravelEvents(position.x, position.y);
          const subscription = observable.subscribe((event) => {
            if (event) {
              let entityId = parseInt(event.data[0]);

              let raidersList = getEntitiesCombatInfo([BigInt(entityId)]);
              let raiders = raidersList.length === 1 ? raidersList[0] : undefined;

              if (
                raiders?.arrivalTime &&
                nextBlockTimestamp &&
                raiders.arrivalTime > nextBlockTimestamp &&
                raiders.entityOwnerId &&
                !realmEntityIds.map(({ realmEntityId }) => realmEntityId).includes(raiders.entityOwnerId)
              ) {
                const newNotification = {
                  eventType: EventType.EnemyRaidersArriving,
                  keys: [entityId.toString()],
                  data: {
                    raiders,
                  },
                };
                addUniqueNotifications([newNotification]);
              }
            }
          });
          subscriptions.push(subscription);
        }
      }
    };

    subscribeToCombatEvents();

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
        ? generateEmptyChestNotifications(realmPositions, components, nextBlockTimestamp, getResourcesFromInventory)
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
