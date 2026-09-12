import type { LocalNotificationPayload } from "@bibliothecadao/notifications";
import { create } from "zustand";
import type { NotificationDevice } from "./notification-database";
import { isAppleMobile, isInstalledPwa } from "./browser-capabilities";

export const useNotificationDeliveryError = create<{ error: string | null }>(() => ({ error: null }));

export function localNotificationCapability(): string | null {
  if (isAppleMobile() && !isInstalledPwa())
    return "Install the game on your Home Screen and open it there to enable notifications.";
  if (!window.isSecureContext || typeof Notification === "undefined" || !("serviceWorker" in navigator))
    return "Device notifications are unavailable in this browser.";
  if (Notification.permission === "denied")
    return "Notifications are blocked. Change this site's permission in your browser settings.";
  return null;
}

export async function notificationWorkerRequest<T>(
  owner: string,
  action: string,
  input: { payload?: LocalNotificationPayload; token?: string } = {},
): Promise<T> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const worker = registration?.active;
  if (!worker) throw new Error("The game worker is not ready. Install the latest game update, then reload.");
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const close = () => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
    };
    const timer = setTimeout(() => {
      close();
      reject(new Error("The game worker did not respond. Apply the latest game update and retry."));
    }, 5000);
    channel.port1.onmessage = ({ data }) => {
      close();
      if (data?.ok) resolve(data.value as T);
      else reject(new Error(data?.error ?? "Notification delivery failed"));
    };
    worker.postMessage({ type: "GAME_NOTIFICATION", owner, action, ...input }, [channel.port2]);
  });
}

export const readLocalNotificationDevice = (owner: string) =>
  notificationWorkerRequest<NotificationDevice | null>(owner, "status");

export function reportNotificationDeliveryError(error: unknown): void {
  useNotificationDeliveryError.setState({
    error: error instanceof Error ? error.message : "Notification delivery failed",
  });
}
