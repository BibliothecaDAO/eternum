import { Worker } from "node:worker_threads";

export async function burst(
  url: string,
  payloads: { hash: string; body: string }[],
  count: number,
  before: () => void | Promise<void>,
) {
  if (!Number.isSafeInteger(count) || count < 1 || payloads.length === 0)
    throw new Error("Nonempty burst and positive worker count required");
  const barrier = new SharedArrayBuffer(4);
  const gate = new Int32Array(barrier);
  const width = Math.ceil(payloads.length / count);
  const jobs = Array.from({ length: count }, (_, i) => payloads.slice(i * width, (i + 1) * width))
    .filter((p) => p.length)
    .map((group) => {
      const worker = new Worker(new URL("./send-worker.ts", import.meta.url), {
        workerData: { url, payloads: group, barrier },
      });
      let rows: { hash: string; sentNs: string; acknowledgedNs: string | null; error: string | null }[] | undefined;
      let ready!: () => void;
      let failReady!: (error: Error) => void;
      const initialized = new Promise<void>((ok, bad) => {
        ready = ok;
        failReady = bad;
      });
      const finished = new Promise<typeof rows>((ok, bad) => {
        worker.on("message", (value) => {
          if (value.ready) ready();
          if (value.rows) rows = value.rows;
          if (value.failed) {
            failReady(new Error("sender failed"));
            bad(new Error("sender failed"));
          }
        });
        worker.on("error", (error) => {
          failReady(error);
          bad(error);
        });
        worker.on("exit", (code) => {
          if (code === 0 && rows) ok(rows);
          else {
            const error = new Error("sender did not finish cleanly");
            failReady(error);
            bad(error);
          }
        });
      });
      finished.catch(() => {});
      return { worker, initialized, finished };
    });
  try {
    await Promise.all(jobs.map((j) => j.initialized));
    await before();
    Atomics.store(gate, 0, 1);
    Atomics.notify(gate, 0);
    return (await Promise.all(jobs.map((j) => j.finished))).flatMap((v) => v ?? []);
  } finally {
    await Promise.all(jobs.map((j) => j.worker.terminate()));
  }
}
