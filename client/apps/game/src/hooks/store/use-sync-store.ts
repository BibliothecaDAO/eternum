import { create } from "zustand";

export enum Subscription {
  Market = "market",
  MarketHistory = "marketHistory",
  Hyperstructure = "hyperstructure",
  Guild = "guild",
}

export interface SyncStore {
  subscriptions: Record<string, boolean>;
  setSubscription: (type: Subscription, subscribed: boolean) => void;
}

export const createSyncStoreSlice = (set: any) => ({
  subscriptions: {},
  setSubscription: (type: Subscription, subscribed: boolean) =>
    set((state: SyncStore) => ({
      subscriptions: {
        ...state.subscriptions,
        [type]: subscribed,
      },
    })),
});

export const useSyncStore = create<SyncStore>((set) => ({
  ...createSyncStoreSlice(set),
}));
