import { describe, expect, it, vi } from "vitest";
import { BlockTag, type AccountInterface, type AllowArray, type Call, type UniversalDetails } from "starknet";

import { configureGameplayAccountSubmits, executeGameplayAccountTransaction } from "./submit";

const CALL = { contractAddress: "0x1", entrypoint: "play", calldata: [] };
const SHARD = { chainId: "0x1", l2GasBound: 0x47868c00n };

describe("gameplay account submits", () => {
  it("sends an ordinary invoke at the current pre-confirmed nonce with the shard's bound and tip 0", async () => {
    const account = createAccount("0xabc", ["0x7"], async () => ({ transaction_hash: "0x1" }));

    await expect(executeGameplayAccountTransaction({ account, calls: CALL, shard: SHARD })).resolves.toEqual({
      transaction_hash: "0x1",
    });

    expect(account.getNonce).toHaveBeenCalledWith(BlockTag.PRE_CONFIRMED);
    expect(account.execute).toHaveBeenCalledWith(CALL, {
      nonce: "0x7",
      tip: 0,
      resourceBounds: {
        l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
        l2_gas: { max_amount: 0x47868c00n, max_price_per_unit: 0n },
      },
    });
  });

  it("keeps one send in flight: the next reads its nonce only once the previous is in a block", async () => {
    let includeFirst!: () => void;
    const account = createAccount(
      "0x999",
      ["0x7", "0x8"],
      async () => ({ transaction_hash: `0x${account.execute.mock.calls.length}` }),
      (hash) => (hash === "0x1" ? new Promise<void>((resolve) => (includeFirst = resolve)) : Promise.resolve()),
    );

    const first = executeGameplayAccountTransaction({ account, calls: CALL, shard: SHARD });
    const second = executeGameplayAccountTransaction({ account, calls: CALL, shard: SHARD });
    await expect(first).resolves.toEqual({ transaction_hash: "0x1" });
    await endOfMacrotask();
    expect(account.getNonce).toHaveBeenCalledTimes(1);
    expect(account.execute).toHaveBeenCalledTimes(1);

    includeFirst();
    await expect(second).resolves.toEqual({ transaction_hash: "0x2" });
    expect(account.execute.mock.calls.map(([, details]) => details?.nonce)).toEqual(["0x7", "0x8"]);
  });

  it("lets the next send go with a fresh nonce after a send fails", async () => {
    const account = createAccount("0x789", ["0x3", "0x3"], async () => {
      if (account.execute.mock.calls.length === 1) throw new Error("Transaction refused");
      return { transaction_hash: "0x5" };
    });

    await expect(executeGameplayAccountTransaction({ account, calls: CALL, shard: SHARD })).rejects.toThrow(
      "Transaction refused",
    );
    await expect(executeGameplayAccountTransaction({ account, calls: CALL, shard: SHARD })).resolves.toEqual({
      transaction_hash: "0x5",
    });
    expect(account.getNonce).toHaveBeenCalledTimes(2);
  });

  it("puts every send of a configured account, raw or generated, through the same policy", async () => {
    const account = createAccount("0x123", ["0x9"], async () => ({ transaction_hash: "0x3" }));
    const rawExecute = account.execute;
    const configured = configureGameplayAccountSubmits(account as unknown as AccountInterface, SHARD);

    await expect(configured.execute(CALL)).resolves.toEqual({ transaction_hash: "0x3" });
    expect(rawExecute).toHaveBeenCalledWith(
      CALL,
      expect.objectContaining({ nonce: "0x9", tip: 0, resourceBounds: expect.any(Object) }),
    );
  });

  it("rejects reusing a configured account on another chain", () => {
    const account = createAccount("0x456", ["0x1"], async () => ({ transaction_hash: "0x4" }));
    configureGameplayAccountSubmits(account as unknown as AccountInterface, SHARD);

    expect(() =>
      configureGameplayAccountSubmits(account as unknown as AccountInterface, { ...SHARD, chainId: "0x2" }),
    ).toThrow("configured for 0x1, not 0x2");
  });
});

function createAccount(
  address: string,
  nonces: string[],
  execute: (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<{ transaction_hash: string }>,
  inBlock: (transactionHash: string) => Promise<void> = async () => {},
) {
  return {
    address,
    execute: vi.fn(execute),
    getNonce: vi.fn().mockImplementation(async () => {
      const nonce = nonces.shift();
      if (!nonce) throw new Error("No nonce prepared for test");
      return nonce;
    }),
    waitForTransaction: vi.fn(inBlock),
  };
}

/** Flushes every pending microtask and the next macrotask. */
function endOfMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
