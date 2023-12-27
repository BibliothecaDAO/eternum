import { useEffect, useMemo, useState } from "react";
import { useDojo } from "../../DojoContext";
import useBlockchainStore from "../store/useBlockchainStore";
import useRealmStore from "../store/useRealmStore";
import { createCombatNotification, parseCombatEvent } from "../../utils/combat";
import { useLevel } from "../helpers/useLevel";
import { useNotificationsStore } from "../store/useNotificationsStore";
import { useResources } from "../helpers/useResources";
import {
  generateEmptyChestNotifications,
  generateLaborNotifications,
  useRealmsPosition,
  useRealmsResource,
} from "./utils";

export const useNotifications = () => {
  const {
    setup: {
      updates: {
        eventUpdates: { createCombatEvents },
      },
      components: { Realm, Labor, ArrivalTime, CaravanMembers, Position, Inventory, ForeignKey },
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
    closedNotifications,
    handleCloseNotification,
  };
};
