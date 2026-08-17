import { Position } from "@bibliothecadao/eternum";

import { getBanksLocations, SettlementLocation } from "@/ui/features/settlement";
import { ClientComponents } from "@bibliothecadao/types";
import { create } from "zustand";

interface SettlementState {
  selectedLocation: SettlementLocation | null;
  bankLocations: SettlementLocation[];
  bankIcon: HTMLImageElement | null;
  selectedCoords: Position | null;
  actions: SettlementActions;
}

interface SettlementActions {
  setSelectedLocation: (location: SettlementLocation | null) => void;
  setBankIcon: (icon: HTMLImageElement | null) => void;
  fetchBankLocations: (components: ClientComponents) => void;
}

const useSettlementStore = create<SettlementState>((set) => ({
  selectedLocation: null,
  bankLocations: [],
  bankIcon: null,
  selectedCoords: null,
  actions: {
    setSelectedLocation: (location) => {
      let selectedCoordsValue: Position | null = null;
      if (location) {
        selectedCoordsValue = new Position({
          x: location.x,
          y: location.y,
        }); //.getNormalized(); // Assuming Position constructor normalizes or getNormalized() is called elsewhere if needed by consumers
      }
      set({ selectedLocation: location, selectedCoords: selectedCoordsValue });
    },
    setBankIcon: (icon) => set({ bankIcon: icon }),
    fetchBankLocations: (components) => {
      const bankLocations = getBanksLocations(components);
      set({ bankLocations });
    },
  },
}));

export default useSettlementStore;
