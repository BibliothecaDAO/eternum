import { VRF_STAMP_TAG } from "./wire";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import type { Invoke } from "./transaction";

const [keyFile, dataset, chain, output, backend = "js"] = process.argv.slice(2);
if (!keyFile || !dataset || !chain || !output)
  throw new Error("Usage: bun profile.ts PRIVATE_KEY TXS_JSON CHAIN OUTPUT_JSON");
const txs = JSON.parse(readFileSync(dataset, "utf8")) as Invoke[];
interface Stages {
  hashMs: number;
  inputEncodingMs: number;
  nativeMs: number;
  suffixEncodingMs: number;
}
async function measure(threads: number, echo: boolean) {
  const workers: Worker[] = [];
  const jobs = new Map<
    number,
    { resolve: (result: { proof: string[]; stages: Stages }) => void; reject: (error: Error) => void }
  >();
  const ready = Promise.all(
    Array.from({ length: threads }, () => {
      const worker = new Worker(new URL("./profile-worker.ts", import.meta.url).href);
      workers.push(worker);
      return new Promise<void>((resolve, reject) => {
        worker.onmessage = (event) => {
          const result = event.data;
          if (result.kind === "ready") resolve();
          else {
            jobs.get(result.id)?.resolve(result);
            jobs.delete(result.id);
          }
        };
        worker.onerror = () => {
          const error = new Error("Profile worker failed");
          reject(error);
          for (const job of jobs.values()) job.reject(error);
        };
        worker.postMessage({ kind: "initialize", keyFile });
      });
    }),
  );
  try {
    await ready;
    let id = 0;
    let dispatchMs = 0,
      appendMs = 0,
      serializationMs = 0;
    const totals: Stages = { hashMs: 0, inputEncodingMs: 0, nativeMs: 0, suffixEncodingMs: 0 };
    const send = async (tx: Invoke) => {
      const jobId = id++;
      const promise = new Promise<{ proof: string[]; stages: Stages }>((resolve, reject) =>
        jobs.set(jobId, { resolve, reject }),
      );
      const before = performance.now();
      if (backend === "native") {
        const raw = new TextEncoder().encode(JSON.stringify(tx)).buffer;
        const encoded = performance.now();
        serializationMs += encoded - before;
        workers[jobId % threads].postMessage({ id: jobId, raw, chain, echo, native: true }, [raw]);
        dispatchMs += performance.now() - encoded;
      } else workers[jobId % threads].postMessage({ id: jobId, tx, chain, echo });
      if (backend !== "native") dispatchMs += performance.now() - before;
      const result = await promise;
      for (const key of Object.keys(totals) as (keyof Stages)[]) totals[key] += result.stages[key];
      const append = performance.now();
      const stamped = { ...tx, signature: [...tx.signature, VRF_STAMP_TAG, ...result.proof] };
      appendMs += performance.now() - append;
      return stamped;
    };
    await Promise.all(txs.slice(0, 16).map(send));
    id = 0;
    dispatchMs = 0;
    appendMs = 0;
    serializationMs = 0;
    for (const key of Object.keys(totals) as (keyof Stages)[]) totals[key] = 0;
    const before = performance.now();
    await Promise.all(txs.map(send));
    return {
      threads,
      echo,
      transactions: txs.length,
      wallMs: performance.now() - before,
      mainDispatchCloneMs: dispatchMs,
      mainSerializationMs: serializationMs,
      mainSuffixAppendMs: appendMs,
      workerStageTotalsMs: totals,
    };
  } finally {
    for (const worker of workers) worker.terminate();
  }
}
const rows = [];
for (const threads of [1, 2, 4, 8]) {
  rows.push(await measure(threads, true));
  rows.push(await measure(threads, false));
}
const report = {
  backend,
  machine: cpus()[0]?.model,
  scope:
    "Laptop only; worker stage totals are aggregate CPU/wall durations across jobs, NOT an additive decomposition of concurrent elapsed time; echo isolates dispatch/clone/reply/append without hash/proof",
  rows,
};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
