import { ActionPath } from "@bibliothecadao/eternum";
import { BuildingType, HexPosition, ID, Position } from "@bibliothecadao/types";

import { deriveMapSelection, type MapSelectionIntent, withoutSelectedTile } from "./map-selection";

export interface ThreeStore {
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
  /**
   * What the map had selected when a HUD surface opened over it and let go of the tile (one panel at a time): a phone's
   * Chat, opened from its tab, can still share it. Any later selection, or none, replaces it.
   */
  setAsidePick: MapSelectionIntent;
  /** Closes the selected tile's card for a surface, keeping what was selected as `setAsidePick`. */
  setTileAsideForSurface: () => void;
  /** Deselects the selected army or structure; a plain tile stays selected. */
  deselectEntity: () => void;
  /**
   * The army whose loss made the map let go of the selection (the map's own cleanup, never a player's choice), until the
   * player picks anything: an order it had out still tells its outcome (useOrderSettledReturnsToTheArmy).
   */
  selectionLostWith: ID | null;
  /** The map lets go of the selected army because it is gone, saying so (selectionLostWith). */
  letGoOfLostArmy: () => void;
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
    // A pick of anything is the player's newer choice: the lost army's mark goes with it.
    set({ mapSelection: intent, setAsidePick: null, ...(intent !== null && { selectionLostWith: null }) });
    get().refreshMapSelection();
  },
  closeSelectedTile: () => get().selectOnMap(withoutSelectedTile(get().mapSelection)),
  setAsidePick: null,
  setTileAsideForSurface: () => {
    const picked = get().mapSelection;
    get().closeSelectedTile();
    set({ setAsidePick: picked });
  },
  deselectEntity: () => {
    if (get().mapSelection?.kind !== "hex") get().selectOnMap(null);
  },
  selectionLostWith: null,
  letGoOfLostArmy: () => {
    const lost = get().entityActions.selectedEntityId;
    get().deselectEntity();
    set({ selectionLostWith: lost });
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
