/**
 * Model preparation in flight in this page: a model's files loading through the game's glTF loader, and its pipelines
 * compiling (pipeline-compiler). The entry waits for it to settle, so the shader builds of the models the opening view
 * asked for run behind the doorway, not in the first frames a player sees.
 */
let inFlight = 0;
let settleWaiters: Array<() => void> = [];
/** Every load and compile this page has started, and how many of them have ended: the doorway's map progress. */
let started = 0;
let finished = 0;
const listeners = new Set<() => void>();

/** Marks one load or compile started; the returned function ends it, once. */
export function beginModelPreparation(): () => void {
  inFlight += 1;
  started += 1;
  listeners.forEach((listener) => listener());
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    inFlight -= 1;
    finished += 1;
    listeners.forEach((listener) => listener());
    // Checked a task later: a load that hands its model to a compile, or a manager that compiles its models one after
    // another, is not read as done in between.
    if (inFlight === 0) setTimeout(releaseIfIdle, 0);
  };
}

/**
 * Resolves "settled" once no model load or compile is in flight, "timed-out" after `atMostMs`, so a load or compile
 * that never ends cannot hold its caller.
 */
export function whenModelPreparationSettles(atMostMs: number): Promise<"settled" | "timed-out"> {
  if (inFlight === 0) return Promise.resolve("settled");
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve("timed-out"), atMostMs);
    settleWaiters.push(() => {
      clearTimeout(timeout);
      resolve("settled");
    });
  });
}

function releaseIfIdle(): void {
  if (inFlight > 0) return;
  const waiters = settleWaiters;
  settleWaiters = [];
  waiters.forEach((resolve) => resolve());
}

/** The share of the model loads and compiles started so far that have ended, 1 when none has started or all are done. */
export const modelPreparationShare = (): number => (started === 0 ? 1 : finished / started);

/** Calls `listener` as a load or compile starts or ends; returns the unsubscribe. */
export function subscribeModelPreparation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
