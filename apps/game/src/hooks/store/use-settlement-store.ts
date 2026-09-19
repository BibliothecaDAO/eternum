import { Position } from "@bibliothecadao/eternum";

import { getBanksLocations } from "@/ui/features/settlement/utils/settlement-utils";
import type { SettlementLocation } from "@/ui/features/settlement/utils/settlement-types";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
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
  fetchBankLocations: (components: NativeFactStore) => void;
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
