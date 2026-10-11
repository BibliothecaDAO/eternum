import { expect, test } from "bun:test";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { now } from "./clock";

if (isMainThread) {
  test("sender workers and observer use the same monotonic clock", async () => {
    const before = now();
    const workers = Array.from({ length: 8 }, () => new Worker(new URL(import.meta.url)));
    const timestamps = await Promise.all(
      workers.map(
        (worker) =>
          new Promise<bigint>((resolve, reject) => {
            worker.once("message", (value: string) => resolve(BigInt(value)));
            worker.once("error", reject);
          }),
      ),
    );
    const after = now();
    for (const timestamp of timestamps) {
      expect(timestamp >= before).toBe(true);
      expect(timestamp <= after).toBe(true);
    }
    await Promise.all(workers.map((worker) => worker.terminate()));
  });
} else {
  parentPort!.postMessage(now().toString());
  parentPort!.close();
}
