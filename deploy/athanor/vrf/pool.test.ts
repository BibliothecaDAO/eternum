import { expect, test } from "bun:test";
import { startStampPool } from "./pool";
import { identity, invoke } from "./fixtures";

// Exercise a runtime worker failure independently of native per-job refusal.
test("a dead worker is replaced and does not reject the surviving lane's work", async () => {
  const workers: FakeWorker[] = [];
  const stamp = { transactionHash: "0x777", suffix: [] };
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    onerror?: (event: { preventDefault(): void }) => void;
    dead = false;
    constructor() {
      workers.push(this);
    }
    postMessage(message: { kind: string; id: number }) {
      if (message.kind === "start")
        queueMicrotask(() => this.onmessage?.({ data: { kind: "ready", publicKey: identity.vrfPublicKey } }));
      else if (workers[0] === this) queueMicrotask(() => this.onerror?.({ preventDefault() {} }));
      else queueMicrotask(() => this.onmessage?.({ data: { kind: "stamp", id: message.id, stamp } }));
    }
    terminate() {
      this.dead = true;
    }
  }
  const originalWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  let pool: Awaited<ReturnType<typeof startStampPool>> | undefined;
  try {
    pool = await startStampPool("unused", identity, 2);
    const jobs = await Promise.allSettled([pool.stamp(invoke()), pool.stamp(invoke()), pool.stamp(invoke())]);
    expect(jobs.map((job) => job.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
    expect(workers[0].dead).toBe(true);
    await Bun.sleep(1100);
    expect(workers).toHaveLength(3);
    expect(await Promise.all([pool.stamp(invoke()), pool.stamp(invoke())])).toEqual([stamp, stamp]);
  } finally {
    pool?.close();
    globalThis.Worker = originalWorker;
  }
});
