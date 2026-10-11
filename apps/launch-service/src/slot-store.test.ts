import { absentLedgerSlot } from "../../../packages/value-ledger/test-support/ledger-abi";
import { decodeLedgerSlot } from "../../../packages/value-ledger/src/codecs";
import { slotValueFixture, registrationIdentityFixture } from "./test-database";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, testChain, TEST_CHAIN } from "./test-database";
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
  const identity = {
    accountsAtRegistration: vi.fn(async (page: readonly { wallet: string }[]) =>
      page.map(({ wallet }) => (wallet === "0x1" ? null : wallet)),
    ),
  };
  const launches = new D1LaunchStore(database.db, testChain());
  const store = new D1SlotStore(database.db, launches, value, identity);
  await store.create("refunds", soon());
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(Date.now() - 1000)
    .run();
  identity.accountsAtRegistration.mockRejectedValueOnce(new Error("identity down"));
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

it("deletes a failed schedule only after the ledger confirms absence", async () => {
  const value = slotValueFixture();
  vi.spyOn(value, "openSlot").mockRejectedValue(new Error("ledger rejected open"));
  const absent = decodeLedgerSlot(absentLedgerSlot());
  vi.spyOn(value, "slot").mockResolvedValue(absent);
  const store = new D1SlotStore(
    database.db,
    new D1LaunchStore(database.db, testChain()),
    value,
    registrationIdentityFixture,
  );
  await expect(store.create("failed", soon())).rejects.toThrow("ledger rejected open");
  expect(value.slot).toHaveBeenCalledTimes(1);
  expect(value.slot).toHaveBeenCalledWith({ chainId: TEST_CHAIN, slotId: expect.any(Number) });
  expect(await store.list()).toEqual([]);
  await expect(store.get("failed")).rejects.toThrow("Slot not found");
});

it.each(["exists", "unavailable"])(
  "keeps the slot key after an ambiguous open when its ledger read is %s",
  async (state) => {
    const value = slotValueFixture();
    const openError = new Error("receipt unavailable");
    const open = vi.spyOn(value, "openSlot").mockRejectedValueOnce(openError);
    const read = vi.spyOn(value, "slot");
    if (state === "unavailable") read.mockRejectedValueOnce(new Error("read unavailable"));
    const store = new D1SlotStore(
      database.db,
      new D1LaunchStore(database.db, testChain()),
      value,
      registrationIdentityFixture,
    );
    const close = soon();
    await expect(store.create("retry", close)).rejects.toBe(openError);
    const slot = await store.get("retry");
    const key = { chainId: slot.chainId, slotId: slot.slotId };
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith(key);
    await store.create("retry", close);
    expect(await store.get("retry")).toEqual(slot);
    expect(open).toHaveBeenNthCalledWith(1, key, expect.any(Object));
    expect(open).toHaveBeenNthCalledWith(2, key, expect.any(Object));
    expect(read).toHaveBeenCalledTimes(1);
  },
);

it("discovers bounded paid player slots on two shards without opening them, then keeps official ids low", async () => {
  const value = slotValueFixture(1);
  const read = vi.spyOn(value, "slot").mockImplementation(async (key) => ({
    ...(await slotValueFixture(1).slot()),
    seasonId: 0,
    exists: key!.slotId < 2147483654,
  }));
  const open = vi.spyOn(value, "openSlot");
  const launches = new D1LaunchStore(database.db, testChain("0x1"));
  const one = new D1SlotStore(database.db, launches, value, registrationIdentityFixture);
  const two = new D1SlotStore(
    database.db,
    new D1LaunchStore(database.db, testChain("0x2")),
    value,
    registrationIdentityFixture,
  );
  await one.discoverPlayerSlots();
  expect(read).toHaveBeenCalledTimes(5);
  expect(await one.list()).toHaveLength(5);
  await one.discoverPlayerSlots();
  expect(await one.list()).toHaveLength(6);
  await two.discoverPlayerSlots();
  expect((await two.get("game-2147483648")).chainId).toBe("0x2");
  expect(open).not.toHaveBeenCalled();
  await one.create("official", soon());
  expect((await one.get("official")).slotId).toBe(1);
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=? WHERE chain_id='0x1' AND slot_id=2147483648")
    .bind(Date.now() - 1000)
    .run();
  await one.freeze("game-2147483648");
  expect(await launches.find("game", "madara.blitz", "game-2147483648-1")).toMatchObject({
    slotId: 2147483648,
    request: {
      gameStartTime: new Date(Date.parse((await one.get("game-2147483648")).closesAt) + 300000).toISOString(),
      durationSeconds: 60,
    },
  });
});
it("discovery retries a failed ledger read without inserting an unpaid slot or skipping its number", async () => {
  const value = slotValueFixture();
  const absent = decodeLedgerSlot(absentLedgerSlot());
  const read = vi.spyOn(value, "slot").mockRejectedValueOnce(new Error("ledger unavailable")).mockResolvedValue(absent);
  const store = new D1SlotStore(
    database.db,
    new D1LaunchStore(database.db, testChain()),
    value,
    registrationIdentityFixture,
  );
  await expect(store.discoverPlayerSlots()).rejects.toThrow("ledger unavailable");
  expect(await store.list()).toEqual([]);
  await store.discoverPlayerSlots();
  expect(read.mock.calls.slice(-2)).toEqual([
    [{ chainId: TEST_CHAIN, slotId: 2147483648 }],
    [{ chainId: TEST_CHAIN, slotId: 2147483648 }],
  ]);
  expect(await store.list()).toEqual([]);
});

it("opens custody through preparation and starts every frozen group five minutes after close", async () => {
  const value = slotValueFixture(25);
  const open = vi.spyOn(value, "openSlot");
  const launches = new D1LaunchStore(database.db, testChain());
  const store = new D1SlotStore(database.db, launches, value, registrationIdentityFixture);
  const closesAt = soon();
  await store.create("five-minutes", closesAt);
  expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ start: Date.parse(closesAt) / 1000 }));
  const closeTime = Math.floor(Date.now() / 1000) - 1;
  await database.db
    .prepare("UPDATE playtest_slots SET closes_at=?")
    .bind(closeTime * 1000)
    .run();
  await store.freeze("five-minutes");
  const runs = await launches.list("madara.blitz");
  expect(runs).toHaveLength(2);
  for (const run of runs)
    expect(run.request).toMatchObject({
      gameStartTime: new Date((closeTime + 300) * 1000).toISOString(),
      durationSeconds: 60,
    });
});
