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

import { PLAYS_IN_FLIGHT } from "@bibliothecadao/provider";

import { nativePlay } from "./native-submission";
import {
  configureGameplayAccountSubmits,
  executeGameplayAccountTransaction,
  invalidateGameplayNonce,
  type SendStage,
  type SentGameplayTransaction,
} from "./submit";

const CALL = { contractAddress: "0x1", entrypoint: "play", calldata: [] };
const OTHER_CALL = { contractAddress: "0x1", entrypoint: "play", calldata: ["0x2"] };
const SHARD = { chainId: "0x1", l2GasBound: 0x47868c00n };
afterEach(() => {
  for (const end of endWithTest.splice(0)) end();
  vi.useRealTimers();
});

describe("gameplay account submits", () => {
  it("another tab invalidates the nonce even when a local inclusion and a queued send are still pending", async () => {
    const shard = fakeShard("0x502003", (invoke) => shard.land(invoke));
    let applied!: () => void;
    const included = new Promise<void>((resolve) => {
      applied = resolve;
    });
    const submit = () =>
      executeGameplayAccountTransaction({
        account: shard.account,
        calls: CALL,
        shard: SHARD,
        waitForTransaction: async (hash) => {
          await included;
          return { hash, block: null, status: "PRE_CONFIRMED" };
        },
      });
    const first = await submit();
    const queued = submit();
    shard.nonce++;
    invalidateGameplayNonce(SHARD.chainId, shard.account.address);
    applied();
    await first.inBlock;
    await (
      await queued
    ).inBlock;
    expect(shard.sentNonces()).toEqual(["0x7", "0x9"]);
    expect(shard.account.getNonce).toHaveBeenCalledTimes(2);
  });

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

  it("a play leaves at the next nonce at once while Herald settles the last at 300 ms and the node lags 19 s", async () => {
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
    const second = await submit();
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
    expect(shard.nonce).toBe(7n);
    await vi.advanceTimersByTimeAsync(300);
    await expect(first.inBlock).resolves.toBeUndefined();
    await expect(second.inBlock).resolves.toBeUndefined();
    const reads = shard.account.getTransactionStatus.mock.calls.length;
    await vi.advanceTimersByTimeAsync(19_000);
    expect(shard.account.getTransactionStatus).toHaveBeenCalledTimes(reads);
    run.abort();
  });

  it("a burst leaves at consecutive nonces as each is answered, as many as the shard holds; then one per inclusion", async () => {
    const shard = fakeShard("0x999", (invoke) => shard.hold(invoke));

    const burst = Array.from({ length: PLAYS_IN_FLIGHT + 1 }, () => send(shard));
    await endOfMacrotask();
    expect(shard.sentNonces()).toEqual(["0x7", "0x8", "0x9", "0xa"]);
    expect(shard.account.getNonce).toHaveBeenCalledOnce();

    const first = await burst[0]!;
    shard.include(first.transaction_hash);
    await expect(first.inBlock).resolves.toBeUndefined();
    await burst[PLAYS_IN_FLIGHT];
    expect(shard.sentNonces()).toEqual(["0x7", "0x8", "0x9", "0xa", "0xb"]);
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

    await expect(send(shard)).rejects.toThrow("The shard refused this action. Try again.");
    expect((await send(shard)).transaction_hash).toBe(shard.hashAt(1));
    expect(shard.sentNonces()).toEqual(["0x7", "0x7"]);
  });

  it.each([
    ["in-flight", "Another of your actions was still being sent. Try again."],
    ["nonce", "Another action from this account was sent first, perhaps from another tab. Try again."],
    ["deadline", "The shard took too long to accept this action. Try again."],
    ["stamp", "The shard could not seal this action. Try again."],
    ["validation", "The shard does not accept this action from this account."],
    ["unavailable", "The shard could not reach its node. Try again."],
  ])("a refusal naming %s is not sent, and says why", async (reason, sentence) => {
    const shard = fakeShard(`0x7a${reason.length}`, () => {
      throw Object.assign(new Error("Transaction refused"), { baseError: { code: -32010, data: { reason } } });
    });

    await expect(send(shard)).rejects.toMatchObject({ name: "TransactionNotSentError", message: sentence });
    // Only a nonce refusal is numbered again, and only once.
    expect(shard.sent).toHaveLength(reason === "nonce" ? 2 : 1);
  });

  it("a refusal naming no reason it knows says only that the shard refused", async () => {
    const shard = fakeShard("0x7b1", () => {
      throw Object.assign(new Error("Transaction refused"), { baseError: { code: -32010, data: { reason: "debug" } } });
    });
    await expect(send(shard)).rejects.toThrow(/^The shard refused this action\. Try again\.$/);
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

  it("an answer that arrives after Herald reported its play leaves the later plays free to leave together", async () => {
    const shard = fakeShard("0x1953", async (invoke) => {
      if (shard.sent.length > 1) return shard.hold(invoke);
      await endOfMacrotask();
      throw Object.assign(new Error("Invalid transaction nonce"), { code: 52 });
    });
    const sent = await executeGameplayAccountTransaction({
      account: shard.account,
      calls: CALL,
      shard: SHARD,
      waitForTransaction: async (hash) => ({ hash, block: null, status: "PRE_CONFIRMED" }),
    });
    await sent.inBlock;
    await endOfMacrotask();

    void send(shard);
    void send(shard, OTHER_CALL);
    await endOfMacrotask();
    expect(shard.sentNonces()).toEqual(["0x7", "0x8", "0x9"]);
  });

  it("a lost answer holds the next play until its own play settles", async () => {
    const shard = fakeShard("0x1954", (invoke) => {
      if (shard.sent.length > 1) return shard.hold(invoke);
      shard.hold(invoke);
      throw outcomeUnknown();
    });

    const first = await send(shard);
    const next = send(shard, OTHER_CALL);
    await endOfMacrotask();
    expect(shard.sentNonces()).toEqual(["0x7"]);
    shard.include(first.transaction_hash);
    await first.inBlock;
    await next;
    expect(shard.sentNonces()).toEqual(["0x7", "0x8"]);
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

  it("a configured account's first send needs no nonce read after the player acts", async () => {
    const shard = fakeShard("0x9009", (invoke) => shard.land(invoke));
    const configured = configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, SHARD);
    await endOfMacrotask();
    shard.nonceReadable = false;

    const sent = await configured.execute(CALL);
    expect(sent.transaction_hash).toBe(shard.hashAt(0));
    expect(shard.sentNonces()).toEqual(["0x7"]);
  });

  it("rejects reusing a configured account on another chain", () => {
    const shard = fakeShard("0x456", (invoke) => shard.land(invoke));
    configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, SHARD);

    expect(() =>
      configureGameplayAccountSubmits(shard.account as unknown as AccountInterface, { ...SHARD, chainId: "0x2" }),
    ).toThrow("configured for 0x1, not 0x2");
  });
});

describe("a burst against a node that holds one play per nonce", () => {
  it("a refused middle play of a burst: its nonce goes to the next order, and no order meets a held nonce", async () => {
    const node = fakeMempool("0xa01", (nonce, attempt) => nonce === 8n && attempt === 1);
    const told = await playAll(node, [1, 2, 3, 4, 5]);
    // 3 waited for 2's answer: refused, so the nonce was read again once 1 landed, and 3 took 8.
    expect(node.sent()).toEqual([
      [7n, 1],
      [8n, 2],
      [8n, 3],
      [9n, 4],
      [10n, 5],
    ]);
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 3],
      [9n, 4],
      [10n, 5],
    ]);
    expect(told).toEqual({ 1: "landed", 2: "refused", 3: "landed", 4: "landed", 5: "landed" });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });

  it("two holes in one burst: each refused nonce goes to the next order, and the refused orders never land", async () => {
    const node = fakeMempool("0xa02", (nonce, attempt) => (nonce === 8n || nonce === 10n) && attempt === 1);
    const told = await playAll(node, [1, 2, 3, 4, 5, 6, 7]);
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 3],
      [9n, 4],
      [10n, 6],
      [11n, 7],
    ]);
    expect(told).toEqual({
      1: "landed",
      2: "refused",
      3: "landed",
      4: "landed",
      5: "refused",
      6: "landed",
      7: "landed",
    });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });

  it("a middle play whose answer was lost, and which the node dropped, holds the next and is never sent again", async () => {
    const node = fakeMempool("0xa03", () => false, 8n);
    const told = await playAll(node, [1, 2, 3, 4]);
    expect(node.sent()).toEqual([
      [7n, 1],
      [8n, 2],
      [8n, 3],
      [9n, 4],
    ]);
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 3],
      [9n, 4],
    ]);
    expect(told).toEqual({ 1: "landed", 2: "no answer", 3: "landed", 4: "landed" });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });

  // Tab B reads nonce 7 while A's 7 and 8 are held: the node rejects B's 7 after forwarding, so B never learns it was
  // refused and is told no answer; its next play reads the nonce again.
  it("two tabs of one account never put two plays at one nonce, and both go on sending", async () => {
    const node = fakeMempool("0xa04", () => false);
    const tabA = [1, 2].map((value) => order(node, value));
    vi.resetModules();
    const otherTab = await import("./submit");
    const fromB = (value: number) =>
      otherTab.executeGameplayAccountTransaction({ account: node.account, calls: valueCall(value), shard: SHARD });
    const told = await outcomes([...tabA, fromB(11)], [1, 2, 11]);
    Object.assign(told, await outcomes([fromB(12)], [12]));
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 2],
      [9n, 12],
    ]);
    expect(told).toEqual({ 1: "landed", 2: "landed", 11: "no answer", 12: "landed" });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });

  it("an account configured while an earlier play is held reads no nonce until the account is idle", async () => {
    // Order 1 is held at 7 for eight blocks; order 2 is refused at 8. A new account object for the same address (a new
    // identity session) is configured while 1 is still held: its order must take 8, not the held 7.
    const node = fakeMempool("0xa06", (nonce, attempt) => nonce === 8n && attempt === 1, undefined, 8);
    const first = order(node, 1);
    const second = order(node, 2);
    void second.catch(() => {});
    await vi.advanceTimersByTimeAsync(60);
    await expect(second).rejects.toMatchObject({ name: "TransactionNotSentError" });
    const reconfigured = configureGameplayAccountSubmits({ ...node.account } as unknown as AccountInterface, SHARD);
    const third = reconfigured.execute(valueCall(3)) as Promise<SentGameplayTransaction>;
    const told = await outcomes([first, second, third], [1, 2, 3]);
    expect(node.sent()).toEqual([
      [7n, 1],
      [8n, 2],
      [8n, 3],
    ]);
    expect(told).toEqual({ 1: "landed", 2: "refused", 3: "landed" });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });

  // The account spends a nonce this queue never numbered: this browser joining as a new device after a sign-in, or
  // another device's play. The next order meets the spent nonce and is refused before forwarding, so it was never
  // sent: it is numbered again from the node and leaves once more.
  it("an order meeting a nonce spent outside the queue is numbered again and sent once more", async () => {
    const node = fakeMempool("0xa07", () => false);
    const told = await outcomes([order(node, 1)], [1]);
    node.spendOutside();
    Object.assign(told, await outcomes([order(node, 2)], [2]));
    expect(node.sent()).toEqual([
      [7n, 1],
      [8n, 2],
      [9n, 2],
    ]);
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 0],
      [9n, 2],
    ]);
    expect(told).toEqual({ 1: "landed", 2: "landed" });
  });

  it("an order whose fresh nonce is spent outside again is refused: it is numbered again only once", async () => {
    const node = fakeMempool("0xa08", () => false);
    await outcomes([order(node, 1)], [1]);
    node.spendOutside();
    node.spendOutsideAfterNextRead();
    const told = await outcomes([order(node, 2)], [2]);
    expect(node.sent()).toEqual([
      [7n, 1],
      [8n, 2],
      [9n, 2],
    ]);
    expect(told).toEqual({ 2: "refused" });
  });

  it("plays sent before a disposal keep their nonces: the next client's plays never displace them", async () => {
    const node = fakeMempool("0xa05", () => false, undefined, 2);
    const disposed = new AbortController();
    const before = [1, 2].map((value) => order(node, value, disposed.signal));
    await Promise.all(before);
    disposed.abort(new Error("Game client disposed"));
    const told = await outcomes(before, [1, 2]);
    Object.assign(told, await outcomes([order(node, 3)], [3]));
    expect(node.landed()).toEqual([
      [7n, 1],
      [8n, 2],
      [9n, 3],
    ]);
    expect(told).toEqual({ 1: "disposed", 2: "disposed", 3: "landed" });
    expect(node.safe()).toEqual({ nonceLandedTwice: false, orderLandedTwice: false, orderSentTwice: false });
  });
});

