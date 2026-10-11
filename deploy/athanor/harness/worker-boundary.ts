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

const failures: UncaughtFailure[] = [];
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
}

export function workerBoundaryEvidence(): WorkerBoundaryEvidence {
  return { uncaughtFailures: [...failures] };
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

function record(kind: UncaughtFailure["kind"], reason: unknown): void {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  failures.push({ at: new Date().toISOString(), kind, error: error.message, stack: error.stack });
  if (!process.exitCode || process.exitCode === "0") process.exitCode = 1;
  publishBoundaryEvidence();
  console.error(`Uncaught ${kind} kept in the report: ${error.message}`);
}
