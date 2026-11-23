import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { D1SlotStore } from "./slot-store";
import { D1LaunchStore } from "./store";
import { createLaunchTestDatabase, slotValueFixture, testChain } from "./test-database";
let database: Awaited<ReturnType<typeof createLaunchTestDatabase>>;
beforeEach(async () => {
  database = await createLaunchTestDatabase();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await database.close();
});
const slots = (chain = "0x1", value = slotValueFixture()) =>
  new D1SlotStore(database.db, new D1LaunchStore(database.db, testChain(chain)), value);
const opened = (name: string, closesAt: number, chain = "0x1") =>
  database.db
    .prepare("INSERT INTO playtest_slots (name, closes_at, chain_id) VALUES (?, ?, ?)")
    .bind(name, closesAt, chain)
    .run();

it("reads each chain's opened slots apart, closed from their registration close", async () => {
  const now = Date.parse("2000-01-01T00:00:00Z");
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  await opened("friday", now + 60_000);
  await opened("friday", now + 60_000, "0x2");
  const one = slots();
  const two = slots("0x2");
  const friday = await one.get("friday");
  expect(friday).toEqual({
    chainId: "0x1",
    slotId: friday.slotId,
    name: "friday",
    closesAt: new Date(now + 60_000).toISOString(),
    closed: false,
  });
  expect((await two.get("friday")).slotId).not.toBe(friday.slotId);
  expect(await one.list()).toEqual([friday]);
  clock.mockReturnValue(now + 60_000);
  expect((await one.list())[0]!.closed).toBe(true);
  await expect(one.get("missing")).rejects.toThrow("Slot not found");
});

it("refunds an opened slot under the shard key it was stored with", async () => {
  const value = { refundSlot: vi.fn(async (): Promise<number | null> => 40) };
  await opened("friday", Date.now() + 60_000, "0xabc");
  const store = slots("0xabc", value);
  const slot = await store.get("friday");
  expect(await store.refund("friday")).toBe(40);
  expect(value.refundSlot).toHaveBeenCalledWith({ chainId: "0xabc", slotId: slot.slotId });
});
