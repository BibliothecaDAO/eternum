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

  it("Herald frees the next send at 300 ms using the spent nonce while node hash and nonce lag 19 s", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x3030", (invoke) => ({ transaction_hash: invoke.hash }));
    const run = new AbortController();
    const waitForTransaction = vi.fn(
      (hash: string) =>
        new Promise<{ hash: string; block: null; status: string }>((resolve) =>
          setTimeout(() => resolve({ hash, block: null, status: "PRE_CONFIRMED" }), 300),
        ),
    );
    const submit = () =>
      executeGameplayAccountTransaction({
        account: shard.account,
        calls: CALL,
        shard: SHARD,
        stopped: run.signal,
        waitForTransaction,
      });
    const first = await submit();
    const next = submit();
    await vi.advanceTimersByTimeAsync(299);
    expect(shard.sentNonces()).toEqual(["0x7"]);
    await vi.advanceTimersByTimeAsync(1);
    await expect(first.inBlock).resolves.toBeUndefined();
    const second = await next;
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
    expect(shard.nonce).toBe(7n);
    await vi.advanceTimersByTimeAsync(300);
    await expect(second.inBlock).resolves.toBeUndefined();
    const reads = shard.account.getTransactionStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(19_000);
    expect(shard.account.getTransactionStatus).toHaveBeenCalledTimes(reads);
    run.abort();
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
    ["the node refuses an invalid nonce (52)", 52],
    ["the node refuses account validation (55)", 55],
  ])("%s is an explicit admission refusal: not sent at once, and the next send goes", async (_, code) => {
    const shard = fakeShard(`0x79${Math.abs(code)}`, (invoke) => {
      if (shard.sent.length === 1) throw Object.assign(new Error("Transaction refused"), { code });
      return shard.land(invoke);
    });

    await expect(send(shard)).rejects.toThrow(notSent("refused"));
    expect((await send(shard)).transaction_hash).toBe(shard.hashAt(1));
    expect(shard.sentNonces()).toEqual(["0x7", "0x7"]);
  });

  it.each([false, true])("a 19 s visibility gap releases as no answer, never not sent: %s", async (advanced) => {
    vi.useFakeTimers();
    const shard = fakeShard(advanced ? "0x191" : "0x190", (invoke) => ({ transaction_hash: invoke.hash }));
    const sent = await send(shard);
    if (advanced) shard.nonce += 1n;
    const ended = expect(sent.inBlock).rejects.toThrow("No answer");
    await vi.advanceTimersByTimeAsync(14_000);
    await ended;
    const next = await send(shard);
    expect(shard.sentNonces()).toEqual(["0x7", advanced ? "0x8" : "0x7"]);
    void next.inBlock.catch(() => {});
    await vi.advanceTimersByTimeAsync(14_000);
  });

  it("a refused second send fails immediately and reconciles its next nonce from the node", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x3052", (invoke) => {
      if (shard.sent.length === 2)
        throw Object.assign(new Error("Invalid transaction nonce"), { baseError: { code: 52 } });
      return { transaction_hash: invoke.hash };
    });
    const waitForTransaction = (hash: string) =>
      shard.sent.length === 1
        ? new Promise<never>(() => {})
        : Promise.resolve({ hash, block: null, status: "PRE_CONFIRMED" });
    const submit = () =>
      executeGameplayAccountTransaction({ account: shard.account, calls: CALL, shard: SHARD, waitForTransaction });
    await (
      await submit()
    ).inBlock;
    const refused = submit();
    await expect(refused).rejects.toMatchObject({ cause: { baseError: { code: 52 } } });
    shard.nonce = 9n;
    await (
      await submit()
    ).inBlock;
    expect(shard.sentNonces()).toEqual(["0x7", "0x8", "0x9"]);
    expect(shard.account.getNonce).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a node refusal cannot negate a hash Herald has already reported", async () => {
    const shard = fakeShard("0x1952", async () => {
      await Promise.resolve();
      throw Object.assign(new Error("Invalid transaction nonce"), { code: 52 });
    });
    const sent = await executeGameplayAccountTransaction({
      account: shard.account,
      calls: CALL,
      shard: SHARD,
      waitForTransaction: async (hash) => ({ hash, block: null, status: "PRE_CONFIRMED" }),
    });
    await expect(sent.inBlock).resolves.toBeUndefined();
    expect(shard.account.getTransactionStatus).not.toHaveBeenCalled();
  });

  it("a duplicate transaction answer is reconciled, never called refused", async () => {
    const shard = fakeShard("0x1959", (invoke) => {
      shard.include(invoke.hash);
      throw Object.assign(new Error("Duplicate transaction"), { code: 59 });
    });
    await expect((await send(shard)).inBlock).resolves.toBeUndefined();
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
    await vi.advanceTimersByTimeAsync(10_000 + 250);
    expect(settled).not.toHaveBeenCalled();

    shard.readable = true;
    // Elapsed time is not inclusion: the next send waits for an actual answer.
    const next = send(shard, OTHER_CALL);
    await vi.advanceTimersByTimeAsync(250);
    expect(shard.account.execute).toHaveBeenCalledOnce();
    shard.include(sent.transaction_hash);
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).resolves.toBeUndefined();
    expect((await next).transaction_hash).toBe(shard.hashAt(1));
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
    await vi.advanceTimersByTimeAsync(10_000 + 250);
    expect(settled).not.toHaveBeenCalled();

    shard.statusReadable = true;
    await vi.advanceTimersByTimeAsync(250);
    await expect(sent.inBlock).resolves.toBeUndefined();
  });

  it("an unanswered send ends honestly even when all node reads hang", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x1010", () => {
      throw outcomeUnknown();
    });
    shard.account.getTransactionStatus.mockImplementation(() => new Promise(() => {}));
    const sent = await send(shard);
    const ended = expect(sent.inBlock).rejects.toThrow("No answer");
    await vi.advanceTimersByTimeAsync(14_000);
    await ended;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a send that never answers releases the next command without a reload", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5151", (invoke) =>
      shard.sent.length === 1 ? new Promise(() => {}) : shard.land(invoke),
    );
    const submit = () =>
      executeGameplayAccountTransaction({
        account: shard.account,
        calls: CALL,
        shard: SHARD,
        waitForTransaction: () => new Promise(() => {}),
      });
    const ended = expect(submit()).rejects.toThrow("No answer");
    await vi.advanceTimersByTimeAsync(12_000);
    await ended;
    const next = await submit();
    expect(shard.account.execute).toHaveBeenCalledTimes(2);
    expect(shard.sentNonces()).toEqual(["0x7", "0x7"]);
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(next.inBlock).resolves.toBeUndefined();
  });

  it("Herald settles a send whose HTTP request never answers", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5105", () => new Promise(() => {}));
    const sent = executeGameplayAccountTransaction({
      account: shard.account,
      calls: CALL,
      shard: SHARD,
      waitForTransaction: (hash) =>
        new Promise((resolve) => setTimeout(() => resolve({ hash, block: null, status: "PRE_CONFIRMED" }), 300)),
    });
    await vi.advanceTimersByTimeAsync(300);
    await expect((await sent).inBlock).resolves.toBeUndefined();
    expect(shard.account.getTransactionStatus).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
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
    await vi.advanceTimersByTimeAsync(10_000);
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
    await vi.advanceTimersByTimeAsync(10_000);
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
function fakeShard(
  address: string,
  onSend: (invoke: SentInvoke) => { transaction_hash: string } | void | Promise<void>,
) {
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
        const response = await onSend(invoke);
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
