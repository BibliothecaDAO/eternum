import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@realms-world/db/client", () => ({ db: {} }));
import { createNotificationPreferenceStore } from "./notification-preference-store";

const databaseUrl = process.env.IDENTITY_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("notification preferences in PostgreSQL", () => {
  let admin: Pool;
  let pool: Pool;
  let schema: string;
  let store: ReturnType<typeof createNotificationPreferenceStore>;
  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl });
    schema = `preferences_test_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(databaseUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.toString() });
    await pool.query('CREATE TABLE "user" (id text PRIMARY KEY)');
    await pool.query(`INSERT INTO "user" VALUES ('0x1'), ('0x2')`);
    const migration = readFileSync(new URL("./migrations/001-notification-preferences.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    try {
      await client.query(migration);
      await client.query(migration);
    } finally {
      client.release();
    }
    store = createNotificationPreferenceStore(drizzle(pool));
  });
  afterAll(async () => {
    await pool?.end();
    if (schema) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin?.end();
  });

  it("defaults off, serializes racing first saves, and persists across store instances", async () => {
    expect(await store.read("0x1")).toEqual({ owner: "0x1", level: "off", revision: 0 });
    const saves = await Promise.all([store.save("0x1", "important", 0), store.save("0x1", "all", 0)]);
    expect(saves.filter(Boolean)).toHaveLength(1);
    const saved = saves.find(Boolean)!;
    expect(saved.revision).toBe(1);
    expect(await createNotificationPreferenceStore(drizzle(pool)).read("0x1")).toEqual(saved);
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
    await store.save("0x2", "all", 0);
    await pool.query(`DELETE FROM "user" WHERE id = '0x2'`);
    expect((await pool.query("SELECT * FROM notification_preferences WHERE owner = '0x2'")).rows).toEqual([]);
  });
});
