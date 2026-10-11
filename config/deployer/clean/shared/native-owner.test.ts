import { expect, test } from "bun:test";
import { assertNativeOwnerSigner } from "./native-owner";
import type { Account } from "starknet";

test("owner writes refuse a handed-off role or revoked device before signing", async () => {
  for (const [owner, active, allowed] of [
    ["0x12", "0x1", true],
    ["0x34", "0x1", false],
    ["0x12", "0x0", false],
  ] as const) {
    const calls: string[] = [];
    const account = {
      address: "0x12",
      signer: { getPubKey: async () => "0x56" },
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        calls.push(entrypoint);
        return [entrypoint === "owner" ? owner : active];
      },
    } as unknown as Account;
    if (allowed) await expect(assertNativeOwnerSigner(account, "0x78")).resolves.toBeUndefined();
    else await expect(assertNativeOwnerSigner(account, "0x78")).rejects.toThrow();
    expect(calls).toEqual(owner === "0x12" ? ["owner", "is_device"] : ["owner"]);
  }
});
