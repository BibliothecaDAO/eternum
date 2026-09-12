import type { AccountInterface, ProviderInterface } from "starknet";
import { describe, expect, it, vi } from "vitest";

import { bindGameplayAccounts } from "./bind-gameplay-accounts";

const REGISTRY = "0x1234";
const GUEST = { owner: "0x0a", address: "0x0a" };
const OWNED = { owner: "0x0b", address: "0x0bb" };

describe("bindGameplayAccounts", () => {
  it("binds only the accounts the registry does not hold yet, in one batch", async () => {
    const provider = fakeRegistry({ [GUEST.owner]: GUEST.address });
    const authority = fakeAuthority();

    const result = await bindGameplayAccounts({
      accounts: [GUEST, OWNED],
      authority,
      chain: "madara",
      playerRegistryAddress: REGISTRY,
      provider,
    });

    expect(result).toEqual({ alreadyBound: 1, bindingTransactionHashes: ["0xtx1"] });
    expect(authority.execute).toHaveBeenCalledTimes(1);
    const [calls] = vi.mocked(authority.execute).mock.calls[0]!;
    expect(calls).toEqual([
      {
        contractAddress: REGISTRY,
        entrypoint: "bind",
        calldata: [BigInt(OWNED.owner).toString(), BigInt(OWNED.address).toString()],
      },
    ]);
  });

  it("submits nothing when every account is already bound", async () => {
    const provider = fakeRegistry({ [GUEST.owner]: GUEST.address, [OWNED.owner]: OWNED.address });
    const authority = fakeAuthority();

    const result = await bindGameplayAccounts({
      accounts: [GUEST, OWNED],
      authority,
      chain: "madara",
      playerRegistryAddress: REGISTRY,
      provider,
    });

    expect(result).toEqual({ alreadyBound: 2, bindingTransactionHashes: [] });
    expect(authority.execute).not.toHaveBeenCalled();
  });

  it("refuses to overwrite an owner bound to a different account", async () => {
    const provider = fakeRegistry({ [OWNED.owner]: "0x0cc" });

    await expect(
      bindGameplayAccounts({
        accounts: [OWNED],
        authority: fakeAuthority(),
        chain: "madara",
        playerRegistryAddress: REGISTRY,
        provider,
      }),
    ).rejects.toThrow("PlayerRegistry binding conflict for owner 0x0b");
  });

  it("surfaces a bind transaction the chain rejected", async () => {
    const authority = fakeAuthority({ succeeded: false });

    await expect(
      bindGameplayAccounts({
        accounts: [OWNED],
        authority,
        chain: "madara",
        playerRegistryAddress: REGISTRY,
        provider: fakeRegistry({}),
      }),
    ).rejects.toThrow("Binding gameplay accounts failed for transaction 0xtx1");
  });
});

/** account_of(owner) and owner_of(account) over a map of owner -> bound account. */
const fakeRegistry = (bindings: Record<string, string>): ProviderInterface => {
  const accountOf = (owner: string) => bindings[owner] ?? "0x0";
  const ownerOf = (account: string) =>
    Object.entries(bindings).find(([, bound]) => BigInt(bound) === BigInt(account))?.[0] ?? "0x0";
  return {
    callContract: vi.fn(async (call: { entrypoint: string; calldata: string[] }) => [
      call.entrypoint === "account_of" ? accountOf(call.calldata[0]!) : ownerOf(call.calldata[0]!),
    ]),
  } as unknown as ProviderInterface;
};

const fakeAuthority = ({ succeeded = true } = {}): AccountInterface => {
  let sent = 0;
  return {
    execute: vi.fn(async () => ({ transaction_hash: `0xtx${++sent}` })),
    waitForTransaction: vi.fn(async () => ({ isSuccess: () => succeeded })),
  } as unknown as AccountInterface;
};
