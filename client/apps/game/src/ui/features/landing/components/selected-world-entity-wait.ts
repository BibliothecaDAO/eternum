import { hexKey, namespaceForChain } from "@/dojo/game-scope";
import { resolveAppchainWorldIdForGame } from "@/runtime/world/game-registry";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { getDefaultWorld, getWorldById } from "@/runtime/world/world-directory";
import { getGameManifest, type Chain } from "@contracts";
import { buildGameSyncModelKeysClause } from "@bibliothecadao/eternum/game-sync";
import { createClient } from "@dojoengine/sdk";
import type { Clause } from "@dojoengine/torii-wasm/types";
import { env } from "../../../../../env";

interface EntitySubscriptionTarget {
  gameId?: number;
  namespace: string;
  toriiBaseUrl: string;
  worldAddress: string;
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
  if (chain === "appchain") {
    if (!gameId || gameId <= 0) {
      throw new Error(`Cannot subscribe to selected appchain game "${worldName}" without its game id`);
    }
    const resolvedWorldId = worldId ?? (await resolveAppchainWorldIdForGame(worldName));
    const world = getWorldById(resolvedWorldId) ?? getDefaultWorld();
    return {
      gameId,
      namespace: world.namespace,
      toriiBaseUrl: world.toriiBaseUrl,
      worldAddress: world.worldAddress,
    };
  }

  if (chain === "local") {
    const manifest = getGameManifest(chain) as { world: { address: string } };
    return {
      namespace: namespaceForChain(chain),
      toriiBaseUrl: env.VITE_PUBLIC_TORII,
      worldAddress: manifest.world.address,
    };
  }

  const profile = await buildWorldProfile(chain, worldName, worldId ?? undefined);
  return {
    gameId: profile.gameId,
    namespace: profile.namespace ?? namespaceForChain(chain),
    toriiBaseUrl: profile.toriiBaseUrl,
    worldAddress: profile.worldAddress,
  };
};

const buildSelectedWorldEntityClause = (target: EntitySubscriptionTarget, modelNames: readonly string[]): Clause => {
  const scopedKey =
    target.gameId && Number.isInteger(target.gameId) && target.gameId > 0 ? hexKey(target.gameId) : undefined;
  return buildGameSyncModelKeysClause(
    modelNames.map((modelName) => ({
      model: `${target.namespace}-${modelName}`,
      scopedKey,
    })),
  ) as Clause;
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
  const client = await createClient({
    toriiUrl: target.toriiBaseUrl,
    worldAddress: target.worldAddress,
  });
  const clause = buildSelectedWorldEntityClause(target, input.modelNames);
  let disposed = false;
  const disposeClient = () => {
    if (disposed) return;
    disposed = true;
    client.free();
  };

  try {
    return await waitForEntitySubscriptionState({
      ...input,
      subscribe: async (onChange) => {
        const subscription = await client.onEntityUpdated(clause, onChange);
        return () => {
          try {
            subscription.cancel();
          } finally {
            disposeClient();
          }
        };
      },
    });
  } catch (error) {
    disposeClient();
    throw error;
  }
};
