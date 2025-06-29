import { create } from "zustand";

export enum Subscription {
  Market = "market",
  Hyperstructure = "hyperstructure",
  Guild = "guild",
  Quest = "quest",
}

interface SyncStore {
  subscriptions: Record<string, boolean>;
  setSubscription: (type: Subscription, subscribed: boolean) => void;
  initialSyncProgress: number;
  setInitialSyncProgress: (progress: number) => void;
}

const createSyncStoreSlice = (set: any) => ({
  subscriptions: {},
  setSubscription: (type: Subscription, subscribed: boolean) =>
    set((state: SyncStore) => ({
      subscriptions: {
        ...state.subscriptions,
        [type]: subscribed,
      },
    })),
  initialSyncProgress: 0,
  setInitialSyncProgress: (progress: number) =>
    set(() => ({
      initialSyncProgress: progress,
    })),
});

export const useSyncStore = create<SyncStore>((set) => ({
  ...createSyncStoreSlice(set),
}));
