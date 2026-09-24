import { useEffect, useRef, useState } from "react";
import { identityClient } from "@/hooks/context/identity-session";
import { localNotificationCapability } from "@/pwa/local-notification-client";
import { disablePushNotifications, enablePushNotifications, readPushDevice } from "@/pwa/push-notification-client";
import type { PushNotificationDevice } from "@/pwa/notification-database";
import type { PushConfiguration } from "@bibliothecadao/notifications";
import { HUD_BODY } from "@/ui/design-system/atoms/hud-typography";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";

export function PushNotificationSettings({ owner }: { owner: string | null }) {
  const [config, setConfig] = useState<PushConfiguration | null>(null);
  const [device, setDevice] = useState<PushNotificationDevice | null>(null);
  const [directMessagesEnabled, setDirectMessagesEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const refreshVersion = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof PushManager !== "undefined" && !!navigator.locks;
  const capability = localNotificationCapability();
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      if (actionPending.current) return;
      const version = ++refreshVersion.current;
      const isCurrent = () => !disposed && version === refreshVersion.current;
      try {
        const current =
          supported && (await navigator.serviceWorker.getRegistration("/"))?.active ? await readPushDevice() : null;
        if (isCurrent()) setDevice(current);
        const next = await identityClient.getPushConfiguration();
        if (isCurrent()) setConfig(next);
        if (current?.owner === owner && current.state === "active" && next.enabled) {
          const status = await identityClient.getPushSubscriptionStatus(owner, current.id);
          if (!status.registered) throw new Error("This background registration expired. Disable it and enable again.");
          if (isCurrent()) setDirectMessagesEnabled(status.directMessages === true);
        }
        if (isCurrent()) {
          setConfig(next);
          setDevice(current);
          setError(null);
        }
      } catch (cause) {
        if (isCurrent())
          setError(cause instanceof Error ? cause.message : "Could not load background notification status.");
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refresh);
    };
  }, [owner, supported]);

  const run = async (action: "enable" | "disable") => {
    if (!owner || actionPending.current) return;
    actionPending.current = true;
    refreshVersion.current++;
    setBusy(true);
    setError(null);
    try {
      if (action === "enable") {
        if (!config?.enabled) throw new Error("Background tests are unavailable.");
        await enablePushNotifications(owner, config.publicKey, config.gameAlerts, config.directMessages);
        setDirectMessagesEnabled(config.directMessages);
      } else {
        await disablePushNotifications(device?.owner ?? owner);
        setDirectMessagesEnabled(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Background notification request failed.");
    } finally {
      try {
        setDevice(await readPushDevice());
      } catch {
        setError("Could not read device status. Reload Settings before trying again.");
      }
      actionPending.current = false;
      setBusy(false);
    }
  };
  // Existing registrations must remain removable even when server sending is disabled.
  if (!config?.enabled && !device)
    return error ? (
      <p role="alert" className={HUD_BODY}>
        {error}
      </p>
    ) : null;
  const gameAlerts = config?.enabled === true && config.gameAlerts;
  const directMessages = config?.enabled === true && config.directMessages;
  const backgroundAlerts = gameAlerts || directMessages;
  const needsGameAlerts = gameAlerts && !device?.automatic?.acknowledged;
  const needsDirectMessages = directMessages && !directMessagesEnabled;
  return (
    <section aria-label="Background notifications" className="space-y-2">
      <p className={HUD_BODY}>
        Background notifications:{" "}
        {device?.state === "active" && device.owner === owner ? "Enabled" : device ? "Cleanup required" : "Off"}.
      </p>
      <p className={HUD_BODY}>{backgroundNotificationDescription(gameAlerts, directMessages)}</p>
      {capability && <p className={HUD_BODY}>{capability}</p>}
      {!owner ? (
        <p className={HUD_BODY}>Sign in to enable background notifications.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={HUD_PILL_BUTTON}
            disabled={busy || !supported || (!device && (!!capability || !config?.enabled))}
            onClick={() => {
              void run(device ? "disable" : "enable");
            }}
          >
            {device
              ? "Disable background notifications"
              : backgroundAlerts
                ? "Enable background notifications"
                : "Enable background tests"}
          </button>
          {(needsGameAlerts || needsDirectMessages) && device?.state === "active" && device.owner === owner && (
            <button
              type="button"
              className={HUD_PILL_BUTTON}
              disabled={busy || !!capability}
              onClick={() => {
                void run("enable");
              }}
            >
              {needsGameAlerts && needsDirectMessages
                ? "Enable game and direct-message alerts"
                : needsDirectMessages
                  ? "Enable direct-message alerts"
                  : "Enable game alerts"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function backgroundNotificationDescription(gameAlerts: boolean, directMessages: boolean): string {
  if (gameAlerts && directMessages)
    return "Receive confirmed game activity and new direct messages with the game closed, using your account notification level.";
  if (gameAlerts) return "Receive confirmed game activity with the game closed, using your account notification level.";
  if (directMessages) return "Receive new direct messages with the game closed, using your account notification level.";
  return "Preview: server-sent tests can arrive with the game closed. Automatic game alerts still require an open page.";
}
