import { expect, it, vi } from "vitest";
import { checkSlotRoster } from "./roster-monitor";
const cohort = { chainId: "0x1", slotId: 7, complete: true, games: [{ gameId: 12, groupIndex: 0 }] };
const fixture = () => ({
  registrations: async () => [
    { wallet: "0x1", registeredAt: 90 },
    { wallet: "0x2", registeredAt: 95 },
  ],
  identity: {
    accountsAtRegistration: vi.fn(async (page: readonly { wallet: string }[]) =>
      page.map(({ wallet }) => (wallet === "0x1" ? "0xa" : "0xb")),
    ),
  },
  roster: vi.fn(async () => [
    { wallet: "0x1", account: "0xa" },
    { wallet: "0x2", account: "0xb" },
  ]),
  pause: vi.fn(async () => {}),
});
it("accepts the exact historical cohort without pausing", async () => {
  const f = fixture();
  await checkSlotRoster(cohort, f);
  expect(f.pause).not.toHaveBeenCalled();
  expect(f.identity.accountsAtRegistration).toHaveBeenCalledWith([
    { wallet: "0x1", registeredAt: 90 },
    { wallet: "0x2", registeredAt: 95 },
  ]);
});
it.each(["wrong account", "omitted payer", "extra game"])(
  "pauses before permitting a result for %s",
  async (change) => {
    const f = fixture();
    if (change === "wrong account")
      f.roster.mockResolvedValue([
        { wallet: "0x1", account: "0xbad" },
        { wallet: "0x2", account: "0xb" },
      ]);
    if (change === "omitted payer") f.roster.mockResolvedValue([{ wallet: "0x1", account: "0xa" }]);
    const target =
      change === "extra game" ? { ...cohort, games: [...cohort.games, { gameId: 13, groupIndex: 1 }] } : cohort;
    await expect(checkSlotRoster(target, f)).rejects.toThrow("slot_roster_mismatch");
    expect(f.pause).toHaveBeenCalledOnce();
  },
);
it("never verifies a partial cohort or an unavailable identity history", async () => {
  const f = fixture();
  await expect(checkSlotRoster({ ...cohort, complete: false }, f)).rejects.toThrow("unverified");
  f.identity.accountsAtRegistration.mockRejectedValue(new Error("history unavailable"));
  await expect(checkSlotRoster(cohort, f)).rejects.toThrow("history unavailable");
  expect(f.pause).not.toHaveBeenCalled();
});
