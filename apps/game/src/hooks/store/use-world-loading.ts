/**
 * Represents the loading state of different parts of the application.
 * Each property indicates whether that part is currently loading data from the blockchain.
 */
export enum LoadingStateKey {
  Market = "market",
  AllPlayerStructures = "allPlayerStructures",
  Hyperstructure = "hyperstructure",
  MarketHistory = "marketHistory",
  Leaderboard = "leaderboard",
  Quest = "quest",
  ChunkTransition = "chunkTransition",
}

type LoadingState = {
  [key in LoadingStateKey]: boolean;
};

export interface WorldStore {
  loadingStates: LoadingState;
  setLoading: (key: LoadingStateKey, value: boolean) => void;
}

export const createWorldStoreSlice = (
  set: (partial: Partial<WorldStore> | ((state: WorldStore) => Partial<WorldStore>)) => void,
) => ({
  loadingStates: {
    [LoadingStateKey.Market]: false,
    [LoadingStateKey.AllPlayerStructures]: false,
    [LoadingStateKey.Hyperstructure]: false,
    [LoadingStateKey.Leaderboard]: false,
    [LoadingStateKey.MarketHistory]: false,
    [LoadingStateKey.Quest]: false,
    [LoadingStateKey.ChunkTransition]: false,
  },

  setLoading: (key: LoadingStateKey, value: boolean) =>
    set((state: WorldStore) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: value,
      },
    })),
});
