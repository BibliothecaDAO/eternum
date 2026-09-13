// @vitest-environment node
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
let database: typeof import("./notification-database");
beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  vi.resetModules();
  database = await import("./notification-database");
});
afterEach(() => vi.unstubAllGlobals());
it("claims atomically across independent database connections and retains claims after reopening", async () => {
  await database.enableNotificationDevice({ owner: "0x1", token: "token", enabledAt: 10 });
  const input = { id: "0x1:event", owner: "0x1", token: "token", createdAt: 20, expiresAt: 200 };
  vi.resetModules();
  const other = await import("./notification-database");
  expect(
    (await Promise.all([database.claimNotification(input, 30), other.claimNotification(input, 30)])).filter(Boolean),
  ).toHaveLength(1);
  expect(await other.claimNotification(input, 40)).toBe(false);
  await other.disableNotificationDevice("0x2");
  expect(await other.readNotificationDevice()).toBeDefined();
  await other.disableNotificationDevice("0x1");
  expect(await database.claimNotification({ ...input, id: "new" }, 40)).toBe(false);
});
it("persists push revocation before remote cleanup and blocks stale activation, tokens, and accounts", async () => {
  const device = await database.preparePushNotificationDevice("0x1");
  const claim = {
    id: "0x1:push",
    owner: "0x1",
    token: device.token,
    subscriptionId: device.id,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10000,
  };
  expect(await database.claimNotification(claim, Date.now())).toBe(false);
  await database.activatePushNotificationDevice("0x1", device.id);
  expect(await database.claimNotification({ ...claim, token: "stale" }, Date.now())).toBe(false);
  expect(await database.claimNotification(claim, Date.now())).toBe(true);
  await database.revokePushNotificationDevice("0x1");
  vi.resetModules();
  const restarted = await import("./notification-database");
  expect((await restarted.readPushNotificationDevice())?.state).toBe("revoking");
  expect(await restarted.claimNotification({ ...claim, id: "later" }, Date.now())).toBe(false);
  await expect(restarted.activatePushNotificationDevice("0x1", device.id)).rejects.toThrow();
  await expect(restarted.preparePushNotificationDevice("0x2")).rejects.toThrow();
  await restarted.forgetPushNotificationDevice("0x2", device.id);
  expect(await restarted.readPushNotificationDevice()).toBeDefined();
  await restarted.forgetPushNotificationDevice("0x1", device.id);
  const next = await restarted.preparePushNotificationDevice("0x2");
  expect(next.token).not.toBe(device.token);
});
it("upgrades the installed v1 database without dropping existing device state or claims", async () => {
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("eternum-notifications-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("device");
      request.result.createObjectStore("deliveries", { keyPath: "id" }).createIndex("expiresAt", "expiresAt");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  await new Promise<void>((resolve) => {
    const tx = legacy.transaction(["device", "deliveries"], "readwrite");
    tx.objectStore("device").put({ owner: "0x1", token: "old", enabledAt: 0 }, "current");
    tx.objectStore("deliveries").put({ id: "old-id", expiresAt: 1000 });
    tx.oncomplete = () => resolve();
  });
  legacy.close();
  expect((await database.readNotificationDevice())?.token).toBe("old");
  expect(
    await database.claimNotification({ id: "old-id", owner: "0x1", token: "old", createdAt: 1, expiresAt: 1000 }, 5),
  ).toBe(false);
  expect(await database.preparePushNotificationDevice("0x1")).toBeDefined();
});
