export interface NotificationDevice {
  owner: string;
  token: string;
  enabledAt: number;
}

export interface PushNotificationDevice extends NotificationDevice {
  id: string;
  state: "preparing" | "active" | "revoking";
}

let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("eternum-notifications-v1", 2);
    request.onupgradeneeded = (event) => {
      if (event.oldVersion < 1) {
        request.result.createObjectStore("device");
        const deliveries = request.result.createObjectStore("deliveries", { keyPath: "id" });
        deliveries.createIndex("expiresAt", "expiresAt");
      }
      if (event.oldVersion < 2) request.result.createObjectStore("push");
    };
    request.onerror = () => {
      database = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      database = undefined;
      reject(new Error("Notification storage is blocked"));
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  }));
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const tx = (await openDatabase()).transaction(["device", "deliveries", "push"], mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Notification storage transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
  // Install a handler immediately: an abort may happen before work has finished awaiting its request.
  void done.catch(() => {});
  try {
    const value = await work(tx);
    await done;
    return value;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* Already completed or aborted. */
    }
    throw error;
  }
}

export const readNotificationDevice = (): Promise<NotificationDevice | undefined> =>
  transaction("readonly", (tx) => result(tx.objectStore("device").get("current")));

export const enableNotificationDevice = (device: NotificationDevice): Promise<void> =>
  transaction("readwrite", async (tx) => {
    await result(tx.objectStore("device").put(device, "current"));
  });

export const disableNotificationDevice = (owner: string): Promise<void> =>
  transaction("readwrite", async (tx) => {
    const store = tx.objectStore("device");
    const current: NotificationDevice | undefined = await result(store.get("current"));
    if (current?.owner === owner) await result(store.delete("current"));
  });

/** Claims and device checks commit atomically across tabs and overlapping worker versions. */
export const claimNotification = (
  input: { id: string; owner: string; token: string; createdAt: number; expiresAt: number; subscriptionId?: string },
  now: number,
): Promise<boolean> =>
  transaction("readwrite", async (tx) => {
    const device = input.subscriptionId
      ? await result<PushNotificationDevice | undefined>(tx.objectStore("push").get("current"))
      : await result<NotificationDevice | undefined>(tx.objectStore("device").get("current"));
    if (
      input.subscriptionId &&
      (!(device && "state" in device && "id" in device) ||
        device.state !== "active" ||
        device.id !== input.subscriptionId)
    )
      return false;
    if (
      !device ||
      device.owner !== input.owner ||
      device.token !== input.token ||
      input.createdAt < device.enabledAt ||
      input.expiresAt <= now
    )
      return false;
    const deliveries = tx.objectStore("deliveries");
    await pruneExpired(deliveries, now);
    if (await result(deliveries.get(input.id))) return false;
    // Never evict unexpired IDs to make space: doing so would allow a previously dismissed alert to reappear.
    if ((await result(deliveries.count())) >= 4096)
      throw new Error("Notification storage is full; wait for alerts to expire");
    await result(deliveries.add({ id: input.id, expiresAt: input.expiresAt }));
    return true;
  });

function pruneExpired(store: IDBObjectStore, now: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cursor = store.index("expiresAt").openCursor(IDBKeyRange.upperBound(now));
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      if (!cursor.result) return resolve();
      cursor.result.delete();
      cursor.result.continue();
    };
  });
}

export const readPushNotificationDevice = (): Promise<PushNotificationDevice | undefined> =>
  transaction("readonly", (tx) => result(tx.objectStore("push").get("current")));

export const preparePushNotificationDevice = (owner: string): Promise<PushNotificationDevice> =>
  transaction("readwrite", async (tx) => {
    const store = tx.objectStore("push");
    const existing: PushNotificationDevice | undefined = await result(store.get("current"));
    if (existing) {
      if (existing.owner !== owner || existing.state === "revoking")
        throw new Error("Disable the previous push registration before enabling another account.");
      return existing;
    }
    const device: PushNotificationDevice = {
      owner,
      id: crypto.randomUUID(),
      token: crypto.randomUUID(),
      enabledAt: Date.now(),
      state: "preparing",
    };
    await result(store.put(device, "current"));
    return device;
  });

export const activatePushNotificationDevice = (owner: string, id: string): Promise<void> =>
  transaction("readwrite", async (tx) => {
    const store = tx.objectStore("push");
    const device: PushNotificationDevice | undefined = await result(store.get("current"));
    if (!device || device.owner !== owner || device.id !== id || device.state === "revoking")
      throw new Error("Push registration changed.");
    await result(store.put({ ...device, state: "active" }, "current"));
  });

export const revokePushNotificationDevice = (owner: string): Promise<PushNotificationDevice | null> =>
  transaction("readwrite", async (tx) => {
    const store = tx.objectStore("push");
    const device: PushNotificationDevice | undefined = await result(store.get("current"));
    if (!device || device.owner !== owner) return null;
    const revoked = { ...device, state: "revoking" as const };
    await result(store.put(revoked, "current"));
    return revoked;
  });

export const forgetPushNotificationDevice = (owner: string, id: string): Promise<void> =>
  transaction("readwrite", async (tx) => {
    const store = tx.objectStore("push");
    const device: PushNotificationDevice | undefined = await result(store.get("current"));
    if (device?.owner === owner && device.id === id && device.state === "revoking")
      await result(store.delete("current"));
  });
