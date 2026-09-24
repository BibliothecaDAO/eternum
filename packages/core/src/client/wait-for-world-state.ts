import type { GameSyncRuntime } from "../sync/game-sync-runtime";

type SliceSource = { runtime: Pick<GameSyncRuntime, "subscribeSliceApplied"> };

/**
 * Resolves once `read` returns a value, re-reading after every applied sync slice. This is how a headless caller
 * waits for the native store row an action produces: the row is the fact, the slice is only the moment to look again.
 * A tool that must give up names its deadline; the game client waits on the fact alone.
 */
export const waitForWorldState = <T>(
  client: SliceSource,
  read: () => T | undefined,
  timeoutMs: number | undefined,
  describe: () => string,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let unsubscribe = () => {};
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
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
