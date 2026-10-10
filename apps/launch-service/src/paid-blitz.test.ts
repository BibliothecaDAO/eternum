import { expect, it, vi } from "vitest";
import { closedSlotGroups } from "./paid-blitz";
import { slotValueFixture, registrationIdentityFixture } from "./test-database";
const key = { chainId: "0x1", slotId: 7 };
it.each([0, 1, 24, 25, 48, 49, 300])("balances %i registrations into games of at most 24", async (count) => {
  const value = slotValueFixture(count);
  const result = await closedSlotGroups(key, value, registrationIdentityFixture);
  const sizes = result.groups.map((group) => group.length);
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(count);
  expect(sizes.every((size) => size > 0 && size <= 24)).toBe(true);
  if (count) expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
});
it("resolves unlinked and duplicate refunds without writing on game retries", async () => {
  const value = { ...slotValueFixture(3), markRefundable: vi.fn(async () => {}) };
  const identity = { accountAtRegistration: vi.fn(async (wallet: string) => (wallet === "0x1" ? null : "0xa")) };
  const first = await closedSlotGroups(key, value, identity);
  const second = await closedSlotGroups(key, value, identity);
  expect(second).toEqual(first);
  expect(first.groups).toEqual([[{ wallet: "0x2", account: "0xa" }]]);
  expect(first.refunds).toEqual(["0x1", "0x3"]);
  expect(value.markRefundable).not.toHaveBeenCalled();
  identity.accountAtRegistration.mockRejectedValueOnce(new Error("identity down"));
  await expect(closedSlotGroups(key, value, identity)).rejects.toThrow("identity down");
  expect(value.markRefundable).not.toHaveBeenCalled();
});
it("keeps the first confirmed head across bounded relay pages", async () => {
  const all = slotValueFixture(125);
  const page = await all.registrations();
  const value = {
    ...all,
    registrations: vi.fn(async (query: { from?: number }) => ({
      ...page,
      registrations: page.registrations.slice(query.from ?? 0, (query.from ?? 0) + 100),
      next: query.from ? null : 100,
    })),
  };
  expect((await closedSlotGroups(key, value, registrationIdentityFixture)).groups.flat()).toHaveLength(125);
  expect(value.registrations).toHaveBeenLastCalledWith({ ...key, from: 100, blockNumber: 10, blockHash: "0xabc" });
});
