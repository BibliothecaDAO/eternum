import { ActionPath } from "@bibliothecadao/eternum";

export interface SelectionSlice {
  selectedObjectId: number | null;
  selectedObjectType: string | null;
  actionPaths: Map<string, ActionPath[]>;
  setSelectedObject: (objectId: number | null, objectType: string | null) => void;
  setActionPaths: (actionPaths: Map<string, ActionPath[]>) => void;
  clearSelection: () => void;
  getSelectedObject: () => { id: number; type: string } | null;
  isObjectSelected: (objectId: number, objectType: string) => boolean;
  hasActionAt: (col: number, row: number) => boolean;
  getActionPath: (col: number, row: number) => ActionPath[] | undefined;
}

export const createSelectionSlice = (set: any, get: any) => ({
  selectedObjectId: null,
  selectedObjectType: null,
  actionPaths: new Map<string, ActionPath[]>(),

  setSelectedObject: (objectId: number | null, objectType: string | null) => {
    set({
      selectedObjectId: objectId,
      selectedObjectType: objectType,
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
    const state = get();
    const { ActionPaths } = require("@bibliothecadao/eternum");
    const { FELT_CENTER } = require("@bibliothecadao/types");
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return state.actionPaths.has(key);
  },

  getActionPath: (col: number, row: number) => {
    const state = get();
    const { ActionPaths } = require("@bibliothecadao/eternum");
    const { FELT_CENTER } = require("@bibliothecadao/types");
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return state.actionPaths.get(key);
  },
});
