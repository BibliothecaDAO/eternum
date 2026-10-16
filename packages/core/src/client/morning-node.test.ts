// The dev node's 2026-10-12 visibility gap under the real provider, gameplay submit and outcome wait:
//   - a transaction is admitted, executed 200 ms later, and from then the node answers "hash not found" (code 29) for
//     GAP_MS; only afterwards do by-hash reads and the pre-confirmed nonce show it
//   - a send at a nonce the mempool has already taken is refused by the node (code 52)
//   - Herald reports the transaction applied HERALD_MS after admission (or never, when HERALD_MS is null)
// Two clicks of one player: the first at 0 s, the second at 1 s. The timeline printed is what the player gets.
import { EternumProvider } from "@bibliothecadao/provider";
import type { Abi, AccountInterface } from "starknet";
import { afterEach, expect, it, vi } from "vitest";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";

import { executeGameplayAccountTransaction } from "./submit";
import { waitForActionOutcome } from "./transaction-outcome";

const SHARD = { chainId: "0x1", l2GasBound: 0x47868c00n };
const GAMES = "0x77";

afterEach(() => vi.useRealTimers());

// The submit keeps its bookkeeping per chain and address for the life of the page: each case plays its own account,
// except the last, which replays an address on a chain whose nonce went back (a shard restarted under an open page).
let accounts = 0;
const scenario = async (
  GAP_MS: number,
  HERALD_MS: number | null,
  verdictOf: "applied" | "REVERTED" = "applied",
  address = `0x${(0x1000 + ++accounts).toString(16)}`,
  // What happens to the FIRST send on the wire: the request never reaches the node, or the node takes it and the
  // reply is lost. Either way the client gets a network error with no RPC code.
  firstSend: "ok" | "never-arrives" | "reply-lost" = "ok",
) => {
  vi.useFakeTimers();
  const t0 = Date.now();
  const at = () => `${((Date.now() - t0) / 1000).toFixed(2)}s`;
  const timeline: string[] = [];
  const admitted = new Map<string, { nonce: number; admittedAt: number }>();
  let mempoolNonce = 5;
  const visible = (tx: { admittedAt: number }) => Date.now() - tx.admittedAt >= 200 + GAP_MS;
  const executed = (tx: { admittedAt: number }) => Date.now() - tx.admittedAt >= 200;
  const notFound = () => Object.assign(new Error("Transaction hash not found"), { code: 29, baseError: { code: 29 } });
  let sends = 0;
  const account = {
    address,
    getNonce: vi.fn(async () => `0x${(5 + [...admitted.values()].filter(visible).length).toString(16)}`),
    getTransactionStatus: vi.fn(async (hash: string) => {
      const tx = admitted.get(hash);
      if (!tx) throw notFound();
      if (!executed(tx)) return { finality_status: "RECEIVED" };
      if (!visible(tx)) throw notFound();
      return {
        finality_status: "ACCEPTED_ON_L2",
        execution_status: verdictOf === "applied" ? "SUCCEEDED" : "REVERTED",
      };
    }),
    execute: vi.fn(async (_calls: unknown, frame: { nonce: string }) => {
      const nonce = Number(BigInt(frame.nonce));
      const fault = sends === 0 ? firstSend : "ok";
      if (fault === "never-arrives") {
        timeline.push(`${at()}  send #${++sends} at nonce ${nonce}: NETWORK ERROR, the request never reached the node`);
        throw new TypeError("Failed to fetch");
      }
      if (fault === "reply-lost" && nonce === mempoolNonce) {
        mempoolNonce += 1;
        admitted.set(lastHeraldAsk, { nonce, admittedAt: Date.now() });
        timeline.push(`${at()}  send #${++sends} at nonce ${nonce}: admitted by the node, REPLY LOST`);
        throw new TypeError("Failed to fetch");
      }
      if (nonce !== mempoolNonce) {
        timeline.push(
          `${at()}  send #${++sends} at nonce ${nonce}: NODE REFUSES (code 52, mempool is at ${mempoolNonce})`,
        );
        throw Object.assign(new Error("Invalid transaction nonce"), { code: 52, baseError: { code: 52 } });
      }
      mempoolNonce += 1;
      const hash = `0x${(0xa0 + nonce).toString(16)}`;
      admitted.set(hash, { nonce, admittedAt: Date.now() });
      timeline.push(`${at()}  send #${++sends} at nonce ${nonce}: admitted as ${hash}`);
      return { transaction_hash: hash };
    }),
  } as unknown as AccountInterface;
  let lastHeraldAsk = "";
  const runtime = {
    waitForTransaction: (hash: string) =>
      new Promise<{ block: number | null; hash: string; status: string; revertReason?: string }>((resolve, reject) => {
        lastHeraldAsk = hash;
        if (HERALD_MS === null)
          return reject(new Error("The active game sync session has no transaction status channel"));
        if (HERALD_MS === Infinity) return; // connected, but it never reports this hash
        const poll = setInterval(() => {
          const tx = admitted.get(hash);
          if (!tx || Date.now() - tx.admittedAt < HERALD_MS) return;
          clearInterval(poll);
          resolve(
            verdictOf === "applied"
              ? { block: null, hash, status: "PRE_CONFIRMED" }
              : { block: null, hash, status: "REVERTED", revertReason: "not enough stamina" },
          );
        }, 50);
      }),
    subscribeResynced: () => () => {},
  };
  const rpc = {
    getTransactionReceipt: vi.fn(async (hash: string) => {
      const tx = admitted.get(hash);
      if (!tx || !visible(tx)) throw notFound();
      return {
        transaction_hash: hash,
        block_number: 12,
        finality_status: "ACCEPTED_ON_L2",
        execution_status: verdictOf === "applied" ? "SUCCEEDED" : "REVERTED",
        ...(verdictOf === "applied" ? {} : { revert_reason: "not enough stamina" }),
        events: [],
      };
    }),
  };
  const stopped = new AbortController();
  const provider = new EternumProvider({ world: GAMES }, "http://127.0.0.1:1", { gameId: 7 });
  provider.setNativeSubmission(
    (actor, calls) =>
      executeGameplayAccountTransaction({
        account: actor as never,
        calls,
        shard: SHARD,
        stopped: stopped.signal,
        // Native submission subscribes before forwarding.
        waitForTransaction: (hash: string) => runtime.waitForTransaction(hash),
      } as never),
    bindings.commandAbi as Abi,
    () => 9,
  );
  provider.setTransactionStreamWaiter((hash, inBlock, type, startedAt) =>
    waitForActionOutcome(runtime as never, rpc as never, GAMES, hash, stopped.signal, inBlock, type, startedAt),
  );
  for (const name of ["transactionComplete", "transactionFailed", "transactionChecking"] as const)
    provider.on(
      name,
      (payload: { transactionHash?: string; details?: { transaction_hash: string }; message?: string }) =>
        timeline.push(
          `${at()}  ${name} ${payload.transactionHash ?? payload.details?.transaction_hash ?? ""} ${payload.message ?? ""}`.trimEnd(),
        ),
    );
  const click = (value: number) =>
    provider.claim_wonder_points({ signer: account, value }).then(
      () => undefined,
      (error) =>
        timeline.push(`${at()}  click ${value} REJECTED at send: ${String(error?.message ?? error).slice(0, 80)}`),
    );
  void click(1);
  await vi.advanceTimersByTimeAsync(1_000);
  void click(2);
  await vi.advanceTimersByTimeAsync(44_000);
  stopped.abort(new Error("scenario over"));
  await vi.advanceTimersByTimeAsync(10);
  const reads = {
    status: (account.getTransactionStatus as ReturnType<typeof vi.fn>).mock.calls.length,
    nonce: (account.getNonce as ReturnType<typeof vi.fn>).mock.calls.length,
    receipt: rpc.getTransactionReceipt.mock.calls.length,
  };
  return { timeline, reads, sends };
};

