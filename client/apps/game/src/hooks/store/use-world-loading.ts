/**
 * Represents the loading state of different parts of the application.
 * Each property indicates whether that part is currently loading data from the blockchain.
 */
export enum LoadingStateKey {
  Realm = "realm",
  SpectatorRealm = "spectatorRealm",
  Market = "market",
  AllPlayerStructures = "allPlayerStructures",
  Map = "map",
  Bank = "bank",
  World = "world",
  Hyperstructure = "hyperstructure",
  SingleKey = "singleKey",
  Config = "config",
  Events = "events",
  MarketHistory = "marketHistory",
  Leaderboard = "leaderboard",
}

type LoadingState = {
  [key in LoadingStateKey]: boolean;
};

export interface WorldStore {
  loadingStates: LoadingState;
  setLoading: (key: LoadingStateKey, value: boolean) => void;
}

export const createWorldStoreSlice = (set: any) => ({
  loadingStates: {
    [LoadingStateKey.Realm]: false,
    [LoadingStateKey.SpectatorRealm]: false,
    [LoadingStateKey.Market]: false,
    [LoadingStateKey.AllPlayerStructures]: false,
    [LoadingStateKey.Map]: false,
    [LoadingStateKey.Bank]: false,
    [LoadingStateKey.World]: false,
    [LoadingStateKey.Hyperstructure]: false,
    [LoadingStateKey.SingleKey]: false,
    [LoadingStateKey.Config]: false,
    [LoadingStateKey.Events]: false,
    [LoadingStateKey.Leaderboard]: false,
    [LoadingStateKey.MarketHistory]: false,
  },

  setLoading: (key: LoadingStateKey, value: boolean) =>
    set((state: WorldStore) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: value,
      },
    })),
});
