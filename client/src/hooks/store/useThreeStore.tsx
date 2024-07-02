import { HexPosition } from "@/types";
import { BuildingType } from "@bibliothecadao/eternum";
import { create } from "zustand";

export interface ThreeStore {
  selectedHex: HexPosition;
  selectedUnit: HexPosition;
  setSelectedHex: (hex: HexPosition) => void;
  setSelectedUnit: (unit: HexPosition) => void;

  // Hexception
  setSelectedBuilding: (building: BuildingType) => void;
  selectedBuilding: BuildingType;
}

export const useThreeStore = create<ThreeStore>((set, get) => ({
  selectedHex: { col: 0, row: 0 },
  selectedUnit: { col: 0, row: 0 },
  setSelectedHex: (hex) => set({ selectedHex: hex }),
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  selectedBuilding: BuildingType.Farm,
  setSelectedBuilding: (building) => set({ selectedBuilding: building }),
}));
