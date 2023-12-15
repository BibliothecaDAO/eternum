import { create } from "zustand";
import { CombatResultInterface, Resource } from "@bibliothecadao/eternum";

export enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  Harvest,
  EmptyChest,
  StolenResource,
  Attacked,
}

export enum CarrierType {
  Caravan,
  Raiders,
}

export type HarvestData = {
  harvestAmount: number;
};

export type EmptyChestData = {
  destinationRealmId: bigint;
  carrierType: CarrierType;
  entityId: bigint;
  realmEntityId: bigint;
  indices: number[];
  resources: Resource[];
};

export type NotificationType = {
  eventType: EventType;
  keys: string[] | string | undefined;
  data?: HarvestData | EmptyChestData | CombatResultInterface;
};

interface NotificationsStore {
  notifications: NotificationType[];
  setNotifications: (notifications: NotificationType[]) => void;
  addUniqueNotifications: (notifications: NotificationType[]) => void;
  deleteNotification: (keys: string | string[] | undefined, eventType: EventType) => void;
  deleteAllNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  addUniqueNotifications: (notifications) => {
    set((state) => {
      let newNotifications = getUniqueNotifications(notifications, state.notifications);
      return { notifications: newNotifications };
    });
  },
  deleteNotification: (keys, eventType) => {
    set((state) => {
      const newNotifications = state.notifications.filter(
        (n) => generateUniqueId(n.keys, n.eventType) !== generateUniqueId(keys, eventType),
      );
      return { notifications: newNotifications };
    });
  },
  deleteAllNotifications: () => {
    set({ notifications: [] });
  },
}));

/**
 * Add unique notifications to the list of notifications
 * @param notifications list of notifications
 * @param setNotifications setter for notifications
 */
const getUniqueNotifications = (
  notifications: NotificationType[],
  prevNotifications: NotificationType[],
): NotificationType[] => {
  // Extract keys from previous notifications
  const prevIds = new Set(prevNotifications.map((n) => generateUniqueId(n.keys, n.eventType)));

  // Filter out notifications that are already in the prev list
  const newNotifications = notifications.filter(
    (notification) => !prevIds.has(generateUniqueId(notification.keys, notification.eventType)),
  );

  // If there are no new notifications, return the previous state to avoid re-render
  if (newNotifications.length === 0) {
    return prevNotifications;
  }

  // Otherwise, return the combined list
  return [...newNotifications, ...prevNotifications];
};

/**
 *  Generate unique id for each notification based on keys and eventType
 * @param notification
 * @returns
 */
export const generateUniqueId = (keys: string | string[] | undefined, eventType: EventType): string => {
  return `${eventType}_${extractAndCleanKey(keys).join("_")}`;
};

// note: temp change because waiting for torii fix
// export function extractAndCleanKey(keys: (string | null)[]): bigint[] {
//   return keys.filter((value) => value !== null && value !== "").map((key) => BigInt(key as string));
// }
export function extractAndCleanKey(keys: string | null | undefined | string[]): bigint[] {
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.map((key) => BigInt(key as string));
  } else {
    let stringKeys = keys as string | null | undefined;
    return (
      stringKeys
        ?.split("/")
        .slice(0, -1)
        .map((key) => BigInt(key as string)) || []
    );
  }
}
