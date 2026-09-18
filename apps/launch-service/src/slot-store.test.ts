import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "vitest";
import { PostgresLaunchStore } from "./store";
import { PostgresSlotStore } from "./slot-store";

const databaseUrl = process.env.LAUNCH_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)("registration and frozen groups survive concurrency and service restart", async () => {
  const schema = `slot_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const database = new PostgresLaunchStore(url.toString());
  const slots = new PostgresSlotStore(database.pool);
  let restarted: Pool | undefined;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await database.initialize();
    const closesAt = new Date(Date.now() + 60_000).toISOString();
    const created = await slots.create("friday", closesAt);
    expect(await slots.create("friday", closesAt)).toEqual(created);
    await expect(slots.create("friday", new Date(Date.now() + 120_000).toISOString())).rejects.toThrow("immutable");
    await expect(slots.freeze("friday")).rejects.toThrow("still open");
    for (let index = 1; index <= 25; index++) await slots.register("friday", `0x${index.toString(16)}`);
    await Promise.all(Array.from({ length: 10 }, () => slots.register("friday", "0x01")));
    const [registered] = await slots.list();
    expect(registered.registrations).toHaveLength(25);
    expect(registered.registrations.map(({ owner }) => owner)).toEqual(
      Array.from({ length: 25 }, (_, index) => `0x${(index + 1).toString(16)}`),
    );
    expect(registered.registrations.every(({ gameNumber }) => gameNumber === null)).toBe(true);
    await database.pool.query(
      "UPDATE playtest_slots SET closes_at = clock_timestamp() - interval '1 second' WHERE name = 'friday'",
    );
    await expect(slots.register("friday", "0x26")).rejects.toThrow("closed");
    await database.pool.query(`CREATE FUNCTION interrupt_freeze() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'freeze interrupted'; END $$;
      CREATE TRIGGER interrupt_freeze BEFORE UPDATE OF frozen_at ON playtest_slots
      FOR EACH ROW EXECUTE FUNCTION interrupt_freeze()`);
    await expect(slots.freeze("friday")).rejects.toThrow("freeze interrupted");
    const [interrupted] = await slots.list();
    expect(interrupted.frozenAt).toBeNull();
    expect(interrupted.registrations.every(({ gameNumber }) => gameNumber === null)).toBe(true);
    await database.pool.query("DROP TRIGGER interrupt_freeze ON playtest_slots; DROP FUNCTION interrupt_freeze()");
    const [first, second] = await Promise.all([slots.freeze("friday"), slots.freeze("friday")]);
    expect(first).toEqual(second);
    expect(first.registrations.map(({ gameNumber }) => gameNumber)).toEqual([
      ...Array(13).fill(1),
      ...Array(12).fill(2),
    ]);
    const queued = await database.list("madara.blitz", "game");
    expect(queued).toHaveLength(2);
    expect(queued.map(({ name }) => name).sort()).toEqual(["friday-1", "friday-2"]);
    for (const run of queued) {
      expect(run.request).toMatchObject({
        version: "2",
        devModeOn: false,
        twoPlayerMode: false,
        singleRealmMode: false,
      });
      expect(run.status).toBe("queued");
      expect("rosterOwners" in run.request && run.request.rosterOwners).toEqual(
        first.registrations.filter(({ gameNumber }) => run.name === `friday-${gameNumber}`).map(({ owner }) => owner),
      );
    }
    await database.close();
    restarted = new Pool({ connectionString: url.toString() });
    const resumed = new PostgresSlotStore(restarted);
    expect(await resumed.freeze("friday")).toEqual(first);
    expect(await resumed.list()).toEqual([first]);
    const saved = await restarted.query("SELECT id FROM launch_runs ORDER BY id");
    expect(saved.rows.map(({ id }) => id)).toEqual(queued.map(({ id }) => id).sort());
    await expect(resumed.register("friday", "0x1")).rejects.toThrow("closed");
  } finally {
    if (restarted) await restarted.end();
    else await database.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

test.skipIf(!databaseUrl)("the worker freezes zero and single-player slots without inventing players", async () => {
  const schema = `slot_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const database = new PostgresLaunchStore(url.toString());
  const slots = new PostgresSlotStore(database.pool);
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await database.initialize();
    const closesAt = new Date(Date.now() + 60_000).toISOString();
    await slots.create("empty", closesAt);
    await slots.create("solo", closesAt);
    await slots.register("solo", "0x123");
    await database.pool.query("UPDATE playtest_slots SET closes_at = clock_timestamp() - interval '1 second'");
    await slots.freezeNextDue();
    await slots.freezeNextDue();
    await slots.freezeNextDue();
    const [empty, solo] = await slots.list();
    expect(empty.frozenAt).not.toBeNull();
    expect(empty.registrations).toEqual([]);
    expect(solo.frozenAt).not.toBeNull();
    expect(solo.registrations).toMatchObject([{ owner: "0x123", gameNumber: 1 }]);
  } finally {
    await database.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
