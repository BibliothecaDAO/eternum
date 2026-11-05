import { RpcError, type ProviderInterface, type TypedData } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

import { forgetUncertain, rememberUncertain, standingOf, uncertainSendOf, type UncertainSend } from "./uncertain-sends";

const WALLET = "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f";
/** The node's own "not found" answers, as starknet.js raises them. */
const notFound = (code: 20 | 29, message: "Contract not found" | "Transaction hash not found") =>
  new RpcError({ code, message } as ConstructorParameters<typeof RpcError>[0], "starknet_x", {});
const execution = { message: { Nonce: "0x77", "Execute Before": 2_000 } } as unknown as TypedData;
const passkeySend = (hash: string | null = null): UncertainSend => ({
  via: "passkey",
  owner: WALLET,
  calls: "[]",
  execution,
  ownerSignature: ["0x4"],
  hash,
  at: Date.now(),
});
/** The chain as an uncertain send's reads see it: the nonce's state, the head's time, and the receipt if any. */
const chain = (options: { nonceValid?: boolean | "undeployed"; now?: number; receipt?: object | "missing" }) =>
  ({
    callContract: vi.fn(async () => {
      if (options.nonceValid === "undeployed") throw notFound(20, "Contract not found");
      return [options.nonceValid === false ? "0x0" : "0x1"];
    }),
    getBlockWithTxHashes: vi.fn(async () => ({ block_number: 1, timestamp: options.now ?? 1_000 })),
    getTransactionReceipt: vi.fn(async () => {
      if (!options.receipt || options.receipt === "missing") throw notFound(29, "Transaction hash not found");
      return options.receipt;
    }),
  }) as unknown as ProviderInterface;

afterEach(() => forgetUncertain(WALLET));

it("keeps one uncertain send per wallet in this browser, the newest", () => {
  rememberUncertain(passkeySend());
  rememberUncertain(passkeySend("0xtx"));
  expect(uncertainSendOf(WALLET)).toMatchObject({ hash: "0xtx" });
  forgetUncertain(WALLET);
  expect(uncertainSendOf(WALLET)).toBeUndefined();
});

it("calls a default wallet's send landed once its nonce is spent, whatever else is known", async () => {
  expect(await standingOf(chain({ nonceValid: false }), passkeySend())).toEqual({ kind: "landed" });
});

it("calls it never sendable once its window has closed with the nonce unspent, and pending before", async () => {
  expect(await standingOf(chain({ nonceValid: true, now: 2_000 }), passkeySend())).toEqual({
    kind: "failed",
    reason: null,
  });
  expect(await standingOf(chain({ nonceValid: true, now: 1_999 }), passkeySend())).toEqual({ kind: "pending" });
  expect(await standingOf(chain({ nonceValid: "undeployed", now: 1_000 }), passkeySend())).toEqual({ kind: "pending" });
});

it("says why a default wallet's send reverted", async () => {
  const reverted = { isReverted: () => true, revert_reason: "Ledger: already registered" };
  expect(await standingOf(chain({ nonceValid: true, receipt: reverted }), passkeySend("0xtx"))).toEqual({
    kind: "failed",
    reason: "Ledger: already registered",
  });
});

it("reads a connected wallet's send by its receipt only: unheard of, it stays pending however old", async () => {
  const send = (at: number): UncertainSend => ({ via: "wallet", owner: WALLET, calls: "[]", hash: "0xtx", at });
  const ran = { isSuccess: () => true };
  expect(await standingOf(chain({ receipt: ran }), send(Date.now()))).toEqual({ kind: "landed" });
  expect(await standingOf(chain({ receipt: "missing" }), send(Date.now()))).toEqual({ kind: "pending" });
  expect(await standingOf(chain({ receipt: "missing" }), send(Date.now() - 48 * 60 * 60 * 1000))).toEqual({
    kind: "pending",
  });
});

it("holds a connected wallet's send whose hash was never kept as pending, never failed by elapsed time", async () => {
  const intent = (at: number): UncertainSend => ({ via: "wallet", owner: WALLET, calls: "[]", hash: null, at });
  expect(await standingOf(chain({}), intent(Date.now()))).toEqual({ kind: "pending" });
  expect(await standingOf(chain({}), intent(Date.now() - 48 * 60 * 60 * 1000))).toEqual({ kind: "pending" });
});

it("reads a default wallet's nonce and deadline at one block: a send landing at its deadline never reads as failed", async () => {
  // Block 100 at 1,998: nonce unspent. The transfer lands at block 101 (1,999); block 102 is at 2,001, past its window.
  let head = 100;
  const seenAt: unknown[] = [];
  const advancing = {
    getBlockWithTxHashes: async () => ({ block_number: head, timestamp: head === 100 ? 1_998 : 2_001 }),
    callContract: async (_call: unknown, block: unknown) => {
      seenAt.push(block);
      const at = typeof block === "number" ? block : 102;
      head = 102;
      return [at >= 101 ? "0x0" : "0x1"];
    },
    getTransactionReceipt: async () => Promise.reject(notFound(29, "Transaction hash not found")),
  } as unknown as ProviderInterface;
  // Pinned to block 100: unspent with its window still open, so pending: never "failed", never a new payment.
  expect(await standingOf(advancing, passkeySend())).toEqual({ kind: "pending" });
  expect(seenAt).toEqual([100]);
  // Asked again once the chain has moved: block 102, the nonce spent there, so the transfer landed.
  expect(await standingOf(advancing, passkeySend())).toEqual({ kind: "landed" });
});
