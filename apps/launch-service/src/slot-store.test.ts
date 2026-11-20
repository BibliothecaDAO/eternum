import { absentLedgerSlot } from "../../../packages/value-ledger/test-support/ledger-abi";
import { decodeLedgerSlot } from "../../../packages/value-ledger/src/codecs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, slotValueFixture, testChain, TEST_CHAIN } from "./test-database";
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const slots = (chain = "0x1") =>
  new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain(chain)), slotValueFixture());
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
});
it("keeps schedule timing immutable and refuses creation after the deadline", async () => {
  const store = slots();
  const close = soon();
  await store.create("friday", close);
  await store.create("friday", close);
  await expect(store.create("friday", new Date(Date.parse(close) + 60000).toISOString())).rejects.toThrow("immutable");
  await expect(
    store.create("late", new Date(Math.floor(Date.now() / 1000) * 1000 - 1000).toISOString()),
  ).rejects.toThrow("deadline");
});
it("uses one clock for creation and closure", async () => {
  const now = Date.parse("2000-01-01T00:00:00Z");
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  const one = slots();
  const close = new Date(now + 60000).toISOString();
  await one.create("open", close);
  expect((await one.get("open")).closed).toBe(false);
  clock.mockReturnValue(now + 60000);
  await expect(one.create("late", close)).rejects.toThrow("deadline");
  expect((await one.list())[0]!.closed).toBe(true);
});

it("publishes the same stored shard key used to open the ledger slot", async () => {
  const value = { ...slotValueFixture(), openSlot: vi.fn(async () => {}) };
  const store = new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain("0xabc")), value);
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
  const store = new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain()), value);
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
    const store = new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain()), value);
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

it("opens the ledger slot's custody window at its registration close", async () => {
  const value = slotValueFixture();
  const open = vi.spyOn(value, "openSlot");
  const store = new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain()), value);
  const closesAt = soon();
  await store.create("five-minutes", closesAt);
  expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ start: Date.parse(closesAt) / 1000 }));
});

it("never reuses an official slot number after a failed open is confirmed absent", async () => {
  const value = slotValueFixture();
  const open = vi.spyOn(value, "openSlot").mockRejectedValueOnce(new Error("open refused"));
  vi.spyOn(value, "slot").mockResolvedValueOnce(decodeLedgerSlot(absentLedgerSlot()));
  const store = new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain()), value);
  await expect(store.create("failed", soon())).rejects.toThrow("open refused");
  await store.create("next", soon());
  const first = (open.mock.calls as unknown as [{ slotId: number }][])[0]![0].slotId;
  expect((await store.get("next")).slotId).toBeGreaterThan(first);
});
