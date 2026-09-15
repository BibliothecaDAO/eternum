import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import type { GameClient } from "@bibliothecadao/eternum";
import type { GameClientObserver } from "@bibliothecadao/eternum/game-client";
import type { HeraldSocket } from "@bibliothecadao/eternum/game-sync";
import type { RpcProvider } from "starknet";

export interface SliceActionEvidence {
  action: string;
  layer: "surface" | "ethereal";
  transactionHash: string;
  blockNumber: number;
  submitMs: number;
  recsAppliedMs: number;
  executionMs: number;
  preconfirmedRowMs: number | null;
  executionResources: unknown;
  events: number;
  eventFelts: number;
}

/** Timing observations contain no current gameplay facts; those are read from the client's RECS world. */
export function observeActions() {
  const applied = new Map<string, number>();
  const preconfirmed = new Set<string>();
  let failure: Error | undefined;
  const observer: GameClientObserver = {
    onRecsApplied: (hash) => {
      if (!applied.has(BigInt(hash).toString())) applied.set(BigInt(hash).toString(), performance.now());
    },
    onLiveApplyFailed: (error) => {
      failure = error;
    },
  };
  return {
    observer,
    socketFactory: (url: string) => {
      const socket = new WebSocket(url);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          type: string;
          preconfirmed?: boolean;
          transaction_hash?: string;
        };
        if (message.type === "diff" && message.preconfirmed && message.transaction_hash)
          preconfirmed.add(BigInt(message.transaction_hash).toString());
      });
      return socket as unknown as HeraldSocket;
    },
    async measure(
      client: GameClient,
      provider: RpcProvider,
      action: string,
      layer: SliceActionEvidence["layer"],
      submit: () => Promise<{ transaction_hash: string }>,
    ): Promise<SliceActionEvidence> {
      const started = performance.now();
      const since = new Date().toISOString();
      const deadline = AbortSignal.timeout(30_000);
      const complete = async () => {
        const transaction = await submit();
        const submitMs = performance.now() - started;
        await client.runtime.waitForTransaction(transaction.transaction_hash);
        if (failure) throw failure;
        const identity = BigInt(transaction.transaction_hash).toString();
        while (!applied.has(identity)) {
          if (failure) throw failure;
          await sleep(1, undefined, { signal: deadline });
        }
        const appliedAt = applied.get(identity)!;
        const receipt = await confirmedReceipt(provider, transaction.transaction_hash, deadline);
        const executionMs = executionTime(since, receipt.block_number);
        return {
          action,
          layer,
          transactionHash: transaction.transaction_hash,
          blockNumber: receipt.block_number,
          submitMs,
          recsAppliedMs: appliedAt - started,
          preconfirmedRowMs: preconfirmed.has(BigInt(transaction.transaction_hash).toString())
            ? appliedAt - started
            : null,
          executionMs,
          executionResources: receipt.execution_resources,
          events: receipt.events.length,
          eventFelts: receipt.events.reduce((total, event) => total + event.keys.length + event.data.length, 0),
        };
      };
      return bounded(complete(), deadline);
    },
  };
}

async function confirmedReceipt(provider: RpcProvider, hash: string, signal: AbortSignal) {
  while (!signal.aborted) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!("execution_status" in receipt)) throw new Error(`Receipt unavailable: ${hash}`);
    if (receipt.execution_status === "REVERTED") throw new Error(`Slice action reverted: ${receipt.revert_reason}`);
    if ("block_number" in receipt && typeof receipt.block_number === "number") return receipt;
    await sleep(100, undefined, { signal });
  }
  throw signal.reason;
}

/** The unchanged lab image records execution time per batch. Attribute only an isolated one-transaction batch. */
function executionTime(since: string, block: number): number {
  const output = execFileSync("docker", ["logs", "--since", since, "madara-lab"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 8 * 1024 * 1024,
  });
  return parseExecutionTime(output, block);
}

export function parseExecutionTime(output: string, block: number): number {
  const matches = [
    ...output.matchAll(
      /Executed and added (\d+) transaction\(s\) to the preconfirmed block at height (\d+) - ([\d.]+)(µs|ms|s)/g,
    ),
  ].filter((match) => Number(match[2]) === block);
  if (matches.length !== 1 || matches[0][1] !== "1")
    throw new Error(`Cannot attribute execution time for block ${block} to one action`);
  const [, , , value, unit] = matches[0];
  return Number(value) * (unit === "s" ? 1000 : unit === "µs" ? 0.001 : 1);
}

async function bounded<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort: () => void = () => {};
  const timeout = new Promise<never>((_, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
