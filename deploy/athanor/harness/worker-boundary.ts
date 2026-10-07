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

/** Installs the boundary once per worker; every later uncaught failure lands in the worker's report instead. */
export function catchUncaughtFailures(): void {
  if (installed) return;
  installed = true;
  process.on("uncaughtException", (error) => record("exception", error));
  process.on("unhandledRejection", (reason) => record("rejection", reason));
}

export interface WorkerBoundaryEvidence {
  uncaughtFailures: UncaughtFailure[];
  invalidFrames: InvalidFrame[];
  droppedUnsubscribeFrames: number;
}

export function workerBoundaryEvidence(): WorkerBoundaryEvidence {
  return { uncaughtFailures: [...failures], invalidFrames: [...frames], droppedUnsubscribeFrames };
}

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
