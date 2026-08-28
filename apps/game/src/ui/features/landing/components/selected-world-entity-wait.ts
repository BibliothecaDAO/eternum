import { resolveWorldIdForGame } from "@/runtime/world/game-registry";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { buildHeraldGameStreamUrl } from "@/sync/herald-game-sync-session";
import type { GameChain as Chain } from "@realms-world/chain";
import { HeraldGameSyncTransport } from "@bibliothecadao/eternum/game-sync";

interface EntitySubscriptionTarget {
  chain: Chain;
  gameId: number;
  heraldBaseUrl: string;
}

interface WaitForEntitySubscriptionStateInput<T> {
  description: string;
  isTarget: (value: T) => boolean;
  onSlow?: (elapsedMs: number) => void;
  read: () => Promise<T>;
  signal?: AbortSignal;
  slowAfterMs: number;
  subscribe: (onChange: () => void) => Promise<() => void>;
}

interface WaitForSelectedWorldEntityStateInput<T> extends Omit<WaitForEntitySubscriptionStateInput<T>, "subscribe"> {
  chain: Chain;
  gameId?: number;
  modelNames: readonly string[];
  worldId?: string | null;
  worldName: string;
}

const createAbortError = (): Error => {
  const error = new Error("Selected-world entity wait was cancelled");
  error.name = "AbortError";
  return error;
};

export const isSelectedWorldEntityWaitAborted = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const resolveEntitySubscriptionTarget = async ({
  chain,
  gameId,
  worldId,
  worldName,
}: Pick<
  WaitForSelectedWorldEntityStateInput<unknown>,
  "chain" | "gameId" | "worldId" | "worldName"
>): Promise<EntitySubscriptionTarget> => {
  if (!gameId || gameId <= 0) {
    throw new Error(`Cannot subscribe to selected ${chain} game "${worldName}" without its game id`);
  }
  const resolvedWorldId = worldId ?? (await resolveWorldIdForGame(worldName));
  const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();
  return {
    gameId,
    chain,
    heraldBaseUrl: world.heraldBaseUrl,
  };
};

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

export const waitForSelectedWorldEntityState = async <T>(
  input: WaitForSelectedWorldEntityStateInput<T>,
): Promise<T> => {
  const target = await resolveEntitySubscriptionTarget(input);
  const transport = new HeraldGameSyncTransport({
    url: buildHeraldGameStreamUrl(target.heraldBaseUrl, target.chain, target.gameId),
  });
  const watchedModels = new Set(input.modelNames);
  return waitForEntitySubscriptionState({
    ...input,
    subscribe: async (onChange) => {
      const subscription = await transport.subscribe({
        onEntity: (entity) => {
          if (Object.keys(entity.models).some((model) => watchedModels.has(model))) onChange();
        },
        onEvent: () => undefined,
        onEventGapFill: () => undefined,
      });
      return subscription.cancel;
    },
  });
};