const valueCall = (value: number) => ({
  contractAddress: "0x1",
  entrypoint: "play",
  calldata: [`0x${value.toString(16)}`],
});
const order = (node: FakeMempool, value: number, stopped?: AbortSignal) =>
  executeGameplayAccountTransaction({ account: node.account, calls: valueCall(value), shard: SHARD, stopped });

/** Sends a burst of orders at once and returns what each order's caller was finally told. */
const playAll = (node: FakeMempool, burst: number[]) =>
  outcomes(
    burst.map((value) => order(node, value)),
    burst,
  );

/** Runs the node's blocks until every order is settled: landed, refused, unanswered or disposed. */
async function outcomes(orders: Promise<SentGameplayTransaction>[], values: number[]) {
  const settled = orders.map((sent) =>
    sent.then(
      (play) =>
        play.inBlock.then(
          () => "landed",
          (error: Error) => (error.name === "TransactionNoAnswerError" ? "no answer" : "disposed"),
        ),
      () => "refused",
    ),
  );
  await vi.advanceTimersByTimeAsync(30_000);
  const told = await Promise.all(settled);
  return Object.fromEntries(values.map((value, index) => [value, told[index]]));
}

type FakeMempool = ReturnType<typeof fakeMempool>;

/**
 * One account behind the stamping RPC on a node that, as the pinned node does, holds one transaction per nonce and
 * executes from the account's nonce upwards, a block every 250 ms. A spent nonce is refused before forwarding; a
 * different play at an occupied nonce is forwarded, rejected by the node, and answered as an unknown outcome.
 * `refuses(nonce, attempt)` plays an admission refusal; `drops` is a nonce whose first play the node takes, loses and
 * never answers. The first `heldBlocks` blocks are empty.
 */
