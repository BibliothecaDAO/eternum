import {
  getGuildsFromTorii,
  getHyperstructureFromTorii,
  getMarketEventsFromTorii,
  getMarketFromTorii,
} from "@/dojo/queries";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";
import { Subscription, useSyncStore } from "../store/use-sync-store";
import { useUIStore } from "../store/use-ui-store";
import { LoadingStateKey } from "../store/use-world-loading";

export const useSyncLeaderboard = () => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      setLoading(LoadingStateKey.Leaderboard, true);
      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(toriiClient, contractComponents as any);
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

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      setLoading(LoadingStateKey.Hyperstructure, true);
      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(toriiClient, contractComponents as any);

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
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      setLoading(LoadingStateKey.Market, true);
      const marketPromise = subscriptions[Subscription.Market]
        ? Promise.resolve()
        : getMarketFromTorii(toriiClient, contractComponents as any);

      const start = performance.now();
      await Promise.all([marketPromise]);
      const end = performance.now();
      console.log("[sync] market query", end - start);

      setSubscription(Subscription.Market, true);
      setIsSyncing(false);
      setLoading(LoadingStateKey.Market, false);
    };
    syncState();
  }, [contractComponents]);

  return { isSyncing };
};

export const useSyncMarketHistory = () => {
  const {
    network: { toriiClient, contractComponents },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      setLoading(LoadingStateKey.MarketHistory, true);
      const marketHistoryPromise = subscriptions[Subscription.MarketHistory]
        ? Promise.resolve()
        : getMarketEventsFromTorii(toriiClient, contractComponents as any);

      const start = performance.now();
      await Promise.all([marketHistoryPromise]);
      const end = performance.now();
      console.log("[sync] market history query", end - start);

      setSubscription(Subscription.MarketHistory, true);
      setLoading(LoadingStateKey.MarketHistory, false);
      setIsSyncing(false);
    };
    syncState();
  }, [contractComponents]);

  return { isSyncing };
};
