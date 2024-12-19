export interface WorldStore {
  isSelectedStructureLoading: boolean;
  isMarketLoading: boolean;
  isPlayerStructuresLoading: boolean;
  isArrivalsLoading: boolean;
  isMapLoading: boolean;
  isBankLoading: boolean;
  isWorldLoading: boolean;
  isHyperstructureLoading: boolean;
  isSingleKeyLoading: boolean;
  isConfigLoading: boolean;
  setSelectedStructureLoading: (loading: boolean) => void;
  setMarketLoading: (loading: boolean) => void;
  setPlayerStructuresLoading: (loading: boolean) => void;
  setArrivalsLoading: (loading: boolean) => void;
  setMapLoading: (loading: boolean) => void;
  setBankLoading: (loading: boolean) => void;
  setWorldLoading: (loading: boolean) => void;
  setHyperstructureLoading: (loading: boolean) => void;
  setSingleKeyLoading: (loading: boolean) => void;
  setConfigLoading: (loading: boolean) => void;
}

export const createWorldStoreSlice = (set: any) => ({
  isSelectedStructureLoading: false,
  isMarketLoading: false,
  isPlayerStructuresLoading: false,
  isArrivalsLoading: false,
  isMapLoading: false,
  isBankLoading: false,
  isWorldLoading: false,
  isHyperstructureLoading: false,
  isSingleKeyLoading: false,
  isConfigLoading: false,
  setSelectedStructureLoading: (loading: boolean) => set({ isSelectedStructureLoading: loading }),
  setMarketLoading: (loading: boolean) => set({ isMarketLoading: loading }),
  setPlayerStructuresLoading: (loading: boolean) => set({ isPlayerStructuresLoading: loading }),
  setArrivalsLoading: (loading: boolean) => set({ isArrivalsLoading: loading }),
  setMapLoading: (loading: boolean) => set({ isMapLoading: loading }),
  setBankLoading: (loading: boolean) => set({ isBankLoading: loading }),
  setWorldLoading: (loading: boolean) => set({ isWorldLoading: loading }),
  setHyperstructureLoading: (loading: boolean) => set({ isHyperstructureLoading: loading }),
  setSingleKeyLoading: (loading: boolean) => set({ isSingleKeyLoading: loading }),
  setConfigLoading: (loading: boolean) => set({ isConfigLoading: loading }),
});
