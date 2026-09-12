import type { GameSyncRuntime } from "../sync/game-sync-runtime";

type SliceSource = { runtime: Pick<GameSyncRuntime, "subscribeSliceApplied"> };

/**
 * Resolves once `read` returns a value, re-reading after every applied sync slice. This is how a headless caller
 * waits for the RECS row an action produces: the row is the fact, the slice is only the moment to look again.
 */
export const waitForWorldState = <T>(
  client: SliceSource,
  read: () => T | undefined,
  timeoutMs: number,
  describe: () => string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error(`${describe()} did not reach the required state within ${timeoutMs / 1_000} seconds`));
    }, timeoutMs);
    const check = () => {
      try {
        const value = read();
        if (value === undefined) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(value);
      } catch (error) {
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      }
    };
    unsubscribe = client.runtime.subscribeSliceApplied(check);
    check();
  });
