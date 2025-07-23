import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import { FELT_CENTER } from "@bibliothecadao/types";
import * as THREE from "three";
import useStore from "../../../store";
import { HighlightRenderer } from "./highlight-renderer";
import { GameMapObject, ObjectRenderer } from "./object-renderer";

export class SelectionManager {
  private highlightRenderer: HighlightRenderer;
  private objectRenderers: Map<string, ObjectRenderer<any>> = new Map();

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

    useStore.getState().setSelectedObject(objectId, objectType);

    renderer.selectObject(objectId);
  }

  public setActionPaths(actionPaths: Map<string, ActionPath[]>): void {
    useStore.getState().setActionPaths(actionPaths);
    this.highlightActionPaths(actionPaths);
  }

  public clearSelection(): void {
    const { selectedObjectId, selectedObjectType } = useStore.getState();
    if (selectedObjectId && selectedObjectType) {
      const renderer = this.objectRenderers.get(selectedObjectType);
      if (renderer) {
        renderer.deselectObject();
      }
    }

    this.highlightRenderer.clearHighlights();
    useStore.getState().clearSelection();
  }

  public getSelectedObject(): { id: number; type: string; object: GameMapObject } | null {
    const { selectedObjectId, selectedObjectType } = useStore.getState();
    if (!selectedObjectId || !selectedObjectType) {
      return null;
    }

    const renderer = this.objectRenderers.get(selectedObjectType);
    if (!renderer) {
      return null;
    }

    const object = renderer.getObject(selectedObjectId);
    if (!object) {
      return null;
    }

    return {
      id: selectedObjectId,
      type: selectedObjectType,
      object: object as GameMapObject,
    };
  }

  public isObjectSelected(objectId: number, objectType: string): boolean {
    return useStore.getState().isObjectSelected(objectId, objectType);
  }

  public getActionPath(col: number, row: number): ActionPath[] | undefined {
    return useStore.getState().getActionPath(col, row);
  }

  public hasActionAt(col: number, row: number): boolean {
    return useStore.getState().hasActionAt(col, row);
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
