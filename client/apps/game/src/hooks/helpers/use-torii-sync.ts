import { useDojo } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ToriiClient } from "@dojoengine/torii-wasm";
import { Subscription, useSyncStore } from "../store/use-sync-store";
import { useUIStore } from "../store/use-ui-store";
import { LoadingStateKey } from "../store/use-world-loading";

interface ToriiSyncContext {
  toriiClient: ToriiClient;
  contractComponents: unknown;
}

interface UseToriiSyncConfig {
  subscriptionKey: Subscription;
  loadingKey: LoadingStateKey;
  fetch: (context: ToriiSyncContext) => Promise<void>;
  deps?: ReadonlyArray<unknown>;
  auto?: boolean;
  skip?: boolean;
}

export const useToriiSync = ({
  subscriptionKey,
  loadingKey,
  fetch,
  deps = [],
  auto = true,
  skip = false,
}: UseToriiSyncConfig) => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const setSubscription = useSyncStore((state) => state.setSubscription);
  const isSubscribed = useSyncStore((state) => state.subscriptions[subscriptionKey]);
  const setLoading = useUIStore((state) => state.setLoading);

  const [isSyncing, setIsSyncing] = useState(!isSubscribed);

  useEffect(() => {
    if (isSubscribed) {
      setIsSyncing(false);
    }
  }, [isSubscribed]);

  const context = useMemo<ToriiSyncContext>(
    () => ({ toriiClient, contractComponents }),
    [toriiClient, contractComponents],
  );

  const sync = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (skip) {
        setIsSyncing(false);
        return;
      }

      const alreadySubscribed = useSyncStore.getState().subscriptions[subscriptionKey];
      if (!force && alreadySubscribed) {
        setLoading(loadingKey, false);
        setIsSyncing(false);
        return;
      }

      setIsSyncing(true);
      setLoading(loadingKey, true);

      try {
        await fetch(context);
        setSubscription(subscriptionKey, true);
      } catch (error) {
        console.error(`[sync] ${subscriptionKey} query failed`, error);
      } finally {
        setLoading(loadingKey, false);
        setIsSyncing(false);
      }
    },
    [context, fetch, loadingKey, setLoading, setSubscription, skip, subscriptionKey],
  );

  useEffect(() => {
    if (!auto) return;
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, sync, skip, ...deps]);

  return { isSyncing, sync };
};
