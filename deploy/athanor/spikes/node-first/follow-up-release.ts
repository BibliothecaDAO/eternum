import { existsSync, openSync, closeSync, fstatSync, readSync } from "node:fs";
import { load, now } from "./common";

export type Trigger = { observedNs: string; targetNs: string; requestedOffsetMs: number; kind: string; block?: number };
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

export async function waitForLastReceipt(file: string, offsetMs: number, timeoutMs: number): Promise<Trigger> {
  if (![0, 250, 1000].includes(offsetMs)) throw new Error("Follow-up offset must be 0, 250 or 1000 ms");
  const deadline = now() + BigInt(timeoutMs) * 1000000n;
  while (now() < deadline) {
    if (existsSync(file)) {
      const checkpoint = load<{ lastReceiptNs: string | null; completed: number }>(file);
      if (checkpoint.completed !== 2000 || !checkpoint.lastReceiptNs) throw new Error("Primary burst did not complete");
      const target = BigInt(checkpoint.lastReceiptNs) + BigInt(offsetMs) * 1000000n;
      while (now() < target) await pause();
      return {
        observedNs: checkpoint.lastReceiptNs,
        targetNs: String(target),
        requestedOffsetMs: offsetMs,
        kind: "last burst receipt",
      };
    }
    await pause();
  }
  throw new Error("Primary receipt checkpoint deadline; no follow-up submitted");
}

export async function waitForNonemptyClose(file: string, timeoutMs: number, ready: () => void): Promise<Trigger> {
  const descriptor = openSync(file, "r");
  let position = fstatSync(descriptor).size,
    remainder = "";
  const executed = new Set<number>();
  const deadline = now() + BigInt(timeoutMs) * 1000000n;
  ready();
  try {
    while (now() < deadline) {
      const length = fstatSync(descriptor).size - position;
      if (length > 0) {
        const buffer = Buffer.alloc(Math.min(length, 65536));
        const count = readSync(descriptor, buffer, 0, buffer.length, position);
        position += count;
        const lines = (remainder + buffer.toString("utf8", 0, count)).split("\n");
        remainder = lines.pop()!;
        for (const line of lines) {
          const batch = line.match(/received_executor_batch_executed block_number=(\d+).*txs_added_to_block=(\d+)/);
          if (batch && Number(batch[2]) > 0) executed.add(Number(batch[1]));
          const close = line.match(/close_block_worker_started block_number=(\d+)/);
          if (close && executed.has(Number(close[1]))) {
            const at = String(now());
            return {
              observedNs: at,
              targetNs: at,
              requestedOffsetMs: 0,
              kind: "observed nonempty close worker start",
              block: Number(close[1]),
            };
          }
        }
      }
      await pause();
    }
    throw new Error("Nonempty close-worker deadline; no follow-up submitted");
  } finally {
    closeSync(descriptor);
  }
}
