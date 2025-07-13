import * as THREE from "three";
import { HighlightRenderer } from "./highlight-renderer";
import { ArmyObject, GameMapObject, ObjectRenderer, QuestObject, StructureObject } from "./object-renderer";

export interface SelectionState {
  selectedObjectId: number | null;
  selectedObjectType: string | null;
  highlightedHexes: Array<{ col: number; row: number; color: THREE.Color }>;
}

export class SelectionManager {
  private highlightRenderer: HighlightRenderer;
  private objectRenderers: Map<string, ObjectRenderer<any>> = new Map();
  private currentSelection: SelectionState = {
    selectedObjectId: null,
    selectedObjectType: null,
    highlightedHexes: [],
  };

  private readonly HIGHLIGHT_COLORS = {
    MOVE: new THREE.Color(0x00ff00),
    ATTACK: new THREE.Color(0xff0000),
    INTERACT: new THREE.Color(0x0088ff),
    BUILD: new THREE.Color(0xffaa00),
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

    const availableActions = this.getAvailableActions(object);
    this.highlightAvailableActions(availableActions);
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
      highlightedHexes: [],
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

  public addHighlight(
    col: number,
    row: number,
    color: THREE.Color,
    pulseSpeed?: number,
    pulseIntensity?: number,
  ): void {
    this.highlightRenderer.addHighlight(col, row, color, pulseSpeed, pulseIntensity);
    this.currentSelection.highlightedHexes.push({ col, row, color });
  }

  public removeHighlight(col: number, row: number): void {
    this.highlightRenderer.removeHighlight(col, row);
    this.currentSelection.highlightedHexes = this.currentSelection.highlightedHexes.filter(
      (hex) => hex.col !== col || hex.row !== row,
    );
  }

  public clearHighlights(): void {
    this.highlightRenderer.clearHighlights();
    this.currentSelection.highlightedHexes = [];
  }

  public getHighlightedHexes(): Array<{ col: number; row: number; color: THREE.Color }> {
    return [...this.currentSelection.highlightedHexes];
  }

  private getAvailableActions(object: GameMapObject): Array<{ col: number; row: number; actionType: string }> {
    const actions: Array<{ col: number; row: number; actionType: string }> = [];

    switch (object.type) {
      case "army":
        actions.push(...this.getArmyActions(object as ArmyObject));
        break;
      case "structure":
        actions.push(...this.getStructureActions(object as StructureObject));
        break;
      case "quest":
        actions.push(...this.getQuestActions(object as QuestObject));
        break;
    }

    return actions;
  }

  private getArmyActions(army: ArmyObject): Array<{ col: number; row: number; actionType: string }> {
    const actions: Array<{ col: number; row: number; actionType: string }> = [];

    const moveRange = 3;
    for (let deltaCol = -moveRange; deltaCol <= moveRange; deltaCol++) {
      for (let deltaRow = -moveRange; deltaRow <= moveRange; deltaRow++) {
        if (deltaCol === 0 && deltaRow === 0) continue;

        const distance = Math.abs(deltaCol) + Math.abs(deltaRow);
        if (distance <= moveRange) {
          const targetCol = army.col + deltaCol;
          const targetRow = army.row + deltaRow;

          const actionType = this.getActionTypeForHex(targetCol, targetRow, army);
          actions.push({ col: targetCol, row: targetRow, actionType });
        }
      }
    }

    return actions;
  }

  private getStructureActions(structure: StructureObject): Array<{ col: number; row: number; actionType: string }> {
    const actions: Array<{ col: number; row: number; actionType: string }> = [];

    const adjacentHexes = [
      { col: structure.col + 1, row: structure.row },
      { col: structure.col - 1, row: structure.row },
      { col: structure.col, row: structure.row + 1 },
      { col: structure.col, row: structure.row - 1 },
      { col: structure.col + 1, row: structure.row - 1 },
      { col: structure.col - 1, row: structure.row + 1 },
    ];

    adjacentHexes.forEach(({ col, row }) => {
      actions.push({ col, row, actionType: "INTERACT" });
    });

    return actions;
  }

  private getQuestActions(quest: QuestObject): Array<{ col: number; row: number; actionType: string }> {
    const actions: Array<{ col: number; row: number; actionType: string }> = [];

    actions.push({ col: quest.col, row: quest.row, actionType: "INTERACT" });

    return actions;
  }

  private getActionTypeForHex(col: number, row: number, fromObject: GameMapObject): string {
    const armyRenderer = this.objectRenderers.get("army");
    const structureRenderer = this.objectRenderers.get("structure");

    if (armyRenderer && armyRenderer.getObjectsAtHex(col, row).length > 0) {
      return "ATTACK";
    }

    if (structureRenderer && structureRenderer.getObjectsAtHex(col, row).length > 0) {
      return "INTERACT";
    }

    return "MOVE";
  }

  private highlightAvailableActions(actions: Array<{ col: number; row: number; actionType: string }>): void {
    actions.forEach(({ col, row, actionType }) => {
      const color =
        this.HIGHLIGHT_COLORS[actionType as keyof typeof this.HIGHLIGHT_COLORS] || this.HIGHLIGHT_COLORS.MOVE;
      this.addHighlight(col, row, color, 2.0, 0.4);
    });
  }

  public dispose(): void {
    this.clearSelection();
  }
}
