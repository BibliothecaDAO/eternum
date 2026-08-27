import { describe, expect, it, vi } from "vitest";
import { BlockTag, type Account, type AllowArray, type Call, type UniversalDetails } from "starknet";

import { configureGameplayAccountSubmits, executeGameplayAccountTransaction } from "./gameplay-account-submit";

const CALL = { contractAddress: "0x1", entrypoint: "play", calldata: [] };

describe("gameplay account submits", () => {
  it("serializes concurrent submits and dispenses nonces from one pre-confirmed read", async () => {
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let active = 0;
    let maximumActive = 0;
    const account = createAccount("0xabc", ["0x7"], async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      if (account.execute.mock.calls.length === 1) await firstBlocked;
      active -= 1;
      return { transaction_hash: `0x${account.execute.mock.calls.length}` };
    });

    const first = executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" });
    await vi.waitFor(() => expect(account.execute).toHaveBeenCalledOnce());
    const second = executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" });
    await Promise.resolve();
    expect(account.execute).toHaveBeenCalledOnce();

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);

    expect(maximumActive).toBe(1);
    expect(account.getNonce).toHaveBeenNthCalledWith(1, BlockTag.PRE_CONFIRMED);
    expect(account.getNonce).toHaveBeenCalledTimes(1);
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual([7n, 8n]);
    expect(account.execute.mock.calls[0]?.[1]).toMatchObject({
      tip: 0,
      resourceBounds: {
        l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l2_gas: { max_amount: 1_200_000_000n, max_price_per_unit: 0n },
      },
    });
  });

  it("retries one nonce rejection with a fresh pre-confirmed nonce", async () => {
    const account = createAccount("0xdef", ["0x6", "0x7"], async () => {
      if (account.execute.mock.calls.length === 1) {
        throw new Error("Invalid transaction nonce. Account nonce: 0x7; got: 0x6");
      }
      return { transaction_hash: "0x2" };
    });

    await expect(executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" })).resolves.toEqual({
      transaction_hash: "0x2",
    });
    await expect(executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" })).resolves.toEqual({
      transaction_hash: "0x2",
    });
    expect(account.getNonce).toHaveBeenCalledTimes(2);
    expect(account.execute).toHaveBeenCalledTimes(3);
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual([6n, 7n, 8n]);
  });

  it("installs the same submit policy on generated-system account calls", async () => {
    const account = createAccount("0x123", ["0x9"], async () => ({ transaction_hash: "0x3" }));
    const rawExecute = account.execute;
    const configured = configureGameplayAccountSubmits(account as unknown as Account, "madara");

    await expect(configured.execute(CALL)).resolves.toEqual({ transaction_hash: "0x3" });
    expect(rawExecute).toHaveBeenCalledWith(
      CALL,
      expect.objectContaining({ nonce: 9n, tip: 0, resourceBounds: expect.any(Object) }),
    );
  });

  it("rejects reusing a configured account on another chain", () => {
    const account = createAccount("0x456", ["0x1"], async () => ({ transaction_hash: "0x4" }));
    configureGameplayAccountSubmits(account as unknown as Account, "madara");

    expect(() => configureGameplayAccountSubmits(account as unknown as Account, "appchain")).toThrow(
      "configured for madara, not appchain",
    );
  });
});

function createAccount(
  address: string,
  nonces: string[],
  execute: (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<{ transaction_hash: string }>,
) {
  return {
    address,
    execute: vi.fn(execute),
    getNonce: vi.fn().mockImplementation(async () => {
      const nonce = nonces.shift();
      if (!nonce) throw new Error("No nonce prepared for test");
      return nonce;
    }),
  };
}
