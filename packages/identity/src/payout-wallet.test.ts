import { expect, it } from "vitest";
import { resolvePayoutWallet } from "./payout-wallet";

it("holds the new wallet for exactly 24 hours", () => {
  const linked = 1_700_000_000_000;
  expect(resolvePayoutWallet({ address: null, walletLinkedAt: null }, linked)).toEqual({ status: "no_wallet" });
  expect(resolvePayoutWallet({ address: "0x123", walletLinkedAt: linked }, linked + 86_399_999)).toEqual({
    status: "on_hold",
    address: "0x123",
    until: linked + 86_400_000,
  });
  expect(resolvePayoutWallet({ address: "0x123", walletLinkedAt: linked }, linked + 86_400_000)).toEqual({
    status: "ready",
    address: "0x123",
  });
});
it("fails loudly when a linked wallet lacks its timestamp", () => {
  expect(() => resolvePayoutWallet({ address: "0x123", walletLinkedAt: null }, 0)).toThrow("link time");
});
