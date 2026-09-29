import type { NativeFactStore } from "./native-fact-store";

type StoreSource = Pick<NativeFactStore, "subscribe">;

/**
 * Resolves once `read` returns a value, re-reading after every fact or snapshot-gate change in the store it reads.
 * A tool that must give up names its deadline; the game client waits on the fact alone.
 */
export const waitForWorldState = <T>(
  store: StoreSource,
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
    unsubscribe = store.subscribe(check);
    check();
  });
