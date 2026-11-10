import { identityClient, notificationOwnerOf, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { pageNavigation } from "@/utils/page-navigation";
import {
  isChatClient,
  notificationMatchesGame,
  parsePushEnvelope,
  type PushConfiguration,
} from "@bibliothecadao/notifications";

import { CHAT_ALERT_PRESSED, type ChatAlertPress } from "./chat-alert";
import { pressAppChatAlert } from "./chat-alert-press";

/**
 * Push in the iOS app (apps/ios). Its web view has no service worker and no Web Push, so the app's push plugin
 * (@capacitor/push-notifications) asks the player, hands back the device's APNs token and reports a tapped alert. This
 * device registers that token with the identity service as a browser registers its subscription (`apnsToken`,
 * packages/notifications push.ts), under an id and a revocation token kept in this page's storage, and a tapped alert
 * opens what it names as the service worker opens it.
 *
 * - The device belongs to one account: signing out or switching accounts revokes it, and so does turning the app's
 *   alerts off in iOS Settings, at the next launch or sign-in.
 * - APNs may give the app a new token (a restored or reset phone): the device is then registered again under it.
 * - While the app is in front iOS shows no alert: the game's own pages show what is happening.
 */

/** What Capacitor's bridge puts on every page the iOS app loads (its native-bridge.js); the page bundles no Capacitor. */
export interface CapacitorBridge {
  isNativePlatform(): boolean;
  nativePromise<T>(plugin: string, method: string, options?: object): Promise<T>;
  addListener<T>(plugin: string, event: string, callback: (data: T) => void): { remove(): Promise<void> };
}

const PLUGIN = "PushNotifications";
type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";

/** The bridge, when this page runs in the iOS app; null on the web and in the Android app. */
export const iosAppBridge = (): CapacitorBridge | null => {
  const bridge = (window as { Capacitor?: Partial<CapacitorBridge> }).Capacitor;
  return bridge?.isNativePlatform?.() && bridge.nativePromise && bridge.addListener
    ? (bridge as CapacitorBridge)
    : null;
};

/** This phone's registration as the identity service holds it, with the alerts the player consented to. */
export interface IosAppPushDevice {
  owner: string;
  id: string;
  token: string;
  apnsToken: string;
  gameAlerts: boolean;
  directMessages: boolean;
}

const DEVICE_KEY = "realms:ios-app-push";

export const readIosAppPushDevice = (): IosAppPushDevice | null => {
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    return stored ? (JSON.parse(stored) as IosAppPushDevice) : null;
  } catch {
    return null;
  }
};

const writeDevice = (device: IosAppPushDevice | null) => {
  if (device) localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  else localStorage.removeItem(DEVICE_KEY);
};

/** Settings' switch here: on while this account's registration stands, blocked once the player refused alerts. */
export const iosAppPushState = async (bridge: CapacitorBridge, owner: string): Promise<"on" | "off" | "blocked"> => {
  const permission = await permissionOf(bridge, "checkPermissions");
  if (permission === "denied") return "blocked";
  return permission === "granted" && readIosAppPushDevice()?.owner === owner ? "on" : "off";
};

/** Asks the player (iOS asks once; later it answers as they chose), then registers this phone for the account. */
export async function enableIosAppPush(
  bridge: CapacitorBridge,
  owner: string,
  configuration: PushConfiguration | null,
): Promise<void> {
  if (!configuration?.enabled) throw new Error("push_unavailable");
  if ((await permissionOf(bridge, "requestPermissions")) !== "granted") throw new Error("permission_refused");
  const apnsToken = await apnsTokenOf(bridge);
  const { gameAlerts, directMessages } = configuration;
  const device = await registerDevice({ owner, apnsToken, gameAlerts, directMessages });
  // The first push proves alerts arrive; they stay on if it cannot be sent.
  if (gameAlerts) await identityClient.sendAlertsOn(owner, device.id).catch(() => undefined);
}

/** Revokes this phone's registration: the identity service sends it nothing more. */
export async function disableIosAppPush(): Promise<void> {
  const device = readIosAppPushDevice();
  if (!device) return;
  await identityClient.revokePushSubscription(device.id, device.token);
  writeDevice(null);
}

/**
 * At launch and at each sign-in, sign-out or account switch: a registration that is not the signed-in account's, or
 * whose alerts the player turned off in iOS Settings, is revoked; one whose APNs token changed is registered again.
 */
export async function reconcileIosAppPush(bridge: CapacitorBridge, owner: string | null): Promise<void> {
  const device = readIosAppPushDevice();
  if (!device) return;
  if (device.owner !== owner || (await permissionOf(bridge, "checkPermissions")) !== "granted")
    return disableIosAppPush();
  const apnsToken = await apnsTokenOf(bridge);
  if (apnsToken !== device.apnsToken) await registerDevice({ ...device, apnsToken });
}

