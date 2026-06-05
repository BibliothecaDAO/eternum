import { ActionPath } from "@bibliothecadao/eternum";
import { BuildingType, HexPosition, ID, Position } from "@bibliothecadao/types";

export interface ThreeStore {
  navigationTarget: HexPosition | null;
  setNavigationTarget: (hex: HexPosition | null) => void;
  cameraTargetHex: HexPosition | null;
  setCameraTargetHex: (hex: HexPosition | null) => void;
  cameraDistance: number | null;
  setCameraDistance: (distance: number | null) => void;
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
  selectedBuildingEntityId: ID | null;
  setSelectedBuildingEntityId: (selectedBuildingEntityId: ID | null) => void;
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

const CAMERA_DISTANCE_EPSILON = 0.5;

const areHexesEqual = (left: HexPosition | null, right: HexPosition | null): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.col === right.col && left.row === right.row;
};

const arePositionsEqual = (left: Position | null, right: Position | null): boolean => {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y;
};

const areBuildingHexesEqual = (
  left: ThreeStore["selectedBuildingHex"],
  right: ThreeStore["selectedBuildingHex"],
): boolean =>
  left.outerCol === right.outerCol &&
  left.outerRow === right.outerRow &&
  left.innerCol === right.innerCol &&
  left.innerRow === right.innerRow;

const areCameraDistancesEqual = (left: number | null, right: number | null): boolean => {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return Math.abs(left - right) < CAMERA_DISTANCE_EPSILON;
};

export const createThreeStoreSlice = (
  set: (partial: Partial<ThreeStore> | ((state: ThreeStore) => Partial<ThreeStore>)) => void,
  get: () => ThreeStore,
) => ({
  navigationTarget: null,
  setNavigationTarget: (hex: HexPosition | null) => {
    if (areHexesEqual(get().navigationTarget, hex)) return;
    set({ navigationTarget: hex });
  },
  cameraTargetHex: null,
  setCameraTargetHex: (hex: HexPosition | null) => {
    if (areHexesEqual(get().cameraTargetHex, hex)) return;
    set({ cameraTargetHex: hex });
  },
  cameraDistance: null,
  setCameraDistance: (distance: number | null) => {
    if (areCameraDistancesEqual(get().cameraDistance, distance)) return;
    set({ cameraDistance: distance });
  },
  hoveredHex: null,
  setHoveredHex: (hoveredHex: HexPosition | null) => {
    if (areHexesEqual(get().hoveredHex, hoveredHex)) return;
    set({ hoveredHex });
  },
  entityActions: {
    hoveredHex: null,
    actionPaths: new Map(),
    selectedEntityId: null,
  },
  setEntityActions: (entityActions: EntityActions) => {
    const currentActions = get().entityActions;
    if (
      areHexesEqual(currentActions.hoveredHex, entityActions.hoveredHex) &&
      currentActions.actionPaths === entityActions.actionPaths &&
      currentActions.selectedEntityId === entityActions.selectedEntityId
    ) {
      return;
    }
    set({ entityActions });
  },
  updateEntityActionHoveredHex: (hoveredHex: HexPosition | null) => {
    if (areHexesEqual(get().entityActions.hoveredHex, hoveredHex)) return;
    set((state) => ({ entityActions: { ...state.entityActions, hoveredHex } }));
  },
  updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) => {
    if (get().entityActions.actionPaths === actionPaths) return;
    set((state) => ({ entityActions: { ...state.entityActions, actionPaths } }));
  },
  updateEntityActionSelectedEntityId: (selectedEntityId: ID | null) => {
    if (get().entityActions.selectedEntityId === selectedEntityId) return;
    set((state) => ({ entityActions: { ...state.entityActions, selectedEntityId } }));
  },
  selectedHex: { col: 0, row: 0 },
  setSelectedHex: (hex: HexPosition | null) => {
    if (areHexesEqual(get().selectedHex, hex)) return;
    set({ selectedHex: hex });
  },
  hoveredBattle: null,
  setHoveredBattle: (hex: Position | null) => {
    if (arePositionsEqual(get().hoveredBattle, hex)) return;
    set({ hoveredBattle: hex });
  },
  selectedBuilding: BuildingType.ResourceWheat,
  setSelectedBuilding: (building: BuildingType) => {
    if (get().selectedBuilding === building) return;
    set({ selectedBuilding: building });
  },
  selectedBuildingEntityId: null,
  setSelectedBuildingEntityId: (selectedBuildingEntityId: ID | null) => {
    if (get().selectedBuildingEntityId === selectedBuildingEntityId) return;
    set({ selectedBuildingEntityId });
  },
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
  }) => {
    const selectedBuildingHex = { outerCol, outerRow, innerCol, innerRow };
    if (areBuildingHexesEqual(get().selectedBuildingHex, selectedBuildingHex)) return;
    set({ selectedBuildingHex });
  },
});
