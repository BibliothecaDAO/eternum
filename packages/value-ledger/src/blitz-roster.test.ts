import { expect, it, vi } from "vitest";
import { resolveBlitzRoster } from "./blitz-roster";
import type { SlotRegistration } from "./blitz-slots";

const registrations = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    wallet: `0x${(i + 1).toString(16)}`,
    registeredAt: 100 + i,
  }));
it("resolves 2,000 registrations in 20 identity calls, preserving registration order", async () => {
  const rows = registrations(2000);
  const accountsAtRegistration = vi.fn(async (page: readonly SlotRegistration[]) => page.map(({ wallet }) => wallet));
  expect(await resolveBlitzRoster(rows, { accountsAtRegistration })).toEqual({
    players: rows.map(({ wallet }) => ({ wallet, account: wallet })),
    refunds: [],
  });
  expect(accountsAtRegistration).toHaveBeenCalledTimes(20);
  for (let i = 0; i < 20; i++)
    expect(accountsAtRegistration).toHaveBeenNthCalledWith(i + 1, rows.slice(i * 100, (i + 1) * 100));
});
it("deduplicates accounts across pages and refuses failed or incomplete identity pages", async () => {
  const rows = registrations(101);
  const accountsAtRegistration = vi.fn(async (page: readonly SlotRegistration[]) =>
    page.map(({ wallet }) => (wallet === rows[100]!.wallet ? rows[0]!.wallet : wallet)),
  );
  expect((await resolveBlitzRoster(rows, { accountsAtRegistration })).refunds).toEqual([rows[100]!.wallet]);
  accountsAtRegistration
    .mockImplementationOnce(async () => rows.slice(0, 100).map(({ wallet }) => wallet))
    .mockRejectedValueOnce(new Error("identity unavailable"));
  await expect(resolveBlitzRoster(rows, { accountsAtRegistration })).rejects.toThrow("identity unavailable");
  accountsAtRegistration.mockResolvedValueOnce([]);
  await expect(resolveBlitzRoster(rows, { accountsAtRegistration })).rejects.toThrow(
    "registration_identity_page_incomplete",
  );
});
