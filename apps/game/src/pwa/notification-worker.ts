import {
  notificationMatchesGame,
  parseNotificationPayload,
  parsePushEnvelope,
  isPushDeviceId,
} from "@bibliothecadao/notifications";
import {
  readPushNotificationDevice,
  preparePushNotificationDevice,
  activatePushNotificationDevice,
  revokePushNotificationDevice,
  forgetPushNotificationDevice,
  claimNotification,
  disableNotificationDevice,
  enableNotificationDevice,
  readNotificationDevice,
} from "./notification-database";

/** All local OS emission goes through this one worker queue. Durable claims cover restarts and worker upgrades. */
export function installNotificationWorker(worker: ServiceWorkerGlobalScope): void {
  let queue = Promise.resolve();
  let queued = 0;
  worker.addEventListener("message", (event) => {
    if (event.data?.type !== "GAME_NOTIFICATION") return;
    if (queued >= 64) {
      event.ports[0]?.postMessage({ ok: false, error: "Notification queue is full" });
      return;
    }
    queued++;
    const work = queue
      .then(() => handleNotificationMessage(worker, event))
      .finally(() => {
        queued--;
      });
    queue = work.catch(() => {});
    event.waitUntil(work);
  });
  worker.addEventListener("push", (event) => {
    if (queued >= 64) return;
    queued++;
    const work = queue
      .then(() => receivePushNotification(worker, event))
      .catch(() => {
        console.warn("push_notification_rejected");
      })
      .finally(() => {
        queued--;
      });
    queue = work;
    event.waitUntil(work);
  });
  worker.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(openNotificationGame(worker, event.notification.data));
  });
}

async function handleNotificationMessage(
  worker: ServiceWorkerGlobalScope,
  event: ExtendableMessageEvent,
): Promise<void> {
  try {
    const source = event.source;
    if (!source || !("id" in source)) throw new Error("Notification source is not a game page");
    const client = await worker.clients.get(source.id);
    if (!client || new URL(client.url).origin !== worker.location.origin)
      throw new Error("Invalid notification source");
    const owner = event.data.owner;
    if (typeof owner !== "string" || !/^0x[\da-f]{1,64}$/.test(owner)) throw new Error("Invalid notification owner");
    const value = await runNotificationCommand(worker, client, event.data);
    event.ports[0]?.postMessage({ ok: true, value });
  } catch (error) {
    event.ports[0]?.postMessage({ ok: false, error: error instanceof Error ? error.message : "Notification failed" });
  }
}

async function runNotificationCommand(
  worker: ServiceWorkerGlobalScope,
  source: Client,
  input: { owner: string; action: string; payload?: unknown; token?: string; id?: string },
) {
  if (input.action === "push-status") return (await readPushNotificationDevice()) ?? null;
  if (input.action === "prepare-push") return preparePushNotificationDevice(input.owner);
  if (input.action === "revoke-push") {
    const revoked = await revokePushNotificationDevice(input.owner);
    for (const notification of await worker.registration.getNotifications()) {
      if (notification.data?.owner === input.owner && notification.data?.subscriptionId) notification.close();
    }
    return revoked;
  }
  if (input.action === "activate-push" || input.action === "forget-push") {
    if (!isPushDeviceId(input.id)) throw new Error("Invalid push registration");
    if (input.action === "activate-push") await activatePushNotificationDevice(input.owner, input.id);
    else await forgetPushNotificationDevice(input.owner, input.id);
    return null;
  }
  if (input.action === "status") {
    const device = await readNotificationDevice();
    return device?.owner === input.owner ? device : null;
  }
  if (input.action === "disable") {
    await disableNotificationDevice(input.owner);
    for (const notification of await worker.registration.getNotifications()) {
      if (notification.data?.owner === input.owner) notification.close();
    }
    return null;
  }
  if (input.action === "enable") {
    const device = { owner: input.owner, token: crypto.randomUUID(), enabledAt: Date.now() };
    await enableNotificationDevice(device);
    return device;
  }
  if (input.action !== "deliver" && input.action !== "test") throw new Error("Unknown notification command");
  const payload = parseNotificationPayload(input.payload, Date.now());
  if (payload.owner !== input.owner || typeof input.token !== "string") throw new Error("Notification account changed");
  // Subscription preview sends tests only; keep local game alerts until a server notifier owns them.
  if (!notificationMatchesGame(source.url, payload.target, worker.location.origin)) return "game-changed";
  if (!(await claimNotification({ ...payload, id: `${input.owner}:${payload.id}`, token: input.token }, Date.now())))
    return "suppressed";
  const clients = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (
    input.action !== "test" &&
    clients.some(
      (client) =>
        client.focused &&
        client.visibilityState === "visible" &&
        notificationMatchesGame(client.url, payload.target, worker.location.origin),
    )
  )
    return "focused";
  await worker.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.id,
    data: payload,
    icon: "/images/game-pwa-192x192.png",
    badge: "/images/game-pwa-192x192.png",
  });
  return "shown";
}

async function openNotificationGame(worker: ServiceWorkerGlobalScope, value: unknown): Promise<void> {
  try {
    const push =
      value && typeof value === "object" && "subscriptionId" in value ? parsePushEnvelope(value, Date.now()) : null;
    const payload = push?.notification ?? parseNotificationPayload(value, Date.now());
    const device = push ? await readPushNotificationDevice() : await readNotificationDevice();
    if (device?.owner !== payload.owner) return;
    if (
      push &&
      (!("state" in device && "id" in device) || device.state !== "active" || device.id !== push.subscriptionId)
    )
      return;
    const clients = await worker.clients.matchAll({ type: "window", includeUncontrolled: true });
    const matching = clients.find((client) =>
      notificationMatchesGame(client.url, payload.target, worker.location.origin),
    );
    if (matching) {
      await matching.focus();
      return;
    }
    // Opening a separate entry flow leaves an existing game's transactions and navigation untouched.
    await worker.clients.openWindow(new URL(payload.target, worker.location.origin).href);
  } catch {
    // A notification can outlive its payload or the account that enabled it. Invalid/expired clicks do nothing.
  }
}

async function receivePushNotification(worker: ServiceWorkerGlobalScope, event: PushEvent): Promise<void> {
  const text = event.data?.text();
  if (!text || text.length > 4096) throw new Error("Invalid push payload");
  const envelope = parsePushEnvelope(JSON.parse(text), Date.now());
  const device = await readPushNotificationDevice();
  if (
    !device ||
    device.id !== envelope.subscriptionId ||
    device.owner !== envelope.notification.owner ||
    device.state !== "active"
  )
    return;
  const payload = envelope.notification;
  if (
    !(await claimNotification(
      { ...payload, id: `${payload.owner}:${payload.id}`, token: device.token, subscriptionId: device.id },
      Date.now(),
    ))
  )
    return;
  await worker.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.id,
    data: { ...envelope, owner: payload.owner },
    icon: "/images/game-pwa-192x192.png",
    badge: "/images/game-pwa-192x192.png",
  });
}
