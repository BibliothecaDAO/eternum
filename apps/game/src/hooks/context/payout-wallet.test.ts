import type { IdentityUser } from "@realms-world/identity";
import { expect, it } from "vitest";

import { payoutWalletOf } from "./payout-wallet";

/** A session user as the wire carries it: the guard reads whatever arrived. */
const user = (fields: object) => ({ id: "u", ...fields }) as unknown as IdentityUser;

it("reads the payout wallet the identity service reports, and nothing from a service that reports none", () => {
  expect(payoutWalletOf(user({}))).toBeNull();
  expect(payoutWalletOf(user({ payoutWallet: { status: "no_wallet" } }))).toEqual({ status: "no_wallet" });
  expect(payoutWalletOf(user({ payoutWallet: { status: "on_hold", address: "0x4a1", until: 5 } }))).toEqual({
    status: "on_hold",
    address: "0x4a1",
    until: 5,
  });
  expect(payoutWalletOf(user({ payoutWallet: { status: "ready", address: "0x4a1" } }))?.status).toBe("ready");
  // A hold without its end, or a wallet without an address, is not a wallet the panel can show.
  expect(payoutWalletOf(user({ payoutWallet: { status: "on_hold", address: "0x4a1" } }))).toBeNull();
  expect(payoutWalletOf(user({ payoutWallet: { status: "ready" } }))).toBeNull();
});
