import { slotValueFixture, registrationIdentityFixture } from "./test-database";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain } from "./test-database";
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const slots = (chain = "0x1") =>
  new D1SlotStore(
    database.db,
    new D1LaunchStore(database.db, testChain(chain)),
    slotValueFixture(),
    registrationIdentityFixture,
  );
const soon = () => new Date(Math.floor(Date.now() / 1000) * 1000 + 60000).toISOString();
it("keeps metadata per official chain without a local registration table or roster", async () => {
  const one = slots(),
    two = slots("0x2");
  const close = soon();
  await one.create("friday", close);
  await two.create("friday", close);
  expect((await one.get("friday")).slotId).toBeGreaterThan(0);
  expect((await two.get("friday")).slotId).not.toBe((await one.get("friday")).slotId);
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
  await expect(
    store.create("late", new Date(Math.floor(Date.now() / 1000) * 1000 - 1000).toISOString()),
  ).rejects.toThrow("deadline");
  await expect(store.freeze("friday")).rejects.toThrow("still open");
});
it("uses D1 time when a worker clock is ahead, and never closes another chain's schedule", async () => {
  const store = slots();
  await store.create("open", soon());
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
  await store.freezeDueSlots();
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
  await store.freezeDueSlots();
  expect((await slots().get("closed")).frozenAt).not.toBeNull();
});
it("creates no game before close, balances 25 payers, and closes idempotently without a roster copy", async () => {
  const launches = new D1LaunchStore(database.db, testChain());
  const value = slotValueFixture(25);
  const store = new D1SlotStore(database.db, launches, value, registrationIdentityFixture);
  await store.create("balanced", soon());
  expect(await launches.list("madara.blitz")).toEqual([]);
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 1000)
    .run();
  await store.freeze("balanced");
  const first = await launches.list("madara.blitz");
  expect(first).toHaveLength(2);
  await store.freeze("balanced");
  expect(await launches.list("madara.blitz")).toEqual(first);
  expect(first.every((run) => !JSON.stringify(run.request).includes("wallet") && run.slotId === 1)).toBe(true);
});
it("continues closing later paid slots when an earlier ledger opening is unavailable", async () => {
  const store = slots();
  await store.create("first", soon());
  await store.create("second", soon());
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 1000)
    .run();
  const realFreeze = store.freeze.bind(store);
  vi.spyOn(store, "freeze").mockImplementation(async (name) => {
    if (name === "first") throw new Error("ledger slot missing");
    return realFreeze(name);
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  await store.freezeDueSlots();
  expect((await store.get("first")).frozenAt).toBeNull();
  expect((await store.get("second")).frozenAt).not.toBeNull();
  expect(log).toHaveBeenCalledWith("slot_close_unavailable", { name: "first" });
});
it("marks refunds once at close and never makes a refund decision during an identity outage", async () => {
  const value = { ...slotValueFixture(26), markRefundable: vi.fn(async () => {}) };
  const identity = { accountAtRegistration: vi.fn(async (wallet: string) => (wallet === "0x1" ? null : wallet)) };
  const launches = new D1LaunchStore(database.db, testChain());
  const store = new D1SlotStore(database.db, launches, value, identity);
  await store.create("refunds", soon());
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 1000)
    .run();
  identity.accountAtRegistration.mockRejectedValueOnce(new Error("identity down"));
  await expect(store.freeze("refunds")).rejects.toThrow("identity down");
  expect(value.markRefundable).not.toHaveBeenCalled();
  expect(await launches.list("madara.blitz")).toEqual([]);
  await store.freeze("refunds");
  await store.freeze("refunds");
  expect(value.markRefundable).toHaveBeenCalledOnce();
  expect(value.markRefundable).toHaveBeenCalledWith({ chainId: await launches.targetChain(), slotId: 1 }, ["0x1"]);
  expect(await launches.list("madara.blitz")).toHaveLength(2);
});
it("publishes the same stored shard key used to open the ledger slot", async () => {
  const value = { ...slotValueFixture(), openSlot: vi.fn(async () => {}) };
  const store = new D1SlotStore(
    database.db,
    new D1LaunchStore(database.db, testChain("0xabc")),
    value,
    registrationIdentityFixture,
  );
  await store.create("keyed", soon());
  const slot = await store.get("keyed");
  expect(slot.chainId).toBe("0xabc");
  expect(await store.list()).toEqual([slot]);
  expect(value.openSlot).toHaveBeenCalledWith({ chainId: slot.chainId, slotId: slot.slotId }, expect.any(Object));
});