it.each([
  ["healthy node (no gap), Herald at 0.3 s", 0, 300, "applied"],
  ["this morning: 19 s hash gap, Herald at 0.3 s", 19_000, 300, "applied"],
  ["this morning's node, Herald silent (socket down)", 19_000, null, "applied"],
  ["healthy node, Herald silent (socket down)", 0, null, "applied"],
  ["19 s gap, the action REVERTS, Herald at 0.3 s", 19_000, 300, "REVERTED"],
  ["healthy node, the action REVERTS, Herald silent", 0, null, "REVERTED"],
  ["healthy node, Herald connected but never reports the hash", 0, Infinity, "applied"],
  ["this morning's node, Herald connected but never reports the hash", 19_000, Infinity, "applied"],
  [
    "healthy node, same page, the chain's nonce went back to 5 (first run of this address used 5 and 6)",
    0,
    300,
    "applied",
    "0xfeed",
  ],
  ["healthy node, same page, same address again", 0, 300, "applied", "0xfeed"],
  [
    "healthy node, Herald 0.3 s, the first send never reaches the node (network error)",
    0,
    300,
    "applied",
    undefined,
    "never-arrives",
  ],
  [
    "healthy node, Herald 0.3 s, the first send lands but its reply is lost",
    0,
    300,
    "applied",
    undefined,
    "reply-lost",
  ],
  [
    "this morning's node, Herald 0.3 s, the first send lands but its reply is lost",
    19_000,
    300,
    "applied",
    undefined,
    "reply-lost",
  ],
] as const)(
  "%s",
  async (name, gap, herald, verdict, address?: string, firstSend?: "ok" | "never-arrives" | "reply-lost") => {
    const { timeline, reads, sends } = await scenario(gap, herald, verdict, address, firstSend);
    console.log(`\n=== ${name}\n${timeline.join("\n")}\nnode reads in 45 s: ${JSON.stringify(reads)}`);
    expect(sends).toBe(2);
    expect(timeline.join("\n")).not.toMatch(/not sent \(dropped|not sent \(replaced/);
    if (firstSend === "never-arrives") {
      expect(timeline.some((line) => line.startsWith("12.00s  transactionFailed") && line.includes("No answer"))).toBe(
        true,
      );
      expect(timeline.some((line) => line.startsWith("12.00s  send #2"))).toBe(true);
      expect(timeline.some((line) => line.startsWith("12.30s  transactionComplete"))).toBe(true);
    } else if (herald === 300 && !name.includes("same address again")) {
      expect(timeline.some((line) => line.startsWith("0.30s  transaction"))).toBe(true);
      expect(timeline.some((line) => line.startsWith("1.00s  send #2 at nonce 6"))).toBe(true);
      expect(reads.status).toBe(0);
      expect(reads.receipt).toBe(0);
    } else if (name.includes("same address again")) {
      expect(timeline.some((line) => line.startsWith("0.00s") && line.includes("The shard refused this action."))).toBe(
        true,
      );
      expect(timeline.some((line) => line.startsWith("1.00s  send #2 at nonce 5"))).toBe(true);
    } else {
      expect(timeline.some((line) => /^1[24]\.00s  send #2/.test(line))).toBe(true);
    }
  },
);
