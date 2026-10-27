import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

/** How long a touch change may take before the run stops on it. */
const WAIT_MS = 30_000;

/**
 * The worker that holds the page's DevTools connection, as a path beside this file: a test's Vite transform takes
 * `new Worker(new URL(...))` for a browser worker and turns `new URL("./...", import.meta.url)` into an asset's address.
 */
const TOUCH_WORKER = join(dirname(fileURLToPath(import.meta.url)), "page-touch-worker.mjs");

/**
 * A phone's touch on an agent-browser session's page at each width it is given (touchEmulation), set before `at`
 * returns, so a proof's commands stay one after another as they are written. A worker (`script`) holds the page's
 * DevTools connection for the run (Chrome drops the touch when it closes) while this thread waits for each answer:
 * first that it is connected, then one per width.
 */
export const holdPageTouch = (session, script = TOUCH_WORKER) => {
  // Zero until an answer comes; cleared once it is read, before the next request goes: an answer that comes before
  // this thread waits for it is kept.
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const { port1: replies, port2 } = new MessageChannel();
  let worker = null;
  const awaitAnswer = () => {
    if (Atomics.wait(signal, 0, 0, WAIT_MS) === "timed-out") throw new Error(`No touch change within ${WAIT_MS} ms`);
    Atomics.store(signal, 0, 0);
    const reply = receiveMessageOnPort(replies)?.message;
    if (reply?.error) throw new Error(reply.error);
  };
  return {
    at: (width) => {
      if (!worker) {
        worker = new Worker(script, { workerData: { session, signal, replies: port2 }, transferList: [port2] });
        worker.unref();
        awaitAnswer();
      }
      worker.postMessage(width);
      awaitAnswer();
    },
    close: () => {
      worker?.terminate();
      worker = null;
      replies.close();
    },
  };
};
