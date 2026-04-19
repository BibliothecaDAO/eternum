import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export enum Subscription {
  Market = "market",
  Hyperstructure = "hyperstructure",
  Guild = "guild",
  Quest = "quest",
}

interface SyncStore {
  subscriptions: Record<string, boolean>;
  setSubscription: (type: Subscription, subscribed: boolean) => void;
  resetSubscriptions: () => void;
  initialSyncProgress: number;
  setInitialSyncProgress: (progress: number) => void;
}

const createSyncStoreSlice = (
  set: (partial: Partial<SyncStore> | ((state: SyncStore) => Partial<SyncStore>)) => void,
) => ({
  subscriptions: {},
  setSubscription: (type: Subscription, subscribed: boolean) =>
    set((state: SyncStore) => ({
      subscriptions: {
        ...state.subscriptions,
        [type]: subscribed,
      },
    })),
  resetSubscriptions: () => set({ subscriptions: {}, initialSyncProgress: 0 }),
  initialSyncProgress: 0,
  setInitialSyncProgress: (progress: number) =>
    set(() => ({
      initialSyncProgress: progress,
    })),
});

export const useSyncStore = create<SyncStore>((set) => ({
  ...createSyncStoreSlice(set),
}));

/**
 * Shallow-equality variant of {@link useSyncStore} for consumers that need
 * multiple fields in a single subscription. Prevents re-renders from unrelated
 * store updates (e.g. ~10 Hz initialSyncProgress ticks) when the selected
 * object's field values are unchanged.
 *
 * Single-field selectors should keep using `useSyncStore` directly — primitive
 * equality is already cheap and correct.
 *
 * @example
 *   const { initialSyncProgress, subscriptions } = useSyncStoreShallow(
 *     (s) => ({ initialSyncProgress: s.initialSyncProgress, subscriptions: s.subscriptions }),
 *   );
 */
export const useSyncStoreShallow = <T>(selector: (state: SyncStore) => T): T =>
  useSyncStore(useShallow(selector));
