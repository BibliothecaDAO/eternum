import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { isAppleMobile, isInstalledApp, runsServiceWorker } from "@/pwa/browser-capabilities";
import { notificationWorkerRequest, readLocalNotificationDevice } from "@/pwa/local-notification-client";
import { disablePushNotifications, enablePushNotifications, readPushDevice } from "@/pwa/push-notification-client";
import { disableIosAppPush, enableIosAppPush, iosAppBridge, iosAppPushState } from "@/pwa/ios-app-push";
import type { PushConfiguration } from "@bibliothecadao/notifications";

/**
 * Whether this phone or browser gets the account's alerts, as one switch: on, off, saving, or what stands in its way
 * (an iPhone browser needs the installed app; a browser that blocks alerts; one that cannot show them).
 */
export type ThisDeviceState = "on" | "off" | "saving" | "install" | "blocked" | "unavailable";

const blockerOf = (): ThisDeviceState | null => {
  if (isAppleMobile() && !isInstalledApp()) return "install";
  if (!window.isSecureContext || typeof Notification === "undefined" || !runsServiceWorker()) return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  return null;
};

/** Delivered here when the background registration or the running-page delivery holds this account. */
const readOn = async (owner: string): Promise<boolean> => {
  const [push, local] = await Promise.all([readPushDevice(), readLocalNotificationDevice(owner)]);
  return (push?.state === "active" && push.owner === owner) || local !== null;
};

/**
 * The device switch over the two deliveries: background alerts when the server sends them, else alerts while a game
 * page runs. Turning it on asks the browser's permission inside the tap; turning it off stops both. A failure turns
 * the switch back and is returned as the reason. In the iOS app the switch is the app's own push (ios-app-push.ts).
 */
export const useThisDevice = (owner: string | null) => {
  const [state, setState] = useState<ThisDeviceState>(() => (iosAppBridge() ? "off" : (blockerOf() ?? "off")));
  const [config, setConfig] = useState<PushConfiguration | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const app = iosAppBridge();
    if (app) return setState(owner ? await iosAppPushState(app, owner) : "off");
    const blocker = blockerOf();
    if (blocker || !owner) return setState(blocker ?? "off");
    setState((await readOn(owner)) ? "on" : "off");
  }, [owner]);

  useEffect(() => {
    void refresh().catch(() => setState("off"));
    void identityClient.getPushConfiguration().then(setConfig, () => setConfig(null));
    const onFocus = () => void refresh().catch(() => setState("off"));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const toggle = async () => {
    if (!owner || (state !== "on" && state !== "off")) return;
    const turningOn = state === "off";
    setState("saving");
    setFailure(null);
    try {
      const app = iosAppBridge();
      if (app && turningOn) await enableIosAppPush(app, owner, config);
      else if (app) await disableIosAppPush();
      else if (turningOn && config?.enabled)
        await enablePushNotifications(owner, config.publicKey, config.gameAlerts, config.directMessages);
      else if (turningOn) {
        if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted")
          throw new Error("permission_refused");
        await notificationWorkerRequest(owner, "enable");
      } else {
        await disablePushNotifications(owner);
        await notificationWorkerRequest(owner, "disable");
      }
    } catch (cause) {
      console.error("notification_device_failed", { error: cause instanceof Error ? cause.message : cause });
      setFailure(turningOn ? "on" : "off");
    }
    await refresh().catch(() => setState(turningOn ? "off" : "on"));
  };

  return { state, toggle, failed: failure !== null };
};
