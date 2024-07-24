import { HexPosition } from "@/types";
import { BuildingType, Position } from "@bibliothecadao/eternum";
import { create } from "zustand";
import { useEffect } from "react";

export interface ThreeStore {
  // hex
  hoveredHex: { col: number; row: number; x: number; z: number };
  setHoveredHex: (hex: { col: number; row: number; x: number; z: number }) => void;

  selectedHex: HexPosition;
  setSelectedHex: (hex: HexPosition) => void;

  // moving armies
  travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>;
  setTravelPaths: (travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>) => void;

  // entities on the map
  selectedEntityId: number | null;
  setSelectedEntityId: (entityId: number | null) => void;

  // Hexception
  setSelectedBuilding: (building: BuildingType) => void;
  selectedBuilding: BuildingType;
}

export const useThreeStore = create<ThreeStore>((set, get) => ({
  hoveredHex: { col: 0, row: 0, x: 0, z: 0 },
  setHoveredHex: (hex) => set({ hoveredHex: hex }),
  travelPaths: new Map(),
  setTravelPaths: (travelPaths) => set({ travelPaths }),
  selectedEntityId: null,
  setSelectedEntityId: (entityId) => set({ selectedEntityId: entityId }),
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex) => set({ selectedHex: hex }),
  selectedBuilding: BuildingType.Farm,
  setSelectedBuilding: (building) => set({ selectedBuilding: building }),
}));

// Custom hook to log selectedEntityId changes
export const useLogSelectedEntityId = () => {
  const selectedEntityId = useThreeStore((state) => state.selectedEntityId);

  useEffect(() => {
    console.log("selectedEntityId changed:", selectedEntityId);
  }, [selectedEntityId]);
};
