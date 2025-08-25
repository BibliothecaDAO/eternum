import { ActionPath, ActionPaths, ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import useStore from "../../../store";
import { HighlightRenderer } from "../highlight-renderer";
import { GameMapObject, ObjectRenderer } from "./object-renderer";

export class SelectionManager {
  private highlightRenderer: HighlightRenderer;
  private objectRenderers: Map<string, ObjectRenderer<any>> = new Map();

  private readonly HIGHLIGHT_COLORS = {
    [ActionType.Move]: new THREE.Color().setRGB(0.5, 2.0, 0.0), // Emerald green
    [ActionType.Attack]: new THREE.Color().setRGB(2.5, 0.5, 0.0), // Fiery orange-red
    [ActionType.Help]: new THREE.Color().setRGB(1.8, 0.3, 2.0), // Holy purple-pink
    [ActionType.Explore]: new THREE.Color().setRGB(0.0, 1.2, 2.0), // Arcane blue glow
    [ActionType.Quest]: new THREE.Color().setRGB(1.0, 1.0, 0.0), // Bright yellow
    [ActionType.Build]: new THREE.Color().setRGB(1.5, 1.2, 0.0), // Golden amber
    [ActionType.Chest]: new THREE.Color().setRGB(2.0, 1.5, 0.0), // Treasure gold
    [ActionType.CreateArmy]: new THREE.Color().setRGB(1.0, 1.5, 2.0), // Ethereal blue-white
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

  public setActionPaths(actionPaths: ActionPaths): void {
    useStore.getState().setActionPaths(actionPaths.getPaths());
    this.highlightActionPaths(actionPaths.getHighlightedHexes());
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

  private highlightActionPaths(highlightedHexes: ActionPath[]): void {
    this.highlightRenderer.clearHighlights();

    const processedHexes = new Set<string>();

    for (const hexAction of highlightedHexes) {
      const { col, row } = hexAction.hex;

      const hexKey = `${col},${row}`;
      if (processedHexes.has(hexKey)) continue;

      processedHexes.add(hexKey);

      const color = this.HIGHLIGHT_COLORS[hexAction.actionType] || this.HIGHLIGHT_COLORS[ActionType.Move];
      this.highlightRenderer.addHighlight(col, row, color, 2.0, 0.4);
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
