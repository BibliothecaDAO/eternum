import { automaticPushSourceKey } from "@bibliothecadao/notifications";
import { useEffect, useRef, useState } from "react";
import { identityClient } from "@/hooks/context/identity-session";
import { getActiveGame } from "@/runtime/world";
import { buildEntryHref } from "@/play/navigation/play-route";
import { localNotificationCapability } from "@/pwa/local-notification-client";
import {
  disablePushNotifications,
  enablePushNotifications,
  readPushDevice,
  sendBackgroundPushTest,
} from "@/pwa/push-notification-client";
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
  const [feedback, setFeedback] = useState<string | null>(null);
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

  const run = async (action: "enable" | "disable" | "test") => {
    if (!owner || actionPending.current) return;
    actionPending.current = true;
    refreshVersion.current++;
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      if (action === "enable") {
        if (!config?.enabled) throw new Error("Background tests are unavailable.");
        await enablePushNotifications(
          owner,
          config.publicKey,
          config.automatic ?? null,
          config.directMessages === true,
        );
        setDirectMessagesEnabled(config.directMessages === true);
      } else if (action === "disable") {
        await disablePushNotifications(device?.owner ?? owner);
        setDirectMessagesEnabled(false);
      } else {
        const world = getActiveGame();
        if (!world) throw new Error("Enter a game before sending a test.");
        await sendBackgroundPushTest(
          owner,
          buildEntryHref({ chainId: world.chainId, gameId: world.gameId, intent: "play", autoSettle: false }),
        );
        setFeedback("Test accepted by the push service. Your browser and OS control when it appears.");
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
  const automatic = config?.enabled ? config.automatic : null;
  const directMessages = config?.enabled === true && config.directMessages === true;
  const backgroundAlerts = Boolean(automatic || directMessages);
  const needsGameAlerts = Boolean(
    automatic &&
    (!device?.automatic?.acknowledged ||
      automaticPushSourceKey(device.automatic) !== automaticPushSourceKey(automatic)),
  );
  const needsDirectMessages = directMessages && !directMessagesEnabled;
  return (
    <section aria-label="Background notifications" className="space-y-2">
      <p className={HUD_BODY}>
        Background notifications:{" "}
        {device?.state === "active" && device.owner === owner ? "Enabled" : device ? "Cleanup required" : "Off"}.
      </p>
      <p className={HUD_BODY}>{backgroundNotificationDescription(Boolean(automatic), directMessages)}</p>
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
          {device?.state === "active" && device.owner === owner && (
            <button
              type="button"
              className={HUD_PILL_BUTTON}
              disabled={busy || !!capability || !config?.enabled}
              onClick={() => {
                void run("test");
              }}
            >
              Send background test
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
