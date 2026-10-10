import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
  vi.spyOn(D1LaunchStore.prototype, "entryForSlot").mockImplementation(async function (this: D1LaunchStore) {
    return { kind: "paid", ledger: { address: "0x10", chainId: "0x2", shard: await this.targetChain(), gameId: 7 } };
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const slots = (chain = "0x1") => new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain(chain)));
const soon = () => new Date(Date.now() + 60000).toISOString();
it("keeps metadata per official chain without a local registration table or roster", async () => {
  const one = slots(),
    two = slots("0x2");
  const close = soon();
  await one.create("friday", close);
  await two.create("friday", close);
  expect((await one.get("friday")).entry).toMatchObject({ kind: "paid", ledger: { shard: "0x1" } });
  expect((await two.get("friday")).entry).toMatchObject({ kind: "paid", ledger: { shard: "0x2" } });
  expect(await one.get("friday")).not.toHaveProperty("registrations");
  expect(
    (await database.db.prepare("SELECT name FROM sqlite_master WHERE name='playtest_registrations'").all()).results,
  ).toEqual([]);
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=? WHERE chain_id='0x1'")
    .bind(Date.now() - 1000)
    .run();
  await one.freeze("friday");
  expect((await two.get("friday")).frozenAt).toBeNull();
  expect((await slots().get("friday")).frozenAt).not.toBeNull();
});
it("keeps schedule timing immutable and refuses creation after the D1 deadline", async () => {
  const store = slots();
  const close = soon();
  await store.create("friday", close);
  await store.create("friday", close);
  await expect(store.create("friday", new Date(Date.parse(close) + 60000).toISOString())).rejects.toThrow("immutable");
  await expect(store.create("late", new Date(Date.now() - 1000).toISOString())).rejects.toThrow("deadline");
  await expect(store.freeze("friday")).rejects.toThrow("still open");
});
it("uses D1 time when a worker clock is ahead, and never closes another chain's schedule", async () => {
  const store = slots();
  await store.create("open", soon());
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
  await store.freezeNextDue();
  expect((await store.get("open")).frozenAt).toBeNull();
  await expect(store.freeze("open")).rejects.toThrow("still open");
  clock.mockRestore();
});
it("preserves a closed schedule through interruption and restart", async () => {
  const store = slots();
  await store.create("closed", soon());
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 1000)
    .run();
  await database.db
    .prepare(
      "CREATE TRIGGER interrupt_freeze BEFORE UPDATE OF frozen_at ON playtest_slots BEGIN SELECT RAISE(ABORT,'freeze interrupted'); END",
    )
    .run();
  await expect(store.freeze("closed")).rejects.toThrow("freeze interrupted");
  expect((await store.get("closed")).frozenAt).toBeNull();
  await database.db.prepare("DROP TRIGGER interrupt_freeze").run();
  await store.freezeNextDue();
  expect((await slots().get("closed")).frozenAt).not.toBeNull();
});
