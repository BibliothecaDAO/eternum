import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parentPort } from "node:worker_threads";
/**
 * What a library threw where no caller could catch it, such as inside a socket's message listener. Uncaught, it would
 * end the worker with nothing reported; caught here, the run keeps going, the affected action fails on its deadline, and
 * the worker's report names every failure and fails.
 */
export interface UncaughtFailure {
  at: string;
  kind: "exception" | "rejection";
  error: string;
  stack?: string;
}

/** A frame a socket delivered that is not JSON: what the library could not parse, kept as evidence of who sent it. */
export interface InvalidFrame {
  at: string;
  url: string;
  length: number;
  head: string;
  tail: string;
}

const FRAME_EDGE = 400;
/**
 * The one malformed frame we know: the pinned Madara's notice after a transaction-status unsubscribe, whose error is a
 * string with bare quotes. The SDK cannot parse it and nothing reads it, so it is dropped and counted, as the gateway
 * drops it (apps/gateway/src/socket.rs). The unsubscribe itself still goes out: without it the node keeps every status
 * subscription open.
 */
const UNSUBSCRIBE_CLOSE =
  /^\{"jsonrpc":"2\.0","method":"starknet_V0_10_2_subscribeTransactionStatus","params":\{"subscription":"\d+","error":""code": -32000, "message": Subscription closed"\}\}$/;
const failures: UncaughtFailure[] = [];
const frames: InvalidFrame[] = [];
let droppedUnsubscribeFrames = 0;
let installed = false;
const evidencePaths = new Set<string>();

/** Installs the boundary once per worker; every later uncaught failure lands in the worker's report instead. */
export function catchUncaughtFailures(): void {
  if (installed) return;
  installed = true;
  process.on("uncaughtException", (error) => record("exception", error));
  process.on("unhandledRejection", (reason) => record("rejection", reason));
  guardExitListeners();
  process.on("exit", publishBoundaryEvidence);
}

export interface WorkerBoundaryEvidence {
  uncaughtFailures: UncaughtFailure[];
  invalidFrames: InvalidFrame[];
  droppedUnsubscribeFrames: number;
}

export function workerBoundaryEvidence(): WorkerBoundaryEvidence {
  return { uncaughtFailures: [...failures], invalidFrames: [...frames], droppedUnsubscribeFrames };
}

/** Bun can swallow a thrown exit listener without changing worker exit status; guard the registration chokepoint. */
function guardExitListeners(): void {
  type Listener = (...args: unknown[]) => unknown;
  const guarded = new WeakMap<Listener, Listener>();
  const wrap = (listener: Listener): Listener => {
    const known = guarded.get(listener);
    if (known) return known;
    const handler = function (this: unknown, ...args: unknown[]) {
      try {
        return listener.apply(this, args);
      } catch (error) {
        record("exception", error);
      }
    };
    guarded.set(listener, handler);
    guarded.set(handler, handler);
    return handler;
  };
  const methods = process as unknown as Record<string, (event: string | symbol, listener: Listener) => unknown>;
  const existing = process.rawListeners("exit");
  process.removeAllListeners("exit");
  for (const listener of existing) process.on("exit", wrap(listener as Listener));
  for (const name of ["on", "addListener", "once", "prependListener", "prependOnceListener"]) {
    const original = methods[name]!.bind(process);
    methods[name] = (event, listener) => original(event, event === "exit" ? wrap(listener) : listener);
  }
  for (const name of ["off", "removeListener"]) {
    const original = methods[name]!.bind(process);
    methods[name] = (event, listener) =>
      original(event, event === "exit" ? (guarded.get(listener) ?? listener) : listener);
  }
}

/** A worker's port can already be closed in an exit listener; retain evidence synchronously for its supervisor. */
export function retainBoundaryEvidence(file: string): void {
  evidencePaths.add(file);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(workerBoundaryEvidence()));
}

/** Exit listeners may still throw after this snapshot; record() streams any later evidence too. */
function publishBoundaryEvidence() {
  const evidence = workerBoundaryEvidence();
  for (const file of evidencePaths) writeFileSync(file, JSON.stringify(evidence));
  const message = { type: "boundary", evidence };
  // The durable evidence above remains authoritative if Bun has already closed the worker port.
  try {
    if (parentPort) parentPort.postMessage(message);
    else process.send?.(message);
  } catch {
    /* Exit may close IPC before the last listener; the supervisor reads the retained evidence. */
  }
}

/** A synchronous teardown failure is a driver failure too; keep closing the other resources and preserve its stack. */
export const recordWorkerFailure = (error: unknown): void => record("exception", error);

/**
 * The socket class the harness hands the SDK: it checks every frame before the SDK's own listeners parse it. The known
 * unsubscribe frame stops here; any other frame that is not JSON is recorded and still reaches the SDK, so what it throws
 * fails the run through the boundary. It never throws itself.
 */
export function frameCheckingSocket(Base: typeof WebSocket): typeof WebSocket {
  return class extends Base {
    constructor(...args: ConstructorParameters<typeof WebSocket>) {
      super(...args);
      this.addEventListener("message", (event) => {
        if (typeof event.data !== "string" || isJson(event.data)) return;
        if (UNSUBSCRIBE_CLOSE.test(event.data)) {
          droppedUnsubscribeFrames++;
          event.stopImmediatePropagation();
          return;
        }
        frames.push({
          at: new Date().toISOString(),
          url: this.url,
          length: event.data.length,
          head: event.data.slice(0, FRAME_EDGE),
          tail: event.data.slice(-FRAME_EDGE),
        });
      });
    }
  };
}

function record(kind: UncaughtFailure["kind"], reason: unknown): void {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  failures.push({ at: new Date().toISOString(), kind, error: error.message, stack: error.stack });
  if (!process.exitCode || process.exitCode === "0") process.exitCode = 1;
  publishBoundaryEvidence();
  console.error(`Uncaught ${kind} kept in the report: ${error.message}`);
}

function isJson(data: string): boolean {
  try {
    JSON.parse(data);
    return true;
  } catch {
    return false;
  }
}
