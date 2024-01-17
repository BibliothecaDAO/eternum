import { create } from "zustand";
import { BankInterface, CombatInfo, CombatResultInterface, Position, Resource } from "@bibliothecadao/eternum";

export enum EventType {
  DirectOffer,
  AcceptOffer,
  CancelOffer,
  Harvest,
  EmptyChest,
  StolenResource,
  Attacked,
  ArrivedAtBank,
  ArrivedAtHyperstructure,
  EnemyRaidersHaveArrived,
  YourRaidersHaveArrived,
  EnemyRaidersArriving,
}

export enum CarrierType {
  Caravan,
  Raiders,
}

export type DirectOfferData = {
  takerId: bigint;
  makerId: bigint;
  tradeId: bigint;
};

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

export type ArrivedAtBankData = {
  bank: BankInterface;
  realmEntityId: bigint;
  caravanId: bigint;
  indices: number[];
  resources: Resource[];
  lordsAmounts: number[];
  homePosition: Position;
};

export type ArrivedAtHyperstructureData = {
  hyperstructureId: bigint;
  realmEntityId: bigint;
  caravanId: bigint;
  indices: number[];
  resources: Resource[];
  homePosition: Position;
};

export type RaidersData = {
  raiders: CombatInfo;
};

// todo: use generic data type
export type NotificationType = {
  eventType: EventType;
  keys: string[] | string | undefined;
  data?:
    | HarvestData
    | EmptyChestData
    | CombatResultInterface
    | ArrivedAtBankData
    | ArrivedAtHyperstructureData
    | RaidersData
    | DirectOfferData;
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

// Function to add last login timestamp to local storage and use it to filter notifications
export const setLastLoginTimestamp = (nextBlockTimestamp: number): void => {
  // Store the current timestamp and the next block timestamp as a string
  const currentTimestamp = Math.round(Date.now() / 1000);
  localStorage.setItem("notificationTimestamp", `${currentTimestamp}-${nextBlockTimestamp}`);
};

// Function to retrieve the last login timestamp from local storage
export const getLastLoginTimestamp = (): { lastLoginTimestamp: number; lastLoginBlockTimestamp: number } => {
  const storedValue = localStorage.getItem("notificationTimestamp");

  // If there is no stored value or if it's invalid, return 0 for both timestamps
  if (!storedValue) {
    return { lastLoginTimestamp: 0, lastLoginBlockTimestamp: 0 };
  }

  const [lastLoginTimestamp, lastLoginBlockTimestamp] = storedValue.split("-").map(Number);

  // Check if both numbers are valid; if not, return 0 for both
  if (isNaN(lastLoginTimestamp) || isNaN(lastLoginBlockTimestamp)) {
    return { lastLoginTimestamp: 0, lastLoginBlockTimestamp: 0 };
  }

  // Return the parsed numbers
  return { lastLoginTimestamp, lastLoginBlockTimestamp };
};
