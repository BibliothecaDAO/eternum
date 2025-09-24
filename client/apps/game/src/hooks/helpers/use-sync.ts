import { getGuildsFromTorii, getHyperstructureFromTorii, getMarketFromTorii, getQuestsFromTorii } from "@/dojo/queries";
import { sqlApi } from "@/services/api";
import { useDojo } from "@bibliothecadao/react";
import { ToriiClient } from "@dojoengine/torii-wasm";
import { useCallback, useEffect, useState } from "react";
import { Subscription, useSyncStore } from "../store/use-sync-store";
import { useUIStore } from "../store/use-ui-store";
import { LoadingStateKey } from "../store/use-world-loading";
import { useToriiSync } from "./use-torii-sync";

export const useSyncLeaderboard = () => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(true);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setLoading(LoadingStateKey.Leaderboard, true);

      const hyperstructureIds = await sqlApi.fetchHyperstructures();

      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(
            hyperstructureIds.map((h) => h.hyperstructure_id),
            toriiClient,
            contractComponents as any,
          );
      const guildPromise = subscriptions[Subscription.Guild]
        ? Promise.resolve()
        : getGuildsFromTorii(toriiClient, contractComponents as any);

      const start = performance.now();
      await Promise.all([hyperstructurePromise, guildPromise]);
      const end = performance.now();
      console.log("[sync] guild and hyperstructure query", end - start);

      setSubscription(Subscription.Hyperstructure, true);
      setSubscription(Subscription.Guild, true);
      setLoading(LoadingStateKey.Leaderboard, false);
      setIsSyncing(false);
    };
    syncState();
  }, [contractComponents]);

  return { isSyncing };
};

export const useSyncHyperstructure = () => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(true);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setLoading(LoadingStateKey.Hyperstructure, true);
      const hyperstructureIds = await sqlApi.fetchHyperstructures();
      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(
            hyperstructureIds.map((h) => h.hyperstructure_id),
            toriiClient,
            contractComponents as any,
          );

      const start = performance.now();
      await Promise.all([hyperstructurePromise]);
      const end = performance.now();
      console.log("[sync] hyperstructure query", end - start);

      setSubscription(Subscription.Hyperstructure, true);
      setLoading(LoadingStateKey.Hyperstructure, false);
      setIsSyncing(false);
    };
    syncState();
  }, [contractComponents]);

  return { isSyncing };
};

export const useSyncMarket = () => {
  const syncMarket = useCallback(
    async ({ toriiClient, contractComponents }: { toriiClient: ToriiClient; contractComponents: unknown }) => {
      const start = performance.now();
      await getMarketFromTorii(toriiClient, contractComponents as any);
      const end = performance.now();
      console.log("[sync] market query", end - start);
    },
    [],
  );

  const { isSyncing } = useToriiSync({
    subscriptionKey: Subscription.Market,
    loadingKey: LoadingStateKey.Market,
    fetch: syncMarket,
  });

  return { isSyncing };
};

export const useSyncQuest = () => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(true);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setLoading(LoadingStateKey.Quest, true);
      const questPromise = subscriptions[Subscription.Quest]
        ? Promise.resolve()
        : getQuestsFromTorii(toriiClient, contractComponents as any);

      const start = performance.now();
      await Promise.all([questPromise]);
      const end = performance.now();
      console.log("[sync] quest query", end - start);

      setSubscription(Subscription.Quest, true);
      setLoading(LoadingStateKey.Quest, false);
      setIsSyncing(false);
    };
    syncState();
  }, [contractComponents]);

  return { isSyncing };
};
