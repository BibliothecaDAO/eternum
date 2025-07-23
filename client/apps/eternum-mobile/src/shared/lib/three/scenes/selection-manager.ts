import { ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";
import { FELT_CENTER } from "@bibliothecadao/types";
import * as THREE from "three";
import { HighlightRenderer } from "./highlight-renderer";
import { GameMapObject, ObjectRenderer } from "./object-renderer";

export interface SelectionState {
  selectedObjectId: number | null;
  selectedObjectType: string | null;
  actionPaths: Map<string, ActionPath[]>;
}

export class SelectionManager {
  private highlightRenderer: HighlightRenderer;
  private objectRenderers: Map<string, ObjectRenderer<any>> = new Map();
  private currentSelection: SelectionState = {
    selectedObjectId: null,
    selectedObjectType: null,
    actionPaths: new Map(),
  };

  private readonly HIGHLIGHT_COLORS = {
    [ActionType.Move]: new THREE.Color(0x00ff00),
    [ActionType.Attack]: new THREE.Color(0xff0000),
    [ActionType.Help]: new THREE.Color(0x0088ff),
    [ActionType.Explore]: new THREE.Color(0xffaa00),
    [ActionType.Quest]: new THREE.Color(0x8800ff),
    [ActionType.Build]: new THREE.Color(0xff8800),
  };

  constructor(highlightRenderer: HighlightRenderer) {
    this.highlightRenderer = highlightRenderer;
  }

  public registerObjectRenderer(type: string, renderer: ObjectRenderer<any>): void {
    this.objectRenderers.set(type, renderer);
  }

  public selectObject(objectId: number, objectType: string): void {
    this.clearSelection();

    const renderer = this.objectRenderers.get(objectType);
    if (!renderer) {
      console.warn(`No renderer found for object type: ${objectType}`);
      return;
    }

    const object = renderer.getObject(objectId);
    if (!object) {
      console.warn(`Object with id ${objectId} not found in ${objectType} renderer`);
      return;
    }

    this.currentSelection.selectedObjectId = objectId;
    this.currentSelection.selectedObjectType = objectType;

    renderer.selectObject(objectId);
  }

  public setActionPaths(actionPaths: Map<string, ActionPath[]>): void {
    this.currentSelection.actionPaths = actionPaths;
    this.highlightActionPaths(actionPaths);
  }

  public clearSelection(): void {
    if (this.currentSelection.selectedObjectId && this.currentSelection.selectedObjectType) {
      const renderer = this.objectRenderers.get(this.currentSelection.selectedObjectType);
      if (renderer) {
        renderer.deselectObject();
      }
    }

    this.highlightRenderer.clearHighlights();
    this.currentSelection = {
      selectedObjectId: null,
      selectedObjectType: null,
      actionPaths: new Map(),
    };
  }

  public getSelectedObject(): { id: number; type: string; object: GameMapObject } | null {
    if (!this.currentSelection.selectedObjectId || !this.currentSelection.selectedObjectType) {
      return null;
    }

    const renderer = this.objectRenderers.get(this.currentSelection.selectedObjectType);
    if (!renderer) {
      return null;
    }

    const object = renderer.getObject(this.currentSelection.selectedObjectId);
    if (!object) {
      return null;
    }

    return {
      id: this.currentSelection.selectedObjectId,
      type: this.currentSelection.selectedObjectType,
      object: object as GameMapObject,
    };
  }

  public isObjectSelected(objectId: number, objectType: string): boolean {
    return (
      this.currentSelection.selectedObjectId === objectId && this.currentSelection.selectedObjectType === objectType
    );
  }

  public getActionPath(col: number, row: number): ActionPath[] | undefined {
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return this.currentSelection.actionPaths.get(key);
  }

  public hasActionAt(col: number, row: number): boolean {
    const key = ActionPaths.posKey({ col: col + FELT_CENTER, row: row + FELT_CENTER });
    return this.currentSelection.actionPaths.has(key);
  }

  private highlightActionPaths(actionPaths: Map<string, ActionPath[]>): void {
    this.highlightRenderer.clearHighlights();

    const highlightedHexes = new Set<string>();

    for (const [key, path] of actionPaths) {
      if (path.length < 2) continue;

      const targetAction = path[path.length - 1];
      const targetHex = targetAction.hex;

      const normalizedCol = targetHex.col - FELT_CENTER;
      const normalizedRow = targetHex.row - FELT_CENTER;

      const hexKey = `${normalizedCol},${normalizedRow}`;
      if (highlightedHexes.has(hexKey)) continue;

      highlightedHexes.add(hexKey);

      const color = this.HIGHLIGHT_COLORS[targetAction.actionType] || this.HIGHLIGHT_COLORS[ActionType.Move];
      this.highlightRenderer.addHighlight(normalizedCol, normalizedRow, color, 2.0, 0.4);
    }
  }

  public addHighlight(
    col: number,
    row: number,
    color: THREE.Color,
    pulseSpeed?: number,
    pulseIntensity?: number,
  ): void {
    this.highlightRenderer.addHighlight(col, row, color, pulseSpeed, pulseIntensity);
  }

  public removeHighlight(col: number, row: number): void {
    this.highlightRenderer.removeHighlight(col, row);
  }

  public clearHighlights(): void {
    this.highlightRenderer.clearHighlights();
  }

  public dispose(): void {
    this.clearSelection();
  }
}
