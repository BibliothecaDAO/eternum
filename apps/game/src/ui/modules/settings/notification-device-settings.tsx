import { useEffect, useState } from "react";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import {
  localNotificationCapability,
  notificationWorkerRequest,
  readLocalNotificationDevice,
  useNotificationDeliveryError,
} from "@/pwa/local-notification-client";
import type { NotificationDevice } from "@/pwa/notification-database";
import { getActiveWorld } from "@/runtime/world";
import { buildEntryHref } from "@/play/navigation/play-route";
import { parseNotificationPayload } from "@bibliothecadao/notifications";
import { HUD_BODY } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";

export function NotificationDeviceSettings({
  owner,
  preferenceReady,
}: {
  owner: string | null;
  preferenceReady: boolean;
}) {
  const [device, setDevice] = useState<NotificationDevice | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capability, setCapability] = useState(localNotificationCapability);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { error } = useNotificationDeliveryError();
  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      setCapability(localNotificationCapability());
      if (!owner || !("serviceWorker" in navigator)) return;
      void readLocalNotificationDevice(owner)
        .then((value) => {
          if (!disposed) {
            setDevice(value);
            setDeviceError(null);
          }
        })
        .catch((error) => {
          if (!disposed)
            setDeviceError(error instanceof Error ? error.message : "Could not read device notification status.");
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
    };
  }, [owner]);

  const act = async (action: "enable" | "disable" | "test") => {
    if (!owner || busy) return;
    setBusy(true);
    setFeedback(null);
    useNotificationDeliveryError.setState({ error: null });
    try {
      // The permission request must run synchronously in the button's user gesture, before worker/network awaits.
      if (action === "enable" && Notification.permission !== "granted") {
        if ((await Notification.requestPermission()) !== "granted")
          throw new Error("Notification permission was not granted.");
      }
      if (useIdentitySessionStore.getState().session?.user.id !== owner)
        throw new Error("Your account changed. Reopen Settings.");
      if (action === "test") {
        const current = await readLocalNotificationDevice(owner);
        if (!current) throw new Error("Enable this device before sending a test.");
        const result = await notificationWorkerRequest<string>(owner, "test", {
          token: current.token,
          payload: testNotification(owner),
        });
        setFeedback(
          result === "shown"
            ? "Test sent. Your browser or OS controls whether it appears."
            : `Test not sent: ${result}.`,
        );
      } else {
        const next = await notificationWorkerRequest<NotificationDevice | null>(owner, action);
        if (useIdentitySessionStore.getState().session?.user.id !== owner) {
          await notificationWorkerRequest(owner, "disable");
          throw new Error("Your account changed. Device delivery remains off.");
        }
        setDevice(next);
        setDeviceError(null);
        setFeedback(
          action === "enable" ? "Local notifications enabled for this account." : "Device notifications disabled.",
        );
      }
    } catch (error) {
      useNotificationDeliveryError.setState({
        error: error instanceof Error ? error.message : "Notification request failed",
      });
    } finally {
      setBusy(false);
      setCapability(localNotificationCapability());
    }
  };

  return (
    <div className="space-y-2">
      <p className={HUD_BODY}>
        Device delivery: {deviceError ? "Unknown" : device && !capability ? "Local" : "Off"}. Local alerts need a
        running game page; closing or suspending it stops delivery.
      </p>
      {capability && <p className={HUD_BODY}>{capability}</p>}
      {deviceError && (
        <p role="alert" className="text-xs text-danger">
          {deviceError}
        </p>
      )}
      {!owner ? (
        <p className={HUD_BODY}>Sign in to enable notifications on this device.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={HUD_PILL_BUTTON}
            disabled={busy || (!device && (!!capability || !preferenceReady))}
            onClick={() => {
              void act(device ? "disable" : "enable");
            }}
          >
            {device ? "Disable device notifications" : "Enable device notifications"}
          </button>
          {device && (
            <button
              type="button"
              className={HUD_PILL_BUTTON}
              disabled={busy || !!capability}
              onClick={() => {
                void act("test");
              }}
            >
              Send test notification
            </button>
          )}
        </div>
      )}
      {feedback && (
        <p role="status" className={HUD_BODY}>
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function testNotification(owner: string) {
  const world = getActiveWorld();
  if (!world) throw new Error("Enter a game before sending a test notification.");
  const createdAt = Date.now();
  return parseNotificationPayload(
    {
      version: 1,
      owner,
      id: `test:${crypto.randomUUID()}`,
      title: "Realms notifications",
      body: "This device can receive local game notifications.",
      target: buildEntryHref({ chain: world.chain, worldName: world.name, intent: "play", autoSettle: false }),
      createdAt,
      expiresAt: createdAt + 120_000,
    },
    createdAt,
  );
}