/** Opens each alert the player taps, from now on; one tapped before the page could hear it (a cold start) comes first. */
export const listenForIosAppPushTaps = (bridge: CapacitorBridge) =>
  bridge.addListener<{ notification: { data: unknown } }>(
    PLUGIN,
    "pushNotificationActionPerformed",
    ({ notification }) => openTappedAlert(notification.data),
  );

/**
 * What a tapped alert opens on this page: chat on what it is about, the page it names, or nothing (an alert of another
 * account or an earlier registration, an expired one, or a game this page already shows). The rules are the service
 * worker's (notification-worker.ts), for the app's one window.
 */
export const tappedAlertOpening = (
  data: unknown,
  device: IosAppPushDevice | null,
  owner: string | null,
  here: string,
  now: number,
): { chat: ChatAlertPress } | { page: string } | null => {
  const envelope = parseEnvelope(data, now);
  if (!envelope || !device || device.owner !== owner) return null;
  const { notification } = envelope;
  if (notification.owner !== device.owner || envelope.subscriptionId !== device.id) return null;
  const origin = new URL(here).origin;
  if (envelope.kind === "direct-message" || envelope.kind === "mention") {
    if (!isChatClient(here, notification.target, origin)) return { page: notification.target };
    const press: ChatAlertPress = { type: CHAT_ALERT_PRESSED, kind: envelope.kind, target: notification.target };
    return { chat: notification.tag ? { ...press, tag: notification.tag } : press };
  }
  return notificationMatchesGame(here, notification.target, origin) ? null : { page: notification.target };
};

const openTappedAlert = (data: unknown) => {
  const owner = notificationOwnerOf(useIdentitySessionStore.getState().session) ?? null;
  const opening = tappedAlertOpening(data, readIosAppPushDevice(), owner, location.href, Date.now());
  if (!opening) return;
  if ("chat" in opening) pressAppChatAlert(opening.chat);
  else pageNavigation.open(new URL(opening.page, location.origin).href);
};

/** The envelope the identity service sent beside the alert (apps/realms/server/apns-push.ts), or null. */
const parseEnvelope = (data: unknown, now: number) => {
  try {
    return parsePushEnvelope((data as { envelope?: unknown } | null)?.envelope, now);
  } catch {
    return null;
  }
};

const permissionOf = async (bridge: CapacitorBridge, method: "checkPermissions" | "requestPermissions") =>
  (await bridge.nativePromise<{ receive: Permission }>(PLUGIN, method)).receive;

/** APNs answers a registration in seconds; without a network it never does, and the switch says it failed. */
const REGISTRATION_TIMEOUT_MS = 30_000;

/** Registers with APNs and waits for the device token, in the lowercase hex the identity service reads. */
const apnsTokenOf = (bridge: CapacitorBridge) =>
  new Promise<string>((resolve, reject) => {
    const settle = (finish: () => void) => {
      window.clearTimeout(timeout);
      void registered.remove();
      void failed.remove();
      finish();
    };
    const timeout = window.setTimeout(() => settle(() => reject(new Error("apns_timeout"))), REGISTRATION_TIMEOUT_MS);
    const registered = bridge.addListener<{ value: string }>(PLUGIN, "registration", ({ value }) =>
      settle(() => resolve(value.toLowerCase())),
    );
    const failed = bridge.addListener<{ error: string }>(PLUGIN, "registrationError", ({ error }) =>
      settle(() => reject(new Error(error))),
    );
    bridge.nativePromise(PLUGIN, "register").catch((error: unknown) => settle(() => reject(error)));
  });

/**
 * Registers this phone for the account under a new id and revocation token, after revoking the registration it held
 * (another account's, or an old token's: APNs tokens are unique). The device is kept before it is sent, so a
 * registration that fails or is cut off can still be revoked.
 */
const registerDevice = async (registration: Omit<IosAppPushDevice, "id" | "token">) => {
  await disableIosAppPush();
  assertCurrentOwner(registration.owner);
  const device: IosAppPushDevice = { ...registration, id: crypto.randomUUID(), token: crypto.randomUUID() };
  writeDevice(device);
  const { owner, id, token, apnsToken, gameAlerts, directMessages } = device;
  try {
    await identityClient.registerPushSubscription({ owner, id, token, apnsToken, gameAlerts, directMessages });
  } catch (error) {
    await disableIosAppPush().catch(() => undefined);
    throw error;
  }
  return device;
};

const assertCurrentOwner = (owner: string) => {
  if (notificationOwnerOf(useIdentitySessionStore.getState().session) !== owner)
    throw new Error("Your account changed. Reopen Settings.");
};
