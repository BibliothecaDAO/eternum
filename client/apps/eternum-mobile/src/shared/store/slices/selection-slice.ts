import { ActionPath, ActionPaths, FELT_CENTER as getFeltCenterOffset } from "@bibliothecadao/eternum";
import { HexPosition } from "@bibliothecadao/types";

export interface SelectionSlice {
  selectedObjectId: number | null;
  selectedObjectType: string | null;
  selectedHex: HexPosition | null;
  actionPaths: Map<string, ActionPath[]>;
  isDoubleClickedObject: boolean;
  setSelectedObject: (objectId: number | null, objectType: string | null, col: number, row: number) => void;
  setActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  clearSelection: () => void;
  getSelectedObject: () => { id: number; type: string } | null;
  isObjectSelected: (objectId: number, objectType: string) => boolean;
  hasActionAt: (col: number, row: number) => boolean;
  getActionPath: (col: number, row: number) => ActionPath[] | undefined;
  handleObjectClick: (objectId: number, objectType: string, col: number, row: number) => boolean;
  resetDoubleClickState: () => void;
}

export const createSelectionSlice = (set: any, get: any) => ({
  selectedObjectId: null,
  selectedObjectType: null,
  selectedHex: null,
  actionPaths: new Map<string, ActionPath[]>(),
  isDoubleClickedObject: false,

  setSelectedObject: (objectId: number | null, objectType: string | null, col: number, row: number) => {
    set({
      selectedObjectId: objectId,
      selectedObjectType: objectType,
      selectedHex: { col, row },
    });
  },

  setActionPaths: (actionPaths: Map<string, ActionPath[]>) => {
    set({ actionPaths });
  },

  clearSelection: () => {
    set({
      selectedObjectId: null,
      selectedObjectType: null,
      actionPaths: new Map<string, ActionPath[]>(),
      isDoubleClickedObject: false,
    });
  },

  getSelectedObject: () => {
    const state = get();
    if (!state.selectedObjectId || !state.selectedObjectType) {
      return null;
    }
    return {
      id: state.selectedObjectId,
      type: state.selectedObjectType,
    };
  },

  isObjectSelected: (objectId: number, objectType: string) => {
    const state = get();
    return state.selectedObjectId === objectId && state.selectedObjectType === objectType;
  },

  hasActionAt: (col: number, row: number) => {
    const FELT_CENTER = getFeltCenterOffset();
    const state = get();
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return state.actionPaths.has(key);
  },

  getActionPath: (col: number, row: number) => {
    const FELT_CENTER = getFeltCenterOffset();
    const state = get();
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return state.actionPaths.get(key);
  },

  handleObjectClick: (objectId: number, objectType: string, col: number, row: number) => {
    const state = get();
    const isSameObject = state.selectedObjectId === objectId && state.selectedObjectType === objectType;

    if (isSameObject) {
      // Second click on the same object - mark as double clicked
      set({
        isDoubleClickedObject: true,
        selectedHex: { col, row },
      });
      return true; // Indicates this is a double click
    } else {
      // First click on a new object - select it but don't mark as double clicked
      set({
        selectedObjectId: objectId,
        selectedObjectType: objectType,
        selectedHex: { col, row },
        isDoubleClickedObject: false,
      });
      return false; // Indicates this is a first click
    }
  },

  resetDoubleClickState: () => {
    set({
      isDoubleClickedObject: false,
    });
  },
});
