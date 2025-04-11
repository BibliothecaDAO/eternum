import { ID } from "@bibliothecadao/eternum";
import { create } from "zustand";

export enum Subscription {
  Market = "market",
  Hyperstructure = "hyperstructure",
}

export interface SyncStore {
  subscriptions: Record<string, boolean>;
  setSubscription: (id: ID, type: Subscription, subscribed: boolean) => void;
}

export const createSyncStoreSlice = (set: any) => ({
  subscriptions: {},
  setSubscription: (id: ID, type: Subscription, subscribed: boolean) =>
    set((state: SyncStore) => ({
      subscriptions: {
        ...state.subscriptions,
        [`${type}_${id}`]: subscribed,
      },
    })),
});

export const useSyncStore = create<SyncStore>((set) => ({
  ...createSyncStoreSlice(set),
}));
