import { getGuildsFromTorii, getHyperstructureFromTorii, getMarketFromTorii, getQuestsFromTorii } from "@/dojo/queries";
import { sqlApi } from "@/services/api";
import { ToriiClient } from "@dojoengine/torii-wasm";
import { useCallback } from "react";
import { Subscription, useSyncStore } from "../store/use-sync-store";
import { LoadingStateKey } from "../store/use-world-loading";
import { useToriiSync } from "./use-torii-sync";

export const useSyncLeaderboard = () => {
  const syncLeaderboard = useCallback(
    async ({ toriiClient, contractComponents }: { toriiClient: ToriiClient; contractComponents: unknown }) => {
      const hyperstructureIds = await sqlApi.fetchHyperstructures();

      const { subscriptions, setSubscription } = useSyncStore.getState();

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
    },
    [],
  );

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Guild,
    loadingKey: LoadingStateKey.Leaderboard,
    fetch: syncLeaderboard,
  });

  return { isSyncing, sync };
};

export const useSyncHyperstructure = () => {
  const syncHyperstructure = useCallback(
    async ({ toriiClient, contractComponents }: { toriiClient: ToriiClient; contractComponents: unknown }) => {
      const hyperstructureIds = await sqlApi.fetchHyperstructures();
      const start = performance.now();

      const { subscriptions, setSubscription } = useSyncStore.getState();

      if (!subscriptions[Subscription.Hyperstructure]) {
        await getHyperstructureFromTorii(
          hyperstructureIds.map((h) => h.hyperstructure_id),
          toriiClient,
          contractComponents as any,
        );
        setSubscription(Subscription.Hyperstructure, true);
      }

      const end = performance.now();
      console.log("[sync] hyperstructure query", end - start);
    },
    [],
  );

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Hyperstructure,
    loadingKey: LoadingStateKey.Hyperstructure,
    fetch: syncHyperstructure,
  });

  return { isSyncing, sync };
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
  const syncQuest = useCallback(
    async ({ toriiClient, contractComponents }: { toriiClient: ToriiClient; contractComponents: unknown }) => {
      const start = performance.now();

      const { subscriptions, setSubscription } = useSyncStore.getState();

      if (!subscriptions[Subscription.Quest]) {
        await getQuestsFromTorii(toriiClient, contractComponents as any);
        setSubscription(Subscription.Quest, true);
      }

      const end = performance.now();
      console.log("[sync] quest query", end - start);
    },
    [],
  );

  const { isSyncing, sync } = useToriiSync({
    subscriptionKey: Subscription.Quest,
    loadingKey: LoadingStateKey.Quest,
    fetch: syncQuest,
  });

  return { isSyncing, sync };
};
