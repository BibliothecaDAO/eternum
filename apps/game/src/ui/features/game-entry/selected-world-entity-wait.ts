import { requireOpenShard } from "@/runtime/world/shards";
import { subscribeHeraldDirectory, type GameRef } from "@bibliothecadao/eternum/game-client";

interface WaitForEntitySubscriptionStateInput<T> {
  description: string;
  isTarget: (value: T) => boolean;
  onSlow?: (elapsedMs: number) => void;
  read: () => Promise<T>;
  signal?: AbortSignal;
  slowAfterMs: number;
  subscribe: (onChange: () => void) => Promise<() => void>;
}

type WaitForSelectedWorldEntityStateInput<T> = Omit<WaitForEntitySubscriptionStateInput<T>, "subscribe"> & GameRef;

const createAbortError = (): Error => {
  const error = new Error("Selected-world entity wait was cancelled");
  error.name = "AbortError";
  return error;
};

export const isSelectedWorldEntityWaitAborted = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export const waitForEntitySubscriptionState = async <T>(input: WaitForEntitySubscriptionStateInput<T>): Promise<T> => {
  if (input.signal?.aborted) throw createAbortError();

  const slowTimer = setTimeout(() => {
    console.warn(`[GameEntry] ${input.description} is still waiting after ${input.slowAfterMs}ms`);
    input.onSlow?.(input.slowAfterMs);
  }, input.slowAfterMs);
  let pendingChange = false;
  let notifyChange = () => {
    pendingChange = true;
  };
  let unsubscribe: () => void;
  try {
    unsubscribe = await input.subscribe(() => notifyChange());
  } catch (error) {
    clearTimeout(slowTimer);
    throw error;
  }
  const closeSubscription = () => {
    try {
      unsubscribe();
    } catch (error) {
      console.warn(`[GameEntry] Failed to close ${input.description} subscription`, error);
    }
  };
  if (input.signal?.aborted) {
    clearTimeout(slowTimer);
    closeSubscription();
    throw createAbortError();
  }

  return new Promise<T>((resolve, reject) => {
    let checkInFlight = false;
    let checkAgain = false;
    let settled = false;

    const cleanup = () => {
      clearTimeout(slowTimer);
      input.signal?.removeEventListener("abort", handleAbort);
      closeSubscription();
    };

    const complete = (value: T) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const checkTarget = async () => {
      if (settled) return;
      if (checkInFlight) {
        checkAgain = true;
        return;
      }

      checkInFlight = true;
      try {
        do {
          checkAgain = false;
          const value = await input.read();
          if (input.isTarget(value)) {
            complete(value);
            return;
          }
        } while (checkAgain && !settled);
      } catch (error) {
        fail(error);
      } finally {
        checkInFlight = false;
      }
    };

    function handleAbort() {
      fail(createAbortError());
    }

    notifyChange = () => {
      void checkTarget();
    };
    input.signal?.addEventListener("abort", handleAbort, { once: true });
    void checkTarget();
    if (pendingChange) {
      pendingChange = false;
      void checkTarget();
    }
  });
};

/** Re-reads the player's directory row whenever Herald says the directory changed, until it reaches the target. */
export const waitForSelectedWorldEntityState = async <T>(
  input: WaitForSelectedWorldEntityStateInput<T>,
): Promise<T> => {
  const shard = await requireOpenShard(input.chainId);
  return waitForEntitySubscriptionState({
    ...input,
    subscribe: async (onChange) => subscribeHeraldDirectory(shard, onChange),
  });
};
