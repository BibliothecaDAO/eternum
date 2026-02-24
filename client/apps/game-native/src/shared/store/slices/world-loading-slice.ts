export enum LoadingStateKey {
  SelectedStructure = 'selectedStructure',
  Market = 'market',
  PlayerStructuresOneKey = 'playerStructuresOneKey',
  PlayerStructuresTwoKey = 'playerStructuresTwoKey',
  DonkeysAndArmies = 'donkeysAndArmies',
  Map = 'map',
  Bank = 'bank',
  World = 'world',
  Hyperstructure = 'hyperstructure',
  SingleKey = 'singleKey',
  Config = 'config',
  Events = 'events',
}

type LoadingState = {
  [key in LoadingStateKey]: boolean;
};

export interface WorldSlice {
  loadingStates: LoadingState;
  setLoading: (key: LoadingStateKey, value: boolean) => void;
}

export const createWorldSlice = (set: any): WorldSlice => ({
  loadingStates: {
    [LoadingStateKey.SelectedStructure]: false,
    [LoadingStateKey.Market]: false,
    [LoadingStateKey.PlayerStructuresOneKey]: false,
    [LoadingStateKey.PlayerStructuresTwoKey]: false,
    [LoadingStateKey.DonkeysAndArmies]: false,
    [LoadingStateKey.Map]: false,
    [LoadingStateKey.Bank]: false,
    [LoadingStateKey.World]: false,
    [LoadingStateKey.Hyperstructure]: false,
    [LoadingStateKey.SingleKey]: false,
    [LoadingStateKey.Config]: false,
    [LoadingStateKey.Events]: false,
  },
  setLoading: (key: LoadingStateKey, value: boolean) =>
    set((state: WorldSlice) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: value,
      },
    })),
});
