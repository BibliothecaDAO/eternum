// notificationStore.ts
import { create } from "zustand";

enum EventType {
  MakeOffer,
  AcceptOffer,
  CancelOffer,
  ReceiveResources,
  CreateRealm,
  Trade,
}

type Notification = {
  eventType: EventType;
  keys: string[];
};

type NotificationStore = {
  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  removeNotification: (index: number) => void;
};

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
  removeNotification: (index) =>
    set((state) => {
      const newNotifications = [...state.notifications];
      newNotifications.splice(index, 1);
      return { notifications: newNotifications };
    }),
}));
