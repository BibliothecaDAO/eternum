import { TransactionNotSentError } from "@bibliothecadao/provider";
import {
  BlockTag,
  EDAMode,
  hash,
  transaction,
  type AccountInterface,
  type AllowArray,
  type Call,
  type InvocationsSignerDetails,
  type UniversalDetails,
} from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configureGameplayAccountSubmits, executeGameplayAccountTransaction } from "./submit";

const CALL = { contractAddress: "0x1", entrypoint: "play", calldata: [] };
const SHARD = { chainId: "0x1", l2GasBound: 0x47868c00n };
/** Three 2 s blocks: how long a hash the node never held may stay unseen before the nonce settles it as not sent. */
const NOT_SEEN_LIMIT_MS = 6_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("gameplay account submits", () => {
  it("sends an ordinary invoke at the current pre-confirmed nonce with the shard's bound and tip 0", async () => {
    const shard = fakeShard("0xabc", (invoke) => shard.land(invoke));

    expect(await send(shard)).toEqual({ transaction_hash: shard.hashAt(0) });

    expect(shard.account.getNonce).toHaveBeenCalledWith(BlockTag.PRE_CONFIRMED);
    expect(shard.account.execute).toHaveBeenCalledWith(
      CALL,
      expect.objectContaining({
        nonce: "0x7",
        tip: 0,
        resourceBounds: {
          l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
          l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
          l2_gas: { max_amount: 0x47868c00n, max_price_per_unit: 0n },
        },
      }),
    );
  });

  it("resolves once the transaction is in a block, and only then reads the next send's nonce", async () => {
    const shard = fakeShard("0x999", (invoke) => shard.hold(invoke));

    const first = send(shard);
    const second = send(shard);
    await vi.waitFor(() => expect(shard.account.execute).toHaveBeenCalledOnce());
    await endOfMacrotask();
    expect(shard.account.getNonce).toHaveBeenCalledTimes(1);

    shard.include(shard.hashAt(0));
    await expect(first).resolves.toEqual({ transaction_hash: shard.hashAt(0) });
    await vi.waitFor(() => expect(shard.account.execute).toHaveBeenCalledTimes(2));
    shard.include(shard.hashAt(1));
    await expect(second).resolves.toEqual({ transaction_hash: shard.hashAt(1) });
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
  });

  it("refused by the stamping proxy: not sent at once, and the next send goes at a fresh nonce", async () => {
    const shard = fakeShard("0x789", (invoke) => {
      if (shard.sent.length === 1) throw transactionRefused();
      return shard.land(invoke);
    });

    await expect(send(shard)).rejects.toThrow(notSent("refused"));
    expect(await send(shard)).toEqual({ transaction_hash: shard.hashAt(1) });
    expect(shard.sentNonces()).toEqual(["0x7", "0x7"]);
  });

  it("dropped after acceptance: unseen with an unmoved nonce for three blocks, then not sent", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x9988", (invoke) => ({ transaction_hash: invoke.hash }));

    const first = send(shard);
    const outcome = first.catch((error: unknown) => error);
    const next = send(shard);
    await vi.advanceTimersByTimeAsync(NOT_SEEN_LIMIT_MS - 500);
    expect(shard.account.execute).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await outcome).toBeInstanceOf(TransactionNotSentError);
    expect(await outcome).toHaveProperty("message", `Transaction ${shard.hashAt(0)} not sent (dropped)`);
    await vi.waitFor(() => expect(shard.account.execute).toHaveBeenCalledTimes(2));
    shard.include(shard.hashAt(1));
    await vi.advanceTimersByTimeAsync(250);
    await expect(next).resolves.toEqual({ transaction_hash: shard.hashAt(1) });
  });

  it("an opaque send error that never reached the node is not sent once the window passes", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5150", () => {
      throw new Error("502 Bad Gateway");
    });

    const outcome = send(shard).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(NOT_SEEN_LIMIT_MS + 250);
    expect(String(await outcome)).toMatch(notSent("dropped"));
    expect(shard.account.execute).toHaveBeenCalledOnce();
  });

  it("slow but included: a hash the node holds keeps the wait open past the window, and lands", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5105", (invoke) => shard.hold(invoke));

    const settled = vi.fn();
    const first = send(shard);
    void first.then(settled, settled);
    await vi.advanceTimersByTimeAsync(NOT_SEEN_LIMIT_MS * 3);
    expect(settled).not.toHaveBeenCalled();

    shard.include(shard.hashAt(0));
    await vi.advanceTimersByTimeAsync(250);
    await expect(first).resolves.toEqual({ transaction_hash: shard.hashAt(0) });
  });

  it("a lost invoke reply observes the ordinary hash and resolves when it lands, never resending", async () => {
    const shard = fakeShard("0x9876", (invoke) => {
      shard.land(invoke);
      throw new Error("upstream response lost");
    });

    expect(await send(shard)).toEqual({ transaction_hash: shard.hashAt(0) });
    expect(shard.account.execute).toHaveBeenCalledOnce();
  });

  it("replaced at the same nonce: another transaction took it, so this one is not sent without waiting out the window", async () => {
    const shard = fakeShard("0x4242", () => {
      shard.include("0xelsewhere");
      throw new Error("upstream response lost");
    });

    await expect(send(shard)).rejects.toThrow(notSent("replaced"));
  });

  it("two tabs race one nonce: the loser is not sent and its tab's next action goes at the fresh nonce", async () => {
    const shard = fakeShard("0x7ab", (invoke) => {
      // The other tab's invoke at the same nonce reached the proxy first; the proxy refuses a spent nonce.
      if (shard.sent.length === 1) {
        shard.include("0xothertab");
        throw transactionRefused();
      }
      return shard.land(invoke);
    });

    await expect(send(shard)).rejects.toThrow(notSent("refused"));
    expect(await send(shard)).toEqual({ transaction_hash: shard.hashAt(1) });
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
  });

  it("a nonce that cannot be read never proves a replacement: the window settles it as dropped", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x1010", () => {
      shard.nonceReadable = false;
      throw new Error("upstream response lost");
    });

    const outcome = send(shard).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(NOT_SEEN_LIMIT_MS + 250);
    expect(String(await outcome)).toMatch(notSent("dropped"));
  });

  it("keeps a policy refusal's own error and lets the next send go with a fresh nonce", async () => {
    const shard = fakeShard("0x790", (invoke) => {
      if (shard.sent.length === 1) throw Object.assign(new Error("Method not found"), { code: -32601 });
      return shard.land(invoke);
    });

    await expect(send(shard)).rejects.toThrow("Method not found");
    expect(await send(shard)).toEqual({ transaction_hash: shard.hashAt(1) });
  });

  it("puts every send of a configured account, raw or generated, through the same policy", async () => {
    const shard = fakeShard("0x123", (invoke) => shard.land(invoke));
    const rawExecute = shard.account.execute;
    const configured = configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, SHARD);

    expect(await configured.execute(CALL)).toEqual({ transaction_hash: shard.hashAt(0) });
    expect(rawExecute).toHaveBeenCalledWith(
      CALL,
      expect.objectContaining({ nonce: "0x7", tip: 0, resourceBounds: expect.any(Object) }),
    );
  });

  it("rejects reusing a configured account on another chain", () => {
    const shard = fakeShard("0x456", (invoke) => shard.land(invoke));
    configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, SHARD);

    expect(() =>
      configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, { ...SHARD, chainId: "0x2" }),
    ).toThrow("configured for 0x1, not 0x2");
  });
});

