import { ActionPath } from "@bibliothecadao/eternum";
import { BuildingType, HexPosition, ID, Position } from "@bibliothecadao/types";

import {
  WORLDMAP_STRATEGIC_ENTRY_SCALE,
  type WorldNavigationMode,
} from "@/three/scenes/worldmap-navigation/world-navigation-mode-machine";

export interface ThreeStore {
  navigationTarget: HexPosition | null;
  setNavigationTarget: (hex: HexPosition | null) => void;
  cameraTargetHex: HexPosition | null;
  setCameraTargetHex: (hex: HexPosition | null) => void;
  cameraDistance: number | null;
  setCameraDistance: (distance: number | null) => void;
  worldNavigationMode: WorldNavigationMode;
  setWorldNavigationMode: (mode: WorldNavigationMode) => void;
  worldNavigationZoomLevel: number;
  setWorldNavigationZoomLevel: (zoomLevel: number) => void;
  worldNavigationTransitionProgress: number;
  setWorldNavigationTransitionProgress: (progress: number) => void;
  // In 3D/transition this tracks the live projection-matched overlay scale.
  // In strategic mode it becomes the user-controlled zoom scale.
  strategicMapScale: number;
  setStrategicMapScale: (scale: number) => void;
  strategicMapCenterHex: HexPosition | null;
  setStrategicMapCenterHex: (hex: HexPosition | null) => void;
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
  cameraTargetHex: null,
  setCameraTargetHex: (hex: HexPosition | null) => set({ cameraTargetHex: hex }),
  cameraDistance: null,
  setCameraDistance: (distance: number | null) => set({ cameraDistance: distance }),
  worldNavigationMode: "three_d" as WorldNavigationMode,
  setWorldNavigationMode: (worldNavigationMode: WorldNavigationMode) => set({ worldNavigationMode }),
  worldNavigationZoomLevel: 0,
  setWorldNavigationZoomLevel: (worldNavigationZoomLevel: number) => set({ worldNavigationZoomLevel }),
  worldNavigationTransitionProgress: 0,
  setWorldNavigationTransitionProgress: (worldNavigationTransitionProgress: number) =>
    set({ worldNavigationTransitionProgress }),
  strategicMapScale: WORLDMAP_STRATEGIC_ENTRY_SCALE,
  setStrategicMapScale: (strategicMapScale: number) => set({ strategicMapScale }),
  strategicMapCenterHex: null,
  setStrategicMapCenterHex: (strategicMapCenterHex: HexPosition | null) => set({ strategicMapCenterHex }),
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
