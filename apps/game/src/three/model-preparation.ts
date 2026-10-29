/**
 * Model preparation in flight in this page: a model's files loading through the game's glTF loader, and its pipelines
 * compiling (pipeline-compiler). The entry waits for it to settle, so the shader builds of the models the opening view
 * asked for run behind the doorway, not in the first frames a player sees.
 */
let inFlight = 0;
let settleWaiters: Array<() => void> = [];

/** Marks one load or compile started; the returned function ends it, once. */
export function beginModelPreparation(): () => void {
  inFlight += 1;
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    inFlight -= 1;
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