const send = (shard: FakeShard) =>
  executeGameplayAccountTransaction({ account: shard.account, calls: CALL, shard: SHARD });

interface SentInvoke {
  hash: string;
  nonce: string;
}
type FakeShard = ReturnType<typeof fakeShard>;

/**
 * One account's view of a shard: its pre-confirmed nonce, the hashes in a block (nonce spent) and the hashes the node
 * holds but has not included. `onSend` plays the node and proxy for each invoke the account signs.
 */
function fakeShard(address: string, onSend: (invoke: SentInvoke) => { transaction_hash: string } | void) {
  const statuses = new Map<string, "RECEIVED" | "PRE_CONFIRMED">();
  const sent: SentInvoke[] = [];
  const shard = {
    nonce: 7n,
    nonceReadable: true,
    sent,
    hashAt: (index: number) => sent[index]!.hash,
    sentNonces: () => sent.map(({ nonce }) => nonce),
    /** The node holds the invoke without a block yet. */
    hold: (invoke: SentInvoke) => {
      statuses.set(invoke.hash, "RECEIVED");
      return { transaction_hash: invoke.hash };
    },
    /** A transaction lands in the next block and spends the account's nonce. */
    include: (transactionHash: string) => {
      statuses.set(transactionHash, "PRE_CONFIRMED");
      shard.nonce += 1n;
    },
    land: (invoke: SentInvoke) => {
      shard.include(invoke.hash);
      return { transaction_hash: invoke.hash };
    },
    account: {
      address,
      execute: vi.fn(async (calls: AllowArray<Call>, details?: UniversalDetails) => {
        const invoke = { hash: invokeHash(address, calls, details!), nonce: String(details!.nonce) };
        sent.push(invoke);
        const response = onSend(invoke);
        return response ?? { transaction_hash: invoke.hash };
      }),
      getNonce: vi.fn(async () => {
        if (!shard.nonceReadable) throw new Error("upstream timed out");
        return `0x${shard.nonce.toString(16)}`;
      }),
      getTransactionStatus: vi.fn(async (transactionHash: string) => {
        const status = statuses.get(transactionHash);
        if (!status) throw new Error("TXN_HASH_NOT_FOUND");
        return { finality_status: status };
      }),
    },
  };
  return shard;
}

/** The hash the node gives the invoke, from the frame the account signed. */
function invokeHash(address: string, calls: AllowArray<Call>, details: UniversalDetails): string {
  return hash.calculateInvokeTransactionHash({
    ...(details as Omit<InvocationsSignerDetails, "chainId" | "walletAddress" | "cairoVersion">),
    senderAddress: address,
    compiledCalldata: transaction.getExecuteCalldata(Array.isArray(calls) ? calls : [calls], "1"),
    chainId: SHARD.chainId as InvocationsSignerDetails["chainId"],
    nonceDataAvailabilityMode: EDAMode.L1,
    feeDataAvailabilityMode: EDAMode.L1,
  });
}

/** The message of an action proven not sent for this reason. */
const notSent = (reason: string) => new RegExp(`Transaction 0x[0-9a-f]+ not sent \\(${reason}\\)$`);
const transactionRefused = () => Object.assign(new Error("Transaction refused"), { code: -32000 });

/** Flushes every pending microtask and the next macrotask. */
function endOfMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
