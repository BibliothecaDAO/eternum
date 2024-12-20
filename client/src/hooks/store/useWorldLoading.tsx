/**
 * Represents the loading state of different parts of the application.
 * Each property indicates whether that part is currently loading data from the blockchain.
 */
export enum LoadingStateKey {
  SelectedStructure = "selectedStructure",
  Market = "market",
  PlayerStructuresOneKey = "playerStructuresOneKey",
  PlayerStructuresTwoKey = "playerStructuresTwoKey",
  Arrivals = "arrivals",
  Map = "map",
  Bank = "bank",
  World = "world",
  Hyperstructure = "hyperstructure",
  SingleKey = "singleKey",
  Config = "config",
  Events = "events",
}

export type LoadingState = {
  [key in LoadingStateKey]: boolean;
};

export interface WorldStore {
  loadingStates: LoadingState;
  setLoading: (key: LoadingStateKey, value: boolean) => void;
}

export const createWorldStoreSlice = (set: any) => ({
  loadingStates: {
    [LoadingStateKey.SelectedStructure]: false,
    [LoadingStateKey.Market]: false,
    [LoadingStateKey.PlayerStructuresOneKey]: false,
    [LoadingStateKey.PlayerStructuresTwoKey]: false,
    [LoadingStateKey.Arrivals]: false,
    [LoadingStateKey.Map]: false,
    [LoadingStateKey.Bank]: false,
    [LoadingStateKey.World]: false,
    [LoadingStateKey.Hyperstructure]: false,
    [LoadingStateKey.SingleKey]: false,
    [LoadingStateKey.Config]: false,
    [LoadingStateKey.Events]: false,
  },

  setLoading: (key: LoadingStateKey, value: boolean) =>
    set((state: WorldStore) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: value,
      },
    })),
});
