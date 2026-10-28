import { Worker } from "node:worker_threads";
import { afterEach, expect, it, vi } from "vitest";

import { holdPageTouch } from "./page-touch.mjs";

/**
 * A worker that answers as page-touch-worker.mjs does, without a browser: connected after `readyMs`, then each width
 * at once, 390 as set and any other as refused (so a test sees which width reached it).
 */
const standIn = (readyMs) =>
  new URL(
    `data:text/javascript,${encodeURIComponent(`
      import { parentPort, workerData } from "node:worker_threads";
      const { signal, replies } = workerData;
      const answer = (reply) => {
        replies.postMessage(reply);
        Atomics.store(signal, 0, 1);
        Atomics.notify(signal, 0);
      };
      setTimeout(() => answer({}), ${readyMs});
      parentPort.on("message", (width) => answer(width === 390 ? {} : { error: "refused " + width }));
    `)}`,
  );

/** Holds this thread `ms`, as a busy parent would be between starting the worker and waiting for it. */
const hold = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

let touch = null;
afterEach(() => {
  touch?.close();
  vi.restoreAllMocks();
});

it("reaches the first width when the worker is connected before this thread waits for it", () => {
  // The parent is held past the worker's start (in Worker.unref, right after it is made), so the answer comes first.
  vi.spyOn(Worker.prototype, "unref").mockImplementation(() => hold(300));
  touch = holdPageTouch("worker-first", standIn(0));
  expect(() => touch.at(390)).not.toThrow();
  expect(() => touch.at(1440)).toThrow("refused 1440");
});

it("reaches the first width when this thread waits before the worker is connected", () => {
  touch = holdPageTouch("parent-first", standIn(300));
  expect(() => touch.at(390)).not.toThrow();
  expect(() => touch.at(1440)).toThrow("refused 1440");
});
