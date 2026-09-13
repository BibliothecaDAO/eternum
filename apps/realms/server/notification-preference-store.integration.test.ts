import { createNotificationTestDatabase } from "./notification-test-database";
import { notificationPreferences } from "@realms-world/db";
import { Effect } from "effect";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/db/client", () => ({ db: {} }));
import { createNotificationPreferenceStore } from "./notification-preference-store";

const databaseUrl = process.env.IDENTITY_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("notification preferences in PostgreSQL", () => {
  let testDatabase: Awaited<ReturnType<typeof createNotificationTestDatabase>>;
  let pool: Pool;
  let store: ReturnType<typeof promiseStore>;
  beforeAll(async () => {
    testDatabase = await createNotificationTestDatabase(databaseUrl!, { notificationPreferences });
    pool = testDatabase.pool;
    store = promiseStore(pool);
  });
  afterAll(async () => {
    await testDatabase?.close();
  });

  it("defaults off, serializes racing first saves, and persists across store instances", async () => {
    expect(await store.read("0x1")).toEqual({ owner: "0x1", level: "off", revision: 0 });
    const saves = await Promise.all([store.save("0x1", "important", 0), store.save("0x1", "all", 0)]);
    expect(saves.filter(Boolean)).toHaveLength(1);
    const saved = saves.find(Boolean)!;
    expect(saved.revision).toBe(1);
    expect(await promiseStore(pool).read("0x1")).toEqual(saved);
    expect(await store.save("0x1", "standard", 0)).toBeNull();
    expect(await store.read("0x2")).toEqual({ owner: "0x2", level: "off", revision: 0 });
    const updates = await Promise.all([store.save("0x1", "standard", 1), store.save("0x1", "off", 1)]);
    expect(updates.filter(Boolean)).toHaveLength(1);
    expect((await store.read("0x1")).revision).toBe(2);
  });

  it("enforces valid levels, owner existence, and account deletion", async () => {
    await pool.query("UPDATE notification_preferences SET revision = 2147483647 WHERE owner = '0x1'");
    expect((await store.read("0x1")).revision).toBe(2147483647);
    expect(await store.save("0x1", "all", 2147483647)).toBeNull();
    await expect(pool.query("INSERT INTO notification_preferences VALUES ('0x2', 'urgent', 0)")).rejects.toThrow();
    await expect(store.save("0x3", "all", 0)).rejects.toThrow();
    const failedSave = createNotificationPreferenceStore(drizzle(pool)).save("0x3", "all", 0);
    expect(
      await Effect.runPromise(
        failedSave.pipe(
          Effect.catchTag("NotificationPreferenceStorageError", (error) => Effect.succeed(error.operation)),
        ),
      ),
    ).toBe("save");
    await store.save("0x2", "all", 0);
    await pool.query(`DELETE FROM "user" WHERE id = '0x2'`);
    expect((await pool.query("SELECT * FROM notification_preferences WHERE owner = '0x2'")).rows).toEqual([]);
  });
});

function promiseStore(pool: Pool) {
  const store = createNotificationPreferenceStore(drizzle(pool));
  return {
    read: (owner: string) => Effect.runPromise(store.read(owner)),
    save: (...args: Parameters<typeof store.save>) => Effect.runPromise(store.save(...args)),
  };
}
