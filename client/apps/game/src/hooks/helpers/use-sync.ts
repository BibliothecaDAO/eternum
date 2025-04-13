import {
  getGuildsFromTorii,
  getHyperstructureFromTorii,
  getMarketEventsFromTorii,
  getMarketFromTorii,
} from "@/dojo/queries";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";
import { Subscription, useSyncStore } from "../store/use-sync-store";

export const useSyncLeaderboard = () => {
  const {
    setup: { components },
    network: { toriiClient },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(toriiClient, components as any);
      const guildPromise = subscriptions[Subscription.Guild]
        ? Promise.resolve()
        : getGuildsFromTorii(toriiClient, components as any);

      const start = performance.now();
      await Promise.all([hyperstructurePromise, guildPromise]);
      const end = performance.now();
      console.log("[keys] guild and hyperstructure query", end - start);

      setSubscription(Subscription.Hyperstructure, true);
      setSubscription(Subscription.Guild, true);

      setIsSyncing(false);
    };
    syncState();
  }, [components]);

  return { isSyncing };
};

export const useSyncHyperstructure = () => {
  const {
    setup: { components },
    network: { toriiClient },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      const hyperstructurePromise = subscriptions[Subscription.Hyperstructure]
        ? Promise.resolve()
        : getHyperstructureFromTorii(toriiClient, components as any);

      const start = performance.now();
      await Promise.all([hyperstructurePromise]);
      const end = performance.now();
      console.log("[keys] hyperstructure query", end - start);

      setSubscription(Subscription.Hyperstructure, true);
      setIsSyncing(false);
    };
    syncState();
  }, [components]);

  return { isSyncing };
};

export const useSyncMarket = () => {
  const {
    setup: { components },
    network: { toriiClient },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      const marketPromise = subscriptions[Subscription.Market]
        ? Promise.resolve()
        : getMarketFromTorii(toriiClient, components as any);

      const start = performance.now();
      await Promise.all([marketPromise]);
      const end = performance.now();
      console.log("[keys] market query", end - start);

      setSubscription(Subscription.Market, true);
      setIsSyncing(false);
    };
    syncState();
  }, [components]);

  return { isSyncing };
};

export const useSyncMarketHistory = () => {
  const {
    setup: { components },
    network: { toriiClient },
  } = useDojo();

  const [isSyncing, setIsSyncing] = useState(false);
  const subscriptions = useSyncStore((state) => state.subscriptions);
  const setSubscription = useSyncStore((state) => state.setSubscription);

  useEffect(() => {
    const syncState = async () => {
      setIsSyncing(true);
      const marketHistoryPromise = subscriptions[Subscription.MarketHistory]
        ? Promise.resolve()
        : getMarketEventsFromTorii(toriiClient, components as any);

      const start = performance.now();
      await Promise.all([marketHistoryPromise]);
      const end = performance.now();
      console.log("[keys] market history query", end - start);

      setSubscription(Subscription.MarketHistory, true);
      setIsSyncing(false);
    };
    syncState();
  }, [components]);

  return { isSyncing };
};
