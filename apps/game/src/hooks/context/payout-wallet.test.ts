import type { IdentityUser } from "@realms-world/identity";
import { expect, it } from "vitest";

import { payoutAddressOf } from "./payout-wallet";

/** A session user as the wire carries it. */
const user = (fields: object) => ({ id: "u", ...fields }) as unknown as IdentityUser;

it("reads the payout wallet as the wallet linked on the session, with nothing to wait for, and none when unlinked", () => {
  expect(payoutAddressOf(user({ address: "0x4a1", walletLinkedAt: Date.now() }))).toBe("0x4a1");
  expect(payoutAddressOf(user({ address: null }))).toBeNull();
  expect(payoutAddressOf(user({}))).toBeNull();
});
