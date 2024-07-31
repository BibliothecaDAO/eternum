import { HexPosition } from "@/types";
import { BuildingType, Position } from "@bibliothecadao/eternum";

export interface ThreeStore {
  armyActions: ArmyActions;
  setArmyActions: (armyActions: ArmyActions) => void;
  updateHoveredHex: (hoveredHex: { col: number; row: number; x: number; z: number } | null) => void;
  updateTravelPaths: (travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>) => void;
  updateSelectedEntityId: (selectedEntityId: number | null) => void;
  selectedHex: HexPosition;
  setSelectedHex: (hex: HexPosition) => void;
  hoveredArmyEntityId: number | null;
  setHoveredArmyEntityId: (id: number | null) => void;
  selectedBuilding: BuildingType;
  setSelectedBuilding: (building: BuildingType) => void;
}

interface ArmyActions {
  hoveredHex: { col: number; row: number; x: number; z: number } | null;
  travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>;
  selectedEntityId: number | null;
}

export const createThreeStoreSlice = (set: any, get: any) => ({
  armyActions: {
    hoveredHex: null,
    travelPaths: new Map(),
    selectedEntityId: null,
  },
  setArmyActions: (armyActions: ArmyActions) => set({ armyActions }),
  updateHoveredHex: (hoveredHex: { col: number; row: number; x: number; z: number } | null) =>
    set((state: any) => ({ armyActions: { ...state.armyActions, hoveredHex } })),
  updateTravelPaths: (travelPaths: Map<string, { path: HexPosition[]; isExplored: boolean }>) =>
    set((state: any) => ({ armyActions: { ...state.armyActions, travelPaths } })),
  updateSelectedEntityId: (selectedEntityId: number | null) =>
    set((state: any) => ({ armyActions: { ...state.armyActions, selectedEntityId } })),
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex: HexPosition) => set({ selectedHex: hex }),
  hoveredArmyEntityId: null,
  setHoveredArmyEntityId: (hoveredArmyEntityId: number | null) => set({ hoveredArmyEntityId }),
  selectedBuilding: BuildingType.Farm,
  setSelectedBuilding: (building: BuildingType) => set({ selectedBuilding: building }),
});
