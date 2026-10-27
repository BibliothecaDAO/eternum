import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";

/** How long a touch change may take before the run stops on it. */
const WAIT_MS = 30_000;

/**
 * A phone's touch on an agent-browser session's page at each width it is given (touchEmulation), set before `at`
 * returns, so a proof's commands stay one after another as they are written. A worker holds the page's DevTools
 * connection for the run (Chrome drops the touch when it closes) while this thread waits for each change to land.
 */
export const holdPageTouch = (session) => {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  const { port1: replies, port2 } = new MessageChannel();
  let worker = null;
  const answered = (width) => {
    Atomics.store(signal, 0, 0);
    if (width !== undefined) worker.postMessage(width);
    if (Atomics.wait(signal, 0, 0, WAIT_MS) === "timed-out") throw new Error(`No touch change within ${WAIT_MS} ms`);
    const reply = receiveMessageOnPort(replies)?.message;
    if (reply?.error) throw new Error(reply.error);
  };
  return {
    at: (width) => {
      if (!worker) {
        worker = new Worker(new URL("./page-touch-worker.mjs", import.meta.url), {
          workerData: { session, signal, replies: port2 },
          transferList: [port2],
        });
        worker.unref();
        answered();
      }
      answered(width);
    },
    close: () => {
      worker?.terminate();
      worker = null;
      replies.close();
    },
  };
};