function fakeMempool(
  address: string,
  refuses: (nonce: bigint, attempt: number) => boolean,
  drops?: bigint,
  heldBlocks = 0,
) {
  vi.useFakeTimers();
  let nonce = 7n;
  let blocks = 0;
  const held = new Map<bigint, { hash: string; value: number }>();
  const landed: { nonce: bigint; hash: string; value: number }[] = [];
  const sent: [bigint, number][] = [];
  const attempts = new Map<bigint, number>();
  const produceBlock = () => {
    if ((blocks += 1) <= heldBlocks) return;
    for (let play = held.get(nonce); play; play = held.get(nonce)) {
      landed.push({ nonce, ...play });
      held.delete(nonce);
      nonce += 1n;
    }
  };
  setInterval(produceBlock, 250);
  /** A transaction of this account that no queue numbered (a device join, another device's play), included at once. */
  const spendOutside = () => {
    landed.push({ nonce, hash: `0xf${nonce.toString(16)}`, value: 0 });
    nonce += 1n;
  };
  let spendAfterRead = false;
  return {
    spendOutside,
    /** The next nonce read is answered, then that nonce is spent outside before the play that read it arrives. */
    spendOutsideAfterNextRead: () => {
      spendAfterRead = true;
    },
    sent: () => sent,
    landed: () => landed.map((play) => [play.nonce, play.value]),
    /** What must hold whatever happened: no nonce or order landed twice, no order was sent twice. */
    safe: () => ({
      nonceLandedTwice: new Set(landed.map((play) => play.nonce)).size !== landed.length,
      orderLandedTwice: new Set(landed.map((play) => play.value)).size !== landed.length,
      orderSentTwice: new Set(sent.map(([, value]) => value)).size !== sent.length,
    }),
    account: {
      address,
      execute: vi.fn(async (calls: AllowArray<Call>, details?: UniversalDetails) => {
        const at = BigInt(details!.nonce!);
        const value = Number((calls as Call).calldata![0]);
        const hash = invokeHash(address, calls, details!);
        sent.push([at, value]);
        const attempt = (attempts.get(at) ?? 0) + 1;
        attempts.set(at, attempt);
        if (refuses(at, attempt)) {
          // The refusal comes back after a round trip, as later plays of the burst leave.
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw Object.assign(new Error("Transaction refused"), {
            baseError: { code: -32010, data: { reason: "stamp" } },
          });
        }
        if (at < nonce) {
          throw Object.assign(new Error("Transaction refused"), {
            baseError: { code: -32010, data: { reason: "nonce" } },
          });
        }
        // The node refuses a second play at an occupied nonce after the stamping RPC forwarded it: an unknown outcome.
        if (held.has(at)) throw outcomeUnknown(hash);
        if (at === drops && attempt === 1) {
          // The reply is lost on the way back, after later plays have already left.
          await new Promise((resolve) => setTimeout(resolve, 100));
          throw outcomeUnknown(hash);
        }
        held.set(at, { hash, value });
        return { transaction_hash: hash };
      }),
      getNonce: vi.fn(async () => {
        const answer = `0x${nonce.toString(16)}`;
        if (spendAfterRead) {
          spendAfterRead = false;
          spendOutside();
        }
        return answer;
      }),
      getTransactionStatus: vi.fn(async (transactionHash: string) => {
        if (landed.some((play) => play.hash === transactionHash)) return { finality_status: "PRE_CONFIRMED" };
        if ([...held.values()].some((play) => play.hash === transactionHash)) return { finality_status: "RECEIVED" };
        throw Object.assign(new Error("Transaction hash not found"), { baseError: { code: 29 } });
      }),
    },
  };
}

