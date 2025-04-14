/**
 * Represents the loading state of different parts of the application.
 * Each property indicates whether that part is currently loading data from the blockchain.
 */
export enum LoadingStateKey {
  Market = "market",
  AllPlayerStructures = "allPlayerStructures",
  Map = "map",
  Hyperstructure = "hyperstructure",
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
    [LoadingStateKey.Market]: false,
    [LoadingStateKey.AllPlayerStructures]: false,
    [LoadingStateKey.Map]: false,
    [LoadingStateKey.Hyperstructure]: false,
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
