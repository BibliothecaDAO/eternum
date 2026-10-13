/** The proxy can forward for 10 s. Give Herald that window plus 2 s before asking the node by hash. */
const HERALD_WAIT_MS = 12_000;
/** A failed connection must not hold a player's queue; this is a response budget, never proof of non-inclusion. */
const NODE_ANSWER_MS = 2_000;

export class TransactionNoAnswerError extends Error {
  constructor(readonly transactionHash: string) {
    super("No answer yet. This action may still apply. You can try another action.");
    this.name = "TransactionNoAnswerError";
  }
}

/** Herald gets the first word. Silence permits one bounded node fallback, then releases local pending state. */
export async function transactionAnswer<T>(
  hash: string,
  herald: Promise<T> | undefined,
  readNode: (until: AbortSignal) => Promise<T>,
  stopped?: AbortSignal,
  startedAt = Date.now(),
): Promise<T> {
  const finished = new AbortController();
  const until = stopped ? AbortSignal.any([stopped, finished.signal]) : finished.signal;
  const expired = setTimeout(
    () => finished.abort(new TransactionNoAnswerError(hash)),
    Math.max(0, startedAt + HERALD_WAIT_MS + NODE_ANSWER_MS - Date.now()),
  );
  const aborted = new Promise<never>((_, reject) => {
    if (until.aborted) reject(until.reason);
    else until.addEventListener("abort", () => reject(until.reason), { once: true });
  });
  const fallback = async () => {
    if (herald) await pause(Math.max(0, startedAt + HERALD_WAIT_MS - Date.now()), until);
    until.throwIfAborted();
    return readNode(until);
  };
  try {
    return await Promise.race([herald ?? new Promise<never>(() => {}), fallback(), aborted]);
  } finally {
    clearTimeout(expired);
    finished.abort();
  }
}

/** A cancellable wait; completed actions leave no timers behind. */
export const pause = (ms: number, until: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    until.throwIfAborted();
    const timer = setTimeout(() => {
      until.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(until.reason);
    };
    until.addEventListener("abort", abort, { once: true });
  });