describe("a send's stages, as the game client reports them", () => {
  /**
   * The game client's submit over a fake shard: every stage it reports, as "send:stage" or "send:stage:detail".
   * Herald reports a play `heraldAfterMs` after it is sent, or never.
   */
  const playedOver = (
    shard: FakeShard,
    heraldAfterMs: number | null,
    onHash?: (stage: SendStage, transactionHash: string | undefined) => void,
  ) => {
    const stages: string[] = [];
    const submit = nativePlay(
      {
        bindings: {
          commandAbi: [{ type: "enum", name: "world_native::commands::Command", variants: [{ name: "Explore" }] }],
        } as unknown as Parameters<typeof nativePlay>[0]["bindings"],
        release: { ready: async () => {} },
        shard: SHARD,
        stopped: new AbortController().signal,
        runtime: {
          recordSubmittedTransaction: () => {},
          waitForTransaction: (hash) =>
            new Promise((resolve) => {
              if (heraldAfterMs !== null)
                setTimeout(() => resolve({ hash, block: null, status: "PRE_CONFIRMED" }), heraldAfterMs);
            }),
        },
        onSendStage: (send: number, stage: SendStage, detail?: string, transactionHash?: string) => {
          stages.push([send, stage, detail].filter((part) => part !== undefined).join(":"));
          onHash?.(stage, transactionHash);
        },
      },
      { require: () => ({ release_id: 1n, preset_commitment: 2n }) } as unknown as Parameters<typeof nativePlay>[1],
      3,
      CALL.contractAddress,
    );
    const play = () =>
      submit(shard.account as unknown as AccountInterface, {
        ...CALL,
        entrypoint: "Explore",
        calldata: ["0x3", "0x0"],
      });
    return { stages, play };
  };

  it("reaches each stage once, in order, from the command to Herald's word and the settled play", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5e01", (invoke) => shard.land(invoke));
    const { stages, play } = playedOver(shard, 300);

    const first = await play();
    const second = await play();
    await vi.advanceTimersByTimeAsync(300);
    await Promise.all([first.inBlock, second.inBlock]);
    await vi.advanceTimersByTimeAsync(0);

    expect(stages.filter((stage) => stage.startsWith("1:"))).toEqual([
      "1:command",
      "1:release-ready",
      "1:left-queue",
      "1:nonce:read",
      "1:answered:proxy",
      "1:included:herald",
      "1:settled",
    ]);
    expect(stages).toContain("2:nonce:known");
  });

  it("with Herald silent, says the node included the play after Herald's wait", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5e02", (invoke) => shard.land(invoke));
    const { stages, play } = playedOver(shard, null);

    const sent = await play();
    await vi.advanceTimersByTimeAsync(11_000);
    expect(stages).not.toContain("1:included:node");
    await vi.advanceTimersByTimeAsync(2_000);
    await sent.inBlock;
    await vi.advanceTimersByTimeAsync(0);

    expect(stages.slice(-2)).toEqual(["1:included:node", "1:settled"]);
  });

  it("with the proxy's reply held and Herald silent, says the node answered and included the play, never Herald", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5e20", (invoke) => {
      shard.land(invoke);
      return new Promise<void>(() => {});
    });
    const { stages, play } = playedOver(shard, null);
    const pending = play();
    await vi.advanceTimersByTimeAsync(13_000);
    await (
      await pending
    ).inBlock;
    await vi.advanceTimersByTimeAsync(0);

    expect(stages.slice(-3)).toEqual(["1:answered:node", "1:included:node", "1:settled"]);
    expect(stages).not.toContain("1:answered:herald");
  });

  it("with the proxy's reply held and Herald reporting, says Herald answered, then included the play", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5e21", (invoke) => {
      shard.land(invoke);
      return new Promise<void>(() => {});
    });
    const { stages, play } = playedOver(shard, 300);
    const pending = play();
    await vi.advanceTimersByTimeAsync(300);
    await (
      await pending
    ).inBlock;
    await vi.advanceTimersByTimeAsync(0);

    expect(stages.slice(-3)).toEqual(["1:answered:herald", "1:included:herald", "1:settled"]);
  });

  it("names the play's hash from its nonce on", async () => {
    vi.useFakeTimers();
    const shard = fakeShard("0x5e22", (invoke) => shard.land(invoke));
    const hashes: Array<[SendStage, string | undefined]> = [];
    const { play } = playedOver(shard, 300, (stage, hash) => hashes.push([stage, hash]));
    const sent = await play();
    await vi.advanceTimersByTimeAsync(300);
    await sent.inBlock;
    await vi.advanceTimersByTimeAsync(0);

    expect(hashes).toEqual([
      ["command", undefined],
      ["release-ready", undefined],
      ["left-queue", undefined],
      ["nonce", sent.transaction_hash],
      ["answered", sent.transaction_hash],
      ["included", sent.transaction_hash],
      ["settled", sent.transaction_hash],
    ]);
  });

  it("a refused send settles with its error's name and was never answered", async () => {
    const shard = fakeShard("0x5e03", () => {
      throw Object.assign(new Error("Invalid transaction nonce"), { code: 52 });
    });
    const { stages, play } = playedOver(shard, null);

    await expect(play()).rejects.toThrow();

    expect(stages).toEqual([
      "1:command",
      "1:release-ready",
      "1:left-queue",
      "1:nonce:read",
      "1:settled:TransactionNotSentError",
    ]);
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
/**
 * Stops each test's fake node when the test ends. Its client may still be polling for an answer; a node that stops
 * answering parks that poll, so it never sets a timer on a later test's clock.
 */
const endWithTest: Array<() => void> = [];
const silence = () => new Promise<never>(() => {});

function fakeShard(
  address: string,
  onSend: (invoke: SentInvoke) => { transaction_hash: string } | void | Promise<void>,
) {
  const statuses = new Map<string, "RECEIVED" | "PRE_CONFIRMED">();
  const sent: SentInvoke[] = [];
  let ended = false;
  endWithTest.push(() => (ended = true));
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
        if (ended) return silence();
        const invoke = { hash: invokeHash(address, calls, details!), nonce: String(details!.nonce) };
        sent.push(invoke);
        const response = await onSend(invoke);
        return response ?? { transaction_hash: invoke.hash };
      }),
      getNonce: vi.fn(async () => {
        if (ended) return silence();
        if (!shard.nonceReadable) throw new Error("upstream timed out");
        return `0x${shard.nonce.toString(16)}`;
      }),
      getTransactionStatus: vi.fn(async (transactionHash: string) => {
        if (ended) return silence();
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

/** The stamping proxy tried to forward this invoke and cannot say whether the node took it. */
const outcomeUnknown = (transactionHash?: string) =>
  Object.assign(new Error("Transaction outcome unknown"), {
    baseError: { code: -32011, ...(transactionHash ? { data: { transaction_hash: transactionHash } } : {}) },
  });

/** Flushes every pending microtask and the next macrotask. */
function endOfMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
