import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import {
  automaticPushSourceKey,
  parseWebPushSubscription,
  type AutomaticPushSource,
} from "@bibliothecadao/notifications";
import type { PushNotificationDevice } from "./notification-database";
import { notificationWorkerRequest } from "./local-notification-client";

const pushLock = "realms-push-registration";
export const readPushDevice = () => notificationWorkerRequest<PushNotificationDevice | null>("0x0", "push-status");

export async function enablePushNotifications(
  owner: string,
  publicKey: string,
  automatic: AutomaticPushSource | null = null,
  directMessages = false,
): Promise<void> {
  // Permission must begin in the button gesture, before waiting for a cross-tab lock or a worker.
  const permission =
    Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission();
  if ((await permission) !== "granted") throw new Error("Notification permission was not granted.");
  await navigator.locks.request(pushLock, async () => {
    assertCurrentOwner(owner);
    if (automatic || directMessages) {
      const capabilities = await notificationWorkerRequest<{
        automaticGameAlerts: boolean;
        directMessageAlerts: boolean;
        gameForegroundLease: boolean;
      }>(owner, "push-capabilities").catch(() => {
        throw new Error("Apply the latest game update before enabling background alerts.");
      });
      if (
        !capabilities.gameForegroundLease ||
        (automatic && !capabilities.automaticGameAlerts) ||
        (directMessages && !capabilities.directMessageAlerts)
      )
        throw new Error("Apply the latest game update before enabling background alerts.");
    }
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
      window.dispatchEvent(new Event("pushRegistrationChanged"));
      assertCurrentOwner(owner);
      if (automatic) {
        await notificationWorkerRequest(owner, "prepare-automatic", { id: device.id, source: automatic });
        await completeAutomaticSetup(
          { ...device, state: "active", automatic: { ...automatic, acknowledged: false } },
          registration,
        );
      }
      assertCurrentOwner(owner);
    } catch (error) {
      // Persist local revocation first, so an offline detach cannot display an old account's push.
      try {
        await revokePushDevice(owner);
      } catch {
        throw new Error("Push setup failed. Disable background notifications to finish removing this registration.");
      }
      throw error;
    }
  });
}

export async function disablePushNotifications(owner: string): Promise<void> {
  // Revocation cannot wait behind setup's network requests: the worker must stop accepting pushes immediately.
  const device = await revokeLocalPushDevice(owner);
  if (device) await navigator.locks.request(pushLock, () => removeRevokedPushDevice(device));
}

const revokeLocalPushDevice = (owner: string, id?: string) =>
  notificationWorkerRequest<PushNotificationDevice | null>(owner, "revoke-push", { id });

async function revokePushDevice(owner: string): Promise<void> {
  const device = await revokeLocalPushDevice(owner);
  if (device) await removeRevokedPushDevice(device);
}

/** Called under the registration lock; a delayed cleanup must never unsubscribe a replacement device. */
async function removeRevokedPushDevice(device: PushNotificationDevice): Promise<void> {
  await identityClient.revokePushSubscription(device.id, device.token);
  const current = await readPushDevice();
  if (current?.id !== device.id || current.state !== "revoking") return;
  const registration = await requireRegistration();
  await (await registration.pushManager.getSubscription())?.unsubscribe();
  await notificationWorkerRequest(device.owner, "forget-push", { id: device.id });
}

export async function reconcilePushAccount(): Promise<void> {
  if (!("serviceWorker" in navigator) || !navigator.locks) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration?.active) return;
  const device = await readInstalledPushDevice(registration);
  if (!device) return;
  if (requiresPushRevocation(device)) {
    const revoked = await revokeLocalPushDevice(device.owner, device.id);
    if (revoked) await navigator.locks.request(pushLock, () => removeRevokedPushDevice(revoked));
    return;
  }
  await navigator.locks.request(pushLock, async () => {
    // Another tab can replace or revoke the device while this reconciliation waits for setup to finish.
    const current = await readPushDevice();
    if (!current) return;
    if (requiresPushRevocation(current)) await revokePushDevice(current.owner);
    else if (current.automatic && !current.automatic.acknowledged) {
      await completeAutomaticSetup(current, registration);
      await syncPushGameForeground(current.owner);
    }
  });
}

function requiresPushRevocation(device: PushNotificationDevice): boolean {
  const owner = useIdentitySessionStore.getState().session?.user.id ?? null;
  return device.owner !== owner || device.state === "revoking";
}

async function readInstalledPushDevice(
  registration: ServiceWorkerRegistration,
): Promise<PushNotificationDevice | null> {
  try {
    return await readPushDevice();
  } catch (error) {
    // Older installed workers cannot answer push-status. Without a native subscription there is nothing to revoke.
    if (!(await registration.pushManager?.getSubscription())) return null;
    throw error;
  }
}

export async function sendBackgroundPushTest(owner: string, target: string): Promise<void> {
  assertCurrentOwner(owner);
  const device = await readPushDevice();
  if (device?.owner !== owner || device.state !== "active")
    throw new Error("Enable background notifications on this device first.");
  await identityClient.sendPushTest(owner, device.id, target);
}

/** Refreshes the server lease that prevents automatic push while any game window is visible. */
export async function syncPushGameForeground(owner: string): Promise<void> {
  assertCurrentOwner(owner);
  const device = await readPushDevice();
  if (device?.owner !== owner || device.state !== "active") return;
  const foreground = await notificationWorkerRequest<boolean>(owner, "game-foreground-status");
  assertCurrentOwner(owner);
  await identityClient.setPushGameForeground(owner, device.id, foreground);
}

async function completeAutomaticSetup(
  device: PushNotificationDevice,
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (!device.automatic) return;
  assertCurrentOwner(device.owner);
  const status = await identityClient.getPushSubscriptionStatus(device.owner, device.id);
  if (!status.registered) {
    await revokePushDevice(device.owner);
    throw new Error("This push registration expired. Enable background notifications again.");
  }
  if (!status.automatic || automaticPushSourceKey(status.automatic) !== automaticPushSourceKey(device.automatic)) {
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription)
      throw new Error("This device needs to be registered again. Disable background notifications, then enable them.");
    assertCurrentOwner(device.owner);
    await identityClient.registerPushSubscription({
      owner: device.owner,
      id: device.id,
      token: device.token,
      subscription: parseWebPushSubscription(subscription.toJSON()),
      gameAlerts: true,
      source: device.automatic,
    });
  }
  assertCurrentOwner(device.owner);
  await notificationWorkerRequest(device.owner, "acknowledge-automatic", { id: device.id, source: device.automatic });
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
  if (!registration?.active) throw new Error("Apply the latest game update before enabling background notifications.");
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
