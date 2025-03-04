import { StructureInfo } from "@/three/types";
import { ActionPath, BuildingType, HexPosition, ID, Position } from "@bibliothecadao/eternum";

export interface ThreeStore {
  navigationTarget: HexPosition | null;
  setNavigationTarget: (hex: HexPosition | null) => void;
  entityActions: EntityActions;
  setEntityActions: (entityActions: EntityActions) => void;
  updateHoveredHex: (hoveredHex: HexPosition | null) => void;
  updateActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  updateSelectedEntityId: (selectedEntityId: ID | null) => void;
  selectedHex: HexPosition | null;
  setSelectedHex: (hex: HexPosition | null) => void;
  hoveredArmyEntityId: ID | null;
  setHoveredArmyEntityId: (id: ID | null) => void;
  hoveredStructure: StructureInfo | null;
  setHoveredStructure: (structure: StructureInfo | null) => void;
  hoveredBattle: Position | null;
  setHoveredBattle: (hex: Position | null) => void;
  selectedBuilding: BuildingType;
  setSelectedBuilding: (building: BuildingType) => void;
  selectedBuildingHex: {
    outerCol: number;
    outerRow: number;
    innerCol: number;
    innerRow: number;
  };
  setSelectedBuildingHex: (hexCoords: {
    outerCol: number;
    outerRow: number;
    innerCol: number;
    innerRow: number;
  }) => void;
}

interface EntityActions {
  hoveredHex: HexPosition | null;
  actionPaths: Map<string, ActionPath[]>;
  selectedEntityId: ID | null;
}

export const createThreeStoreSlice = (set: any, _get: any) => ({
  navigationTarget: null,
  setNavigationTarget: (hex: HexPosition | null) => set({ navigationTarget: hex }),
  entityActions: {
    hoveredHex: null,
    actionPaths: new Map(),
    selectedEntityId: null,
  },
  setEntityActions: (entityActions: EntityActions) => set({ entityActions }),
  updateHoveredHex: (hoveredHex: HexPosition | null) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, hoveredHex } })),
  updateActionPaths: (actionPaths: Map<string, ActionPath[]>) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, actionPaths } })),
  updateSelectedEntityId: (selectedEntityId: ID | null) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, selectedEntityId } })),
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex: HexPosition | null) => set({ selectedHex: hex }),
  hoveredArmyEntityId: null,
  setHoveredArmyEntityId: (id: ID | null) => set({ hoveredArmyEntityId: id }),
  hoveredStructure: null,
  setHoveredStructure: (structure: StructureInfo | null) => set({ hoveredStructure: structure }),
  hoveredBattle: null,
  setHoveredBattle: (hex: Position | null) => set({ hoveredBattle: hex }),
  selectedBuilding: BuildingType.Farm,
  setSelectedBuilding: (building: BuildingType) => set({ selectedBuilding: building }),
  selectedBuildingEntityId: null,
  setSelectedBuildingEntityId: (selectedBuildingEntityId: ID | null) => set({ selectedBuildingEntityId }),
  selectedBuildingHex: { outerCol: 0, outerRow: 0, innerCol: 0, innerRow: 0 },
  setSelectedBuildingHex: ({
    outerCol,
    outerRow,
    innerCol,
    innerRow,
  }: {
    outerCol: number;
    outerRow: number;
    innerCol: number;
    innerRow: number;
  }) => set({ selectedBuildingHex: { outerCol, outerRow, innerCol, innerRow } }),
});
