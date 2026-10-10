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
const OTHER_CALL = { contractAddress: "0x1", entrypoint: "play", calldata: ["0x2"] };
const SHARD = { chainId: "0x1", l2GasBound: 0x47868c00n };
/** The proxy's published bound on forwarding a request it holds: absence shorter than this proves nothing. */
const PROXY_FORWARD_BOUND_MS = 7_000;
/** The bound plus the client's margin: the node's "unknown hash" with the nonce unmoved this long proves a drop. */
const DROP_PROOF_MS = 12_000;
/** Five blocks without proof either way: the action is unknown, checking, and stops holding the queue. */
const UNKNOWN_AFTER_MS = 10_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("gameplay account submits", () => {
  it("sends an ordinary invoke at the current pre-confirmed nonce with the shard's bound and tip 0", async () => {
    const shard = fakeShard("0xabc", (invoke) => shard.land(invoke));

    const sent = await send(shard);
    expect(sent.transaction_hash).toBe(shard.hashAt(0));
    await expect(sent.inBlock).resolves.toBeUndefined();
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

  it("returns the hash as soon as the send does, and reads the next nonce only after the first answer", async () => {
    const shard = fakeShard("0x999", (invoke) => shard.hold(invoke));

    const first = await send(shard);
    const second = send(shard);
    await endOfMacrotask();
    expect(shard.account.execute).toHaveBeenCalledOnce();

    shard.include(first.transaction_hash);
    await expect(first.inBlock).resolves.toBeUndefined();
    shard.include((await second).transaction_hash);
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
  });

  it("accepted, then the proxy's outcome unknown: reconciled into the block it landed in, never resent", async () => {
    const shard = fakeShard("0x9876", (invoke) => {
      shard.land(invoke);
      throw outcomeUnknown();
    });

    const sent = await send(shard);
    expect(sent.transaction_hash).toBe(shard.hashAt(0));
    await expect(sent.inBlock).resolves.toBeUndefined();
    expect(shard.account.execute).toHaveBeenCalledOnce();
  });

  it("names the hash the proxy computed when its outcome is unknown, and reconciles that hash", async () => {
    const shard = fakeShard("0x9877", (invoke) => {
      shard.land(invoke);
      throw outcomeUnknown(invoke.hash);
    });

    const sent = await send(shard);
    expect(sent.transaction_hash).toBe(shard.hashAt(0));
    await expect(sent.inBlock).resolves.toBeUndefined();
  });

  it.each([
    ["the proxy's own refusal (-32010)", -32010],
    ["a request the proxy does not admit (-32601)", -32601],
  ])("%s is the proxy's proof it never forwarded: not sent at once, and the next send goes", async (_, code) => {
    const shard = fakeShard(`0x79${-code}`, (invoke) => {
      if (shard.sent.length === 1) throw Object.assign(new Error("Transaction refused"), { code });
      return shard.land(invoke);
    });

    await expect(send(shard)).rejects.toThrow(notSent("refused"));
    expect((await send(shard)).transaction_hash).toBe(shard.hashAt(1));
    expect(shard.sentNonces()).toEqual(["0x7", "0x7"]);
  });

  it("dropped only once unknown hash and an unmoved nonce outlast the proxy's forward bound plus a margin", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x9988", (invoke) => ({ transaction_hash: invoke.hash }));

    const sent = await send(shard);
    const answer = sent.inBlock.catch((error: unknown) => error);
    const settled = vi.fn();
    void answer.then(settled);
    // The proxy may still forward a request it holds for up to its bound: no claim yet.
    await vi.advanceTimersByTimeAsync(PROXY_FORWARD_BOUND_MS + 500);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DROP_PROOF_MS - PROXY_FORWARD_BOUND_MS);
    expect(await answer).toBeInstanceOf(TransactionNotSentError);
    expect(String(await answer)).toMatch(notSent("dropped"));
  });

  it("after a drop, a late landing is still seen until the nonce moves", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x9989", (invoke) => ({ transaction_hash: invoke.hash }));

    const sent = await send(shard);
    const answer = sent.inBlock.catch((error: unknown) => error as TransactionNotSentError);
    await vi.advanceTimersByTimeAsync(DROP_PROOF_MS + 250);
    const dropped = await answer;
    expect(String(dropped)).toMatch(notSent("dropped"));

    shard.include(sent.transaction_hash);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(dropped.landedLate).resolves.toBe(true);
  });

  it("after a drop, the watch ends without a landing once another transaction spends the nonce", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x9990", (invoke) => ({ transaction_hash: invoke.hash }));

    const sent = await send(shard);
    const answer = sent.inBlock.catch((error: unknown) => error as TransactionNotSentError);
    await vi.advanceTimersByTimeAsync(DROP_PROOF_MS + 250);
    const dropped = await answer;

    shard.include("0xnextaction");
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(dropped.landedLate).resolves.toBe(false);
  });

  it("both reads unavailable after acceptance: no proof, so the action is unknown and keeps reconciling", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5150", (invoke) => {
      if (shard.sent.length > 1) return shard.land(invoke);
      shard.hold(invoke);
      shard.readable = false;
      throw outcomeUnknown();
    });

    const sent = await send(shard);
    const settled = vi.fn();
    void sent.inBlock.then(settled, settled);
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS + 250);
    expect(settled).not.toHaveBeenCalled();

    shard.readable = true;
    // The queue is free while the first action is still being checked.
    expect((await send(shard, OTHER_CALL)).transaction_hash).toBe(shard.hashAt(1));
    shard.include(sent.transaction_hash);
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).resolves.toBeUndefined();
  });

  it("a failed status read after the nonce moved is no proof of replacement: the hash is still reconciled", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x4321", (invoke) => {
      shard.include(invoke.hash);
      shard.statusReadable = false;
      throw outcomeUnknown();
    });

    const sent = await send(shard);
    const settled = vi.fn();
    void sent.inBlock.then(settled, settled);
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS + 250);
    expect(settled).not.toHaveBeenCalled();

    shard.statusReadable = true;
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).resolves.toBeUndefined();
  });

  it("an unreadable nonce never proves a replacement or a drop: the action stays unknown", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x1010", () => {
      shard.nonceReadable = false;
      throw outcomeUnknown();
    });

    const sent = await send(shard);
    const settled = vi.fn();
    void sent.inBlock.then(settled, settled);
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS * 3);
    expect(settled).not.toHaveBeenCalled();
  });

  it("slow but included: a hash the node holds is unknown after the window, never not sent, and lands", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5105", (invoke) => shard.hold(invoke));

    const sent = await send(shard);
    const settled = vi.fn();
    void sent.inBlock.then(settled, settled);
    await vi.advanceTimersByTimeAsync(DROP_PROOF_MS * 2);
    expect(settled).not.toHaveBeenCalled();

    shard.include(sent.transaction_hash);
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).resolves.toBeUndefined();
  });

  it("replaced at the same nonce: another transaction spent it and the node does not know this hash", async () => {
    const shard = fakeShard("0x4242", () => {
      shard.include("0xelsewhere");
      throw outcomeUnknown();
    });

    const sent = await send(shard);
    await expect(sent.inBlock).rejects.toThrow(notSent("replaced"));
  });

  it("held, then replaced: a known hash is reconciled against the nonce, and not sent once the node forgets it", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x4343", (invoke) => {
      shard.hold(invoke);
      shard.include("0xelsewhere");
    });

    const sent = await send(shard);
    const settled = vi.fn();
    void sent.inBlock.then(settled, settled);
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS + 250);
    expect(settled).not.toHaveBeenCalled();

    shard.forget(sent.transaction_hash);
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).rejects.toThrow(notSent("replaced"));
  });

  it("two tabs race one nonce: the other tab's identical action is this one, a different one replaces it", async () => {
    // The other tab sent the identical command at the same nonce, so the same hash; this copy's reply was lost.
    const same = fakeShard("0x7ab", (invoke) => {
      same.land(invoke);
      throw outcomeUnknown();
    });
    await expect((await send(same)).inBlock).resolves.toBeUndefined();

    const different = fakeShard("0x7ac", (invoke) => {
      if (different.sent.length > 1) return different.land(invoke);
      different.include("0xothertab");
      throw outcomeUnknown();
    });
    await expect((await send(different)).inBlock).rejects.toThrow(notSent("replaced"));
    expect((await send(different)).transaction_hash).toBe(different.hashAt(1));
    expect(different.sentNonces()).toEqual(["0x7", "0x8"]);
  });

  it("disposed while held: reconciling stops without claiming anything, and the account's queue is free", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x6006", (invoke) => shard.hold(invoke));
    const client = new AbortController();

    const sent = await send(shard, CALL, client.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    client.abort(new Error("Game client disposed"));
    await expect(sent.inBlock).rejects.toThrow("Game client disposed");

    const reads = shard.account.getTransactionStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS);
    expect(shard.account.getTransactionStatus.mock.calls.length).toBe(reads);
    const next = send(shard, OTHER_CALL);
    await vi.waitFor(() => expect(shard.account.execute).toHaveBeenCalledTimes(2));
    expect((await next).transaction_hash).toBe(shard.hashAt(1));
  });

  it("a configured account's raw sends stop reconciling when the run it was configured for ends", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x7007", (invoke) => shard.hold(invoke));
    const run = new AbortController();
    const configured = configureGameplayAccountSubmits(
      shard.account as unknown as AccountInterface,
      SHARD,
      run.signal,
    ) as unknown as { execute: (calls: Call) => Promise<{ transaction_hash: string; inBlock: Promise<void> }> };

    const sent = await configured.execute(CALL);
    await vi.advanceTimersByTimeAsync(1_000);
    run.abort(new Error("harness run ended"));
    await expect(sent.inBlock).rejects.toThrow("harness run ended");
    const reads = shard.account.getTransactionStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(UNKNOWN_AFTER_MS);
    expect(shard.account.getTransactionStatus.mock.calls.length).toBe(reads);
  });

  it("puts every send of a configured account, raw or generated, through the same policy", async () => {
    const shard = fakeShard("0x123", (invoke) => shard.land(invoke));
    const rawExecute = shard.account.execute;
    const configured = configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, SHARD);

    expect((await configured.execute(CALL)).transaction_hash).toBe(shard.hashAt(0));
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

const send = (shard: FakeShard, calls: Call = CALL, stopped?: AbortSignal) =>
  executeGameplayAccountTransaction({ account: shard.account, calls, shard: SHARD, stopped });

interface SentInvoke {
  hash: string;
  nonce: string;
}
type FakeShard = ReturnType<typeof fakeShard>;

/**
 * One account's view of a shard: its pre-confirmed nonce, the hashes in a block (nonce spent) and the hashes the node
 * holds but has not included. An unknown hash answers the node's own error 29; an unreadable read fails otherwise.
 * `onSend` plays the node and proxy for each invoke the account signs.
 */
function fakeShard(address: string, onSend: (invoke: SentInvoke) => { transaction_hash: string } | void) {
  const statuses = new Map<string, "RECEIVED" | "PRE_CONFIRMED">();
  const sent: SentInvoke[] = [];
  const shard = {
    nonce: 7n,
    nonceReadable: true,
    statusReadable: true,
    set readable(readable: boolean) {
      shard.nonceReadable = readable;
      shard.statusReadable = readable;
    },
    sent,
    hashAt: (index: number) => sent[index]!.hash,
    sentNonces: () => sent.map(({ nonce }) => nonce),
    /** The node holds the invoke without a block yet. */
    hold: (invoke: SentInvoke) => {
      statuses.set(invoke.hash, "RECEIVED");
      return { transaction_hash: invoke.hash };
    },
    /** The node no longer knows the hash (its mempool lost it). */
    forget: (transactionHash: string) => statuses.delete(transactionHash),
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
        if (!shard.statusReadable) throw Object.assign(new Error("RPC read unavailable"), { code: -32012 });
        const status = statuses.get(transactionHash);
        if (!status) throw Object.assign(new Error("Transaction hash not found"), { baseError: { code: 29 } });
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
/** The stamping proxy tried to forward this invoke and cannot say whether the node took it. */
const outcomeUnknown = (transactionHash?: string) =>
  Object.assign(new Error("Transaction outcome unknown"), {
    baseError: { code: -32011, ...(transactionHash ? { data: { transaction_hash: transactionHash } } : {}) },
  });

/** Flushes every pending microtask and the next macrotask. */
function endOfMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
