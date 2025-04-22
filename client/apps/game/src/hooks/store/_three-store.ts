import { ActionPath } from "@bibliothecadao/eternum";
import { BuildingType, HexPosition, ID, Position } from "@bibliothecadao/types";

export interface ThreeStore {
  navigationTarget: HexPosition | null;
  setNavigationTarget: (hex: HexPosition | null) => void;
  hoveredHex: HexPosition | null;
  setHoveredHex: (hex: HexPosition | null) => void;
  entityActions: EntityActions;
  setEntityActions: (entityActions: EntityActions) => void;
  updateEntityActionHoveredHex: (hoveredHex: HexPosition | null) => void;
  updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  updateEntityActionSelectedEntityId: (selectedEntityId: ID | null) => void;
  selectedHex: HexPosition | null;
  setSelectedHex: (hex: HexPosition | null) => void;
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
  hoveredHex: null,
  setHoveredHex: (hoveredHex: HexPosition | null) => set({ hoveredHex }),
  entityActions: {
    hoveredHex: null,
    actionPaths: new Map(),
    selectedEntityId: null,
  },
  setEntityActions: (entityActions: EntityActions) => set({ entityActions }),
  updateEntityActionHoveredHex: (hoveredHex: HexPosition | null) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, hoveredHex } })),
  updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, actionPaths } })),
  updateEntityActionSelectedEntityId: (selectedEntityId: ID | null) =>
    set((state: any) => ({ entityActions: { ...state.entityActions, selectedEntityId } })),
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex: HexPosition | null) => set({ selectedHex: hex }),
  hoveredBattle: null,
  setHoveredBattle: (hex: Position | null) => set({ hoveredBattle: hex }),
  selectedBuilding: BuildingType.ResourceWheat,
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
