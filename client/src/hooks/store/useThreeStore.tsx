import { HexPosition } from "@/types";
import { BuildingType, Position } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { useEffect } from "react";

interface ArmyActions {
  hoveredHex: { col: number; row: number; x: number; z: number } | null;
  travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>;
  selectedEntityId: number | null;
}

export interface ThreeStore {
  armyActions: ArmyActions;
  setArmyActions: (armyActions: ArmyActions) => void;
  updateHoveredHex: (hoveredHex: { col: number; row: number; x: number; z: number } | null) => void;
  updateTravelPaths: (travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>) => void;
  updateSelectedEntityId: (id: number | null) => void;

  selectedHex: HexPosition;
  setSelectedHex: (hex: HexPosition) => void;

  hoveredArmyEntityId: number | null;
  setHoveredArmyEntityId: (id: number | null) => void;

  selectedBuilding: BuildingType;
  setSelectedBuilding: (building: BuildingType) => void;
}

export const useThreeStore = create<ThreeStore>((set, get) => ({
  armyActions: {
    hoveredHex: null,
    travelPaths: new Map(),
    selectedEntityId: null,
  },
  setArmyActions: (armyActions) => set({ armyActions }),
  updateHoveredHex: (hoveredHex) => set((state) => ({ armyActions: { ...state.armyActions, hoveredHex } })),
  updateTravelPaths: (travelPaths) => set((state) => ({ armyActions: { ...state.armyActions, travelPaths } })),
  updateSelectedEntityId: (selectedEntityId) =>
    set((state) => ({ armyActions: { ...state.armyActions, selectedEntityId } })),
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex) => set({ selectedHex: hex }),

  hoveredArmyEntityId: null,
  setHoveredArmyEntityId: (hoveredArmyEntityId) =>
    set({
      hoveredArmyEntityId,
    }),

  selectedBuilding: BuildingType.Farm,
  setSelectedBuilding: (building) => set({ selectedBuilding: building }),
}));

// Custom hook to log selectedEntityId changes
export const useLogSelectedEntityId = () => {
  const selectedEntityId = useThreeStore((state) => state.armyActions.selectedEntityId);

  useEffect(() => {
    console.log("selectedEntityId changed:", selectedEntityId);
  }, [selectedEntityId]);
};
