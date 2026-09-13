export interface NotificationDevice {
  owner: string;
  token: string;
  enabledAt: number;
}

let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("eternum-notifications-v1", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("device");
      const deliveries = request.result.createObjectStore("deliveries", { keyPath: "id" });
      deliveries.createIndex("expiresAt", "expiresAt");
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
  const tx = (await openDatabase()).transaction(["device", "deliveries"], mode);
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
  input: { id: string; owner: string; token: string; createdAt: number; expiresAt: number },
  now: number,
): Promise<boolean> =>
  transaction("readwrite", async (tx) => {
    const device: NotificationDevice | undefined = await result(tx.objectStore("device").get("current"));
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
