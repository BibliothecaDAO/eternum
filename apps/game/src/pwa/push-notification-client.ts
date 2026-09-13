import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { parseWebPushSubscription } from "@bibliothecadao/notifications";
import type { PushNotificationDevice } from "./notification-database";
import { notificationWorkerRequest } from "./local-notification-client";

const pushLock = "realms-push-registration";
export const readPushDevice = () => notificationWorkerRequest<PushNotificationDevice | null>("0x0", "push-status");

export async function enablePushNotifications(owner: string, publicKey: string): Promise<void> {
  // Permission must begin in the button gesture, before waiting for a cross-tab lock or a worker.
  const permission =
    Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
  if ((await permission) !== "granted") throw new Error("Notification permission was not granted.");
  await navigator.locks.request(pushLock, async () => {
    assertCurrentOwner(owner);
    try {
      const previous = await readPushDevice();
      if (previous?.state === "revoking") await revokePushDevice(previous.owner);
      const device = await notificationWorkerRequest<PushNotificationDevice>(owner, "prepare-push");
      const registration = await requireRegistration();
      const subscription = await resolveBrowserSubscription(registration, publicKey, previous !== null);
      assertCurrentOwner(owner);
      await identityClient.registerPushSubscription({
        owner,
        id: device.id,
        token: device.token,
        subscription: parseWebPushSubscription(subscription.toJSON()),
      });
      assertCurrentOwner(owner);
      await notificationWorkerRequest(owner, "activate-push", { id: device.id });
      assertCurrentOwner(owner);
    } catch (error) {
      // Persist local revocation first, so an offline detach cannot display an old account's push.
      try {
        await revokePushDevice(owner);
      } catch {
        throw new Error("Push setup failed. Disable background tests to finish removing this registration.");
      }
      throw error;
    }
  });
}

export async function disablePushNotifications(owner: string): Promise<void> {
  await navigator.locks.request(pushLock, () => revokePushDevice(owner));
}

async function revokePushDevice(owner: string): Promise<void> {
  const device = await notificationWorkerRequest<PushNotificationDevice | null>(owner, "revoke-push");
  if (!device) return;
  await identityClient.revokePushSubscription(device.id, device.token);
  const registration = await requireRegistration();
  await (await registration.pushManager.getSubscription())?.unsubscribe();
  await notificationWorkerRequest(owner, "forget-push", { id: device.id });
}

export async function reconcilePushAccount(): Promise<void> {
  if (!("serviceWorker" in navigator) || !navigator.locks) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.active) return;
  await navigator.locks.request(pushLock, async () => {
    let device: PushNotificationDevice | null;
    try {
      device = await readPushDevice();
    } catch (error) {
      // Older installed workers cannot answer push-status. With no native subscription there is no background delivery to revoke.
      if (!(await registration.pushManager?.getSubscription())) return;
      throw error;
    }
    const owner = useIdentitySessionStore.getState().session?.user.id ?? null;
    if (device && (device.owner !== owner || device.state === "revoking")) await revokePushDevice(device.owner);
  });
}

export async function sendBackgroundPushTest(owner: string, target: string): Promise<void> {
  assertCurrentOwner(owner);
  const device = await readPushDevice();
  if (device?.owner !== owner || device.state !== "active")
    throw new Error("Enable background tests on this device first.");
  await identityClient.sendPushTest(owner, device.id, target);
}

async function resolveBrowserSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: string,
  knownDevice: boolean,
) {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !knownDevice) {
    await subscription.unsubscribe();
    subscription = null;
  }
  return (
    subscription ??
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(publicKey) })
  );
}

async function requireRegistration() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.active) throw new Error("Apply the latest game update before enabling background tests.");
  return registration;
}
function assertCurrentOwner(owner: string) {
  if (useIdentitySessionStore.getState().session?.user.id !== owner)
    throw new Error("Your account changed. Reopen Settings.");
}
function publicKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
