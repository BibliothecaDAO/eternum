import { ActionPath } from "@bibliothecadao/eternum";
import { BuildingType, HexPosition, ID, Position } from "@bibliothecadao/types";

import { deriveMapSelection, type MapSelectionIntent, withoutSelectedTile } from "./map-selection";

export interface ThreeStore {
  navigationTarget: HexPosition | null;
  setNavigationTarget: (hex: HexPosition | null) => void;
  cameraTargetHex: HexPosition | null;
  setCameraTargetHex: (hex: HexPosition | null) => void;
  hoveredHex: HexPosition | null;
  setHoveredHex: (hex: HexPosition | null) => void;
  entityActions: EntityActions;
  updateEntityActionHoveredHex: (hoveredHex: HexPosition | null) => void;
  updateEntityActionNextOrder: (nextOrder: NextOrder | null) => void;
  updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  /** The player's one selection on the map (map-selection.ts); `selectedHex` and the selected entity derive from it. */
  mapSelection: MapSelectionIntent;
  selectOnMap: (intent: MapSelectionIntent) => void;
  /** Closes the selected tile's card: a tile or structure is deselected, an army stays selected with no tile. */
  closeSelectedTile: () => void;
  /** Deselects the selected army or structure; a plain tile stays selected. */
  deselectEntity: () => void;
  /** Derives the selection again from where its entity stands now (the map calls it as its projection changes). */
  refreshMapSelection: () => void;
  /** Derived from `mapSelection`: the contract hex the tile panel, the selection ring and the cards name. */
  selectedHex: HexPosition | null;
  hoveredBattle: Position | null;
  setHoveredBattle: (hex: Position | null) => void;
  selectedBuilding: BuildingType;
  setSelectedBuilding: (building: BuildingType) => void;
  selectedBuildingEntityId: ID | null;
  setSelectedBuildingEntityId: (selectedBuildingEntityId: ID | null) => void;
  selectedBuildingHex: SelectedBuildingHex | null;
  setSelectedBuildingHex: (hexCoords: SelectedBuildingHex | null) => void;
}

export interface SelectedBuildingHex {
  structureId: number;
  innerCol: number;
  innerRow: number;
}

/** The tile a player tapped for an army whose last order is still in flight: that army's next order. */
export interface NextOrder {
  entityId: ID;
  hex: HexPosition;
}

interface EntityActions {
  hoveredHex: HexPosition | null;
  actionPaths: Map<string, ActionPath[]>;
  selectedEntityId: ID | null;
  nextOrder: NextOrder | null;
}

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

const areBuildingHexesEqual = (left: SelectedBuildingHex | null, right: SelectedBuildingHex | null): boolean =>
  left === right ||
  (left !== null &&
    right !== null &&
    left.structureId === right.structureId &&
    left.innerCol === right.innerCol &&
    left.innerRow === right.innerRow);

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
  hoveredHex: null,
  setHoveredHex: (hoveredHex: HexPosition | null) => {
    if (areHexesEqual(get().hoveredHex, hoveredHex)) return;
    set({ hoveredHex });
  },
  entityActions: {
    hoveredHex: null,
    actionPaths: new Map(),
    selectedEntityId: null,
    nextOrder: null,
  },
  updateEntityActionHoveredHex: (hoveredHex: HexPosition | null) => {
    if (areHexesEqual(get().entityActions.hoveredHex, hoveredHex)) return;
    set((state) => ({ entityActions: { ...state.entityActions, hoveredHex } }));
  },
  updateEntityActionNextOrder: (nextOrder: NextOrder | null) => {
    set((state) => ({ entityActions: { ...state.entityActions, nextOrder } }));
  },
  updateEntityActionActionPaths: (actionPaths: Map<string, ActionPath[]>) => {
    if (get().entityActions.actionPaths === actionPaths) return;
    set((state) => ({ entityActions: { ...state.entityActions, actionPaths } }));
  },
  // Nothing is selected until the player selects something: no stand-in hex at the origin.
  mapSelection: null,
  selectOnMap: (intent: MapSelectionIntent) => {
    set({ mapSelection: intent });
    get().refreshMapSelection();
  },
  closeSelectedTile: () => get().selectOnMap(withoutSelectedTile(get().mapSelection)),
  deselectEntity: () => {
    if (get().mapSelection?.kind !== "hex") get().selectOnMap(null);
  },
  refreshMapSelection: () => {
    const state = get();
    // The layer lives in the UI slice of the same store.
    const layer = Boolean((state as ThreeStore & { mapLayer?: boolean }).mapLayer);
    const { selectedEntityId, selectedHex } = deriveMapSelection(state.mapSelection, layer);
    const entityChanged = state.entityActions.selectedEntityId !== selectedEntityId;
    if (!entityChanged && areHexesEqual(state.selectedHex, selectedHex)) return;
    set((current) => ({
      selectedHex,
      // An entity's offered orders are its own: another selection starts with none until the map plans them.
      entityActions: entityChanged
        ? { ...current.entityActions, selectedEntityId, actionPaths: new Map() }
        : current.entityActions,
    }));
  },
  selectedHex: null,
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
  selectedBuildingHex: null,
  setSelectedBuildingHex: (hexCoords: SelectedBuildingHex | null) => {
    const selectedBuildingHex = hexCoords ? { ...hexCoords } : null;
    if (areBuildingHexesEqual(get().selectedBuildingHex, selectedBuildingHex)) return;
    set({ selectedBuildingHex });
  },
});
