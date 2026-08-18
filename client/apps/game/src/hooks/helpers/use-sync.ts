import { getMarketFromTorii } from "@/dojo/queries";
import { verboseLog } from "@/utils/dev-mode";
import { ToriiClient } from "@dojoengine/torii-wasm";
import { useCallback } from "react";
import { Subscription, useSyncStore } from "../store/use-sync-store";
import { LoadingStateKey } from "../store/use-world-loading";
import { useToriiSync } from "./use-torii-sync";

export const useSyncLeaderboard = ({ auto = true, skip = false }: { auto?: boolean; skip?: boolean } = {}) => {
  const syncLeaderboard = useCallback(async () => {
    const { setSubscription } = useSyncStore.getState();
    setSubscription(Subscription.Hyperstructure, true);
    setSubscription(Subscription.Guild, true);
  }, []);

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Guild,
    loadingKey: LoadingStateKey.Leaderboard,
    fetch: syncLeaderboard,
    auto,
    skip,
  });

  return { isSyncing, sync };
};

const useSyncHyperstructure = () => {
  const syncHyperstructure = useCallback(async () => {
    useSyncStore.getState().setSubscription(Subscription.Hyperstructure, true);
  }, []);

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Hyperstructure,
    loadingKey: LoadingStateKey.Hyperstructure,
    fetch: syncHyperstructure,
  });

  return { isSyncing, sync };
};

export const useSyncMarket = () => {
  const syncMarket = useCallback(async ({ toriiClient }: { toriiClient: ToriiClient }) => {
    const start = performance.now();
    await getMarketFromTorii(toriiClient);
    const end = performance.now();
    verboseLog("[sync] market query", end - start);
  }, []);

  const { isSyncing } = useToriiSync({
    subscriptionKey: Subscription.Market,
    loadingKey: LoadingStateKey.Market,
    fetch: syncMarket,
  });

  return { isSyncing };
};

const useSyncQuest = () => {
  const syncQuest = useCallback(async () => {
    useSyncStore.getState().setSubscription(Subscription.Quest, true);
  }, []);

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Quest,
    loadingKey: LoadingStateKey.Quest,
    fetch: syncQuest,
  });

  return { isSyncing, sync };
};
