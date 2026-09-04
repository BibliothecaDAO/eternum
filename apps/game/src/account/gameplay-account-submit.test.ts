import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockTag, type Account, type AllowArray, type Call, type UniversalDetails } from "starknet";

import { configureGameplayAccountSubmits, executeGameplayAccountTransaction } from "./gameplay-account-submit";

const CALL = { contractAddress: "0x1", entrypoint: "play", calldata: [] };

describe("gameplay account submits", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pipelines a 20-action burst from one pre-confirmed read", async () => {
    let releaseAll!: () => void;
    const blocked = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });
    let active = 0;
    let maximumActive = 0;
    const account = createAccount("0xabc", ["0x7"], async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await blocked;
      active -= 1;
      return { transaction_hash: `0x${account.execute.mock.calls.length}` };
    });

    const burst = Array.from({ length: 20 }, () =>
      executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" }),
    );
    await vi.waitFor(() => expect(account.execute).toHaveBeenCalledTimes(20));
    expect(maximumActive).toBe(20);

    releaseAll();
    await expect(Promise.all(burst)).resolves.toHaveLength(20);

    expect(account.getNonce).toHaveBeenCalledTimes(1);
    expect(account.getNonce).toHaveBeenCalledWith(BlockTag.PRE_CONFIRMED);
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual(
      Array.from({ length: 20 }, (_, index) => 7n + BigInt(index)),
    );
    expect(account.execute.mock.calls[0]?.[1]).toMatchObject({
      tip: 0,
      resourceBounds: {
        l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l2_gas: { max_amount: 1_200_000_000n, max_price_per_unit: 0n },
      },
    });
  });

  it("signs the next action without waiting for the previous send", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let settled = 0;
    const account = createAccount("0x999", ["0x7"], () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          settled += 1;
          resolve({ transaction_hash: `0x${settled}` });
        }, 150);
      });
    });

    const burst = Array.from({ length: 10 }, () =>
      executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" }),
    );
    await endOfMacrotask();

    expect(account.execute).toHaveBeenCalledTimes(10);
    expect(settled).toBe(0);
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual(
      Array.from({ length: 10 }, (_, index) => 7n + BigInt(index)),
    );

    await vi.advanceTimersByTimeAsync(150);
    await expect(Promise.all(burst)).resolves.toHaveLength(10);
    expect(settled).toBe(10);
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

  it("a failed send resyncs the nonce for the next action", async () => {
    const account = createAccount("0x789", ["0x3", "0x9"], async () => {
      if (account.execute.mock.calls.length === 1) throw new Error("RPC unreachable");
      return { transaction_hash: "0x5" };
    });

    await expect(executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" })).rejects.toThrow(
      "RPC unreachable",
    );
    await expect(executeGameplayAccountTransaction({ account, calls: CALL, chain: "madara" })).resolves.toEqual({
      transaction_hash: "0x5",
    });
    expect(account.getNonce).toHaveBeenCalledTimes(2);
    expect(account.execute).toHaveBeenCalledTimes(2);
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual([3n, 9n]);
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

/** Flushes every pending microtask without firing a faked timer. */
function endOfMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
