import type { Stamp, StampProvider } from "./native";
import { felt, MAX_TRANSACTION_BYTES, type PlayIdentity, type PlayInvoke } from "./transaction";

interface Job {
  id: number;
  raw: ArrayBuffer;
  resolve: (stamp: Stamp) => void;
  reject: (error: Error) => void;
}
interface Lane {
  worker: Worker;
  ready: boolean;
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
  let failedOnce = false,
    cancelStartup = () => {};
  const lane: Lane = {
    worker,
    ready: false,
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
      if (failedOnce) return;
      failedOnce = true;
      lane.ready = false;
      cancelStartup();
      stop();
    }
    worker.onerror = (event) => {
      event.preventDefault();
      failed();
    };
    worker.onmessage = (event) => {
      const message = event.data;
      if (!lane.ready) {
        if (
          message.kind !== "ready" ||
          felt(message.publicKey?.x) !== felt(identity.vrfPublicKey.x) ||
          felt(message.publicKey?.y) !== felt(identity.vrfPublicKey.y)
        ) {
          failed();
          return;
        }
        lane.ready = true;
        clearTimeout(timer);
        resolve();
        return;
      }
      const job = lane.job;
      if (!job || message.id !== job.id || (message.kind !== "stamp" && message.kind !== "refused")) {
        failed();
        return;
      }
      lane.job = undefined;
      if (message.kind === "refused") job.reject(refused());
      else job.resolve(message.stamp);
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
    closed = false,
    initializing = true;
  const replacements = new Set<ReturnType<typeof setTimeout>>();
  function close() {
    if (closed) return;
    closed = true;
    for (const timer of replacements) clearTimeout(timer);
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
      if (!lane.ready || lane.job) continue;
      const job = queue.shift();
      if (!job) return;
      lane.job = job;
      lane.worker.postMessage({ kind: "stamp", id: job.id, raw: job.raw }, [job.raw]);
    }
  }
  function addLane(index: number) {
    const worker = startLane(keyFile, identity, dispatch, () => {
      const lane = lanes[index];
      lane.job?.reject(refused());
      lane.job = undefined;
      lane.worker.terminate();
      if (initializing || closed) return;
      // A broken worker does not own the pool. Keep surviving lanes dispatching while it restarts.
      const timer = setTimeout(() => {
        replacements.delete(timer);
        if (!closed)
          void addLane(index)
            .started.then(dispatch)
            .catch(() => {});
      }, 1000);
      replacements.add(timer);
      dispatch();
    });
    lanes[index] = worker.lane;
    return worker;
  }
  const workers = Array.from({ length: count }, (_, index) => addLane(index));
  try {
    await Promise.all(workers.map((worker) => worker.started));
  } catch {
    close();
    throw new Error("VRF worker initialization failed");
  }
  initializing = false;
  return {
    stamp(transaction: PlayInvoke) {
      if (closed || queue.length + lanes.filter((lane) => lane.job).length >= LIMIT) return Promise.reject(refused());
      const raw = new TextEncoder().encode(JSON.stringify(transaction)).buffer;
      if (raw.byteLength > MAX_TRANSACTION_BYTES) return Promise.reject(refused());
      return new Promise<Stamp>((resolve, reject) => {
        queue.push({ id: ++nextId, raw, resolve, reject });
        dispatch();
      });
    },
    close,
  };
}
