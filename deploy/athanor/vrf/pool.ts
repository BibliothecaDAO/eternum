import type { Stamp, StampProvider } from "./native";
import { felt, type PlayIdentity, type PlayInvoke } from "./transaction";

interface Job {
  id: number;
  raw: ArrayBuffer;
  resolve: (stamp: Stamp) => void;
  reject: (error: Error) => void;
}
interface Lane {
  worker: Worker;
  job?: Job;
  cancelStartup(): void;
}
const LIMIT = 4096;
const refused = () => new Error("Transaction refused");
export function workerCount(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value) || Number(value) > 64)
    throw new Error("VRF_WORKERS must be an explicit integer from 1 to 64");
  return Number(value);
}
function startLane(keyFile: string, identity: PlayIdentity, finish: () => void, stop: () => void) {
  const worker = new Worker(new URL("./worker.ts", import.meta.url).href);
  let ready = false,
    cancelStartup = () => {};
  const lane: Lane = {
    worker,
    cancelStartup() {
      cancelStartup();
    },
  };
  const started = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(failed, 30000);
    cancelStartup = () => {
      clearTimeout(timer);
      reject(refused());
    };
    function failed() {
      cancelStartup();
      stop();
    }
    worker.onerror = (event) => {
      event.preventDefault();
      failed();
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (!ready) {
        if (
          message.kind !== "ready" ||
          felt(message.publicKey?.x) !== felt(identity.vrfPublicKey.x) ||
          felt(message.publicKey?.y) !== felt(identity.vrfPublicKey.y)
        ) {
          failed();
          return;
        }
        ready = true;
        clearTimeout(timer);
        resolve();
        return;
      }
      const job = lane.job;
      if (!job || message.id !== job.id || message.kind !== "stamp") {
        failed();
        return;
      }
      lane.job = undefined;
      job.resolve(message.stamp);
      finish();
    };
    worker.postMessage({ kind: "start", keyFile, chainId: identity.chainId });
  });
  return { lane, started };
}
export async function startStampPool(
  keyFile: string,
  identity: PlayIdentity,
  count: number,
): Promise<StampProvider & { close(): void }> {
  if (!Number.isInteger(count) || count < 1 || count > 64) throw new Error("Invalid VRF worker count");
  const lanes: Lane[] = [],
    queue: Job[] = [];
  let nextId = 0,
    closed = false;
  function close() {
    if (closed) return;
    closed = true;
    for (const lane of lanes) {
      lane.cancelStartup();
      lane.job?.reject(refused());
      lane.job = undefined;
      lane.worker.terminate();
    }
    for (const job of queue.splice(0)) job.reject(refused());
  }
  function dispatch() {
    if (closed) return;
    for (const lane of lanes) {
      if (lane.job) continue;
      const job = queue.shift();
      if (!job) return;
      lane.job = job;
      lane.worker.postMessage({ kind: "stamp", id: job.id, raw: job.raw }, [job.raw]);
    }
  }
  const workers = Array.from({ length: count }, () => startLane(keyFile, identity, dispatch, close));
  lanes.push(...workers.map((worker) => worker.lane));
  try {
    await Promise.all(workers.map((worker) => worker.started));
  } catch {
    close();
    throw new Error("VRF worker initialization failed");
  }
  return {
    stamp(transaction: PlayInvoke) {
      if (closed || queue.length + lanes.filter((lane) => lane.job).length >= LIMIT) return Promise.reject(refused());
      const raw = new TextEncoder().encode(JSON.stringify(transaction)).buffer;
      return new Promise<Stamp>((resolve, reject) => {
        queue.push({ id: ++nextId, raw, resolve, reject });
        dispatch();
      });
    },
    close,
  };
}
