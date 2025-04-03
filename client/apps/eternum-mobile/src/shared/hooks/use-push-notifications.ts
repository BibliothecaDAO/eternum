import { useEffect, useState } from "react";
import { removeSubscription, saveSubscription } from "../lib/push-notification-api";

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

interface PushNotificationState {
  subscription: PushSubscription | null;
  isSubscribed: boolean;
  isSupported: boolean;
  permissionState: NotificationPermission | null;
  error: Error | null;
}

interface UsePushNotificationsReturn extends PushNotificationState {
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  checkPermission: () => Promise<boolean>;
}

export const usePushNotifications = (vapidPublicKey?: string): UsePushNotificationsReturn => {
  // Default VAPID key - you'll need to replace this with your actual key
  // This is just a placeholder and won't work in production
  const defaultVapidKey = "BAl0gEcSdNwJ8QhJIh8HlSGVBMkMCwPOefDD58m3ILYudAIZaFDNOKOvb0-n7zO9P5a-f2WFFBqcN7wKnN0XGqc";
  const applicationServerKey = vapidPublicKey
    ? urlBase64ToUint8Array(vapidPublicKey)
    : urlBase64ToUint8Array(defaultVapidKey);

  const [state, setState] = useState<PushNotificationState>({
    subscription: null,
    isSubscribed: false,
    isSupported: "serviceWorker" in navigator && "PushManager" in window,
    permissionState: null,
    error: null,
  });

  // Check if push notifications are supported and get current subscription
  useEffect(() => {
    if (!state.isSupported) {
      console.log("Push notifications not supported");
      return;
    }

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        const permissionState = window.Notification.permission as NotificationPermission;

        setState((prev) => ({
          ...prev,
          subscription,
          isSubscribed: !!subscription,
          permissionState,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    };

    checkSubscription();
  }, [state.isSupported]);

  // Subscribe to push notifications
  const subscribe = async () => {
    if (!state.isSupported) {
      console.error("Push notifications not supported");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Request notification permission if not granted
      if (Notification.permission !== "granted") {
        const permission = await checkPermission();
        if (!permission) {
          throw new Error("Notification permission denied");
        }
      }

      // Create subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Update state
      setState((prev) => ({
        ...prev,
        subscription,
        isSubscribed: true,
        error: null,
      }));

      // Send the subscription to your server
      try {
        await saveSubscription(subscription);
        console.log("Push notification subscription saved on server");
      } catch (error) {
        console.error("Error saving subscription on server:", error);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async () => {
    if (!state.subscription) {
      console.log("No subscription to unsubscribe from");
      return;
    }

    try {
      // First remove from server
      try {
        await removeSubscription(state.subscription);
        console.log("Subscription removed from server");
      } catch (error) {
        console.error("Error removing subscription from server:", error);
      }

      // Then unsubscribe locally
      await state.subscription.unsubscribe();

      setState((prev) => ({
        ...prev,
        subscription: null,
        isSubscribed: false,
        error: null,
      }));

      console.log("Unsubscribed from push notifications");
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  };

  // Check notification permission
  const checkPermission = async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    if (Notification.permission === "granted") {
      setState((prev) => ({ ...prev, permissionState: "granted" }));
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permissionState: permission }));
      return permission === "granted";
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        permissionState: "denied",
      }));
      return false;
    }
  };

  return {
    ...state,
    subscribe,
    unsubscribe,
    checkPermission,
  };
};
