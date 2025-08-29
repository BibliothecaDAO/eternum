import { ActionPath, Position, QuestSystemUpdate } from "@bibliothecadao/eternum";
import { HexEntityInfo } from "@bibliothecadao/types";
import * as THREE from "three";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex } from "../tiles/tile-enums";
import { EntityManager } from "./entity-manager";
import { QuestObject } from "./types";

export class QuestManager extends EntityManager<QuestObject> {
  protected renderer: BuildingTileRenderer;

  // Quest tracking data
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();

  constructor(scene: THREE.Scene) {
    super(scene);
    this.renderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: QuestObject): void {
    this.objects.set(object.id, object);
    // Use Chest tile index for quests temporarily
    this.renderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true);
  }

  public updateObject(object: QuestObject): void {
    const existingQuest = this.objects.get(object.id);

    // Check if the quest has moved to a new position (unlikely but consistent API)
    if (existingQuest && (existingQuest.col !== object.col || existingQuest.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.isObjectMoving(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.renderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true);
    }
  }

  public removeObject(objectId: number): void {
    const quest = this.objects.get(objectId);
    if (quest) {
      this.renderer.removeTile(quest.col, quest.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldQuest = this.objects.get(objectId);
    if (oldQuest) {
      this.renderer.removeTile(oldQuest.col, oldQuest.row);
    }

    const quest = this.objects.get(objectId);
    if (quest) {
      quest.col = col;
      quest.row = row;
      this.renderer.addTileByIndex(col, row, BuildingTileIndex.Chest, true);
    }
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.renderer.setVisibleBounds(bounds);
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const quest = this.objects.get(objectId);

    if (quest) {
      this.renderer.selectTile(quest.col, quest.row);
    }
  }

  public deselectObject(): void {
    this.renderer.deselectTile();
    this.selectedObjectId = null;
  }

  public getObject(objectId: number): QuestObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): QuestObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): QuestObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const quest = this.objects.get(objectId);
    if (!quest) {
      return Promise.resolve();
    }

    const startCol = quest.col;
    const startRow = quest.row;

    return this.renderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update quest position after movement completes
      quest.col = targetCol;
      quest.row = targetRow;
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const quest = this.objects.get(objectId);
    if (!quest || path.length === 0) {
      return Promise.resolve();
    }

    const startCol = quest.col;
    const startRow = quest.row;
    const finalHex = path[path.length - 1];

    return this.renderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update quest position after movement completes
      quest.col = finalHex.col;
      quest.row = finalHex.row;
    });
  }

  public isObjectMoving(objectId: number): boolean {
    const quest = this.objects.get(objectId);
    if (!quest) return false;
    return this.renderer.isTileMoving(quest.col, quest.row);
  }

  protected isHexVisible(col: number, row: number): boolean {
    if (!this.visibleBounds) return true;
    return (
      col >= this.visibleBounds.minCol &&
      col <= this.visibleBounds.maxCol &&
      row >= this.visibleBounds.minRow &&
      row <= this.visibleBounds.maxRow
    );
  }

  // Quest-specific methods moved from HexagonMap
  public handleSystemUpdate(update: QuestSystemUpdate): void {
    const {
      hexCoords: { col, row },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    if (!this.questHexes.has(normalized.x)) {
      this.questHexes.set(normalized.x, new Map());
    }
    this.questHexes.get(normalized.x)?.set(normalized.y, { id: entityId, owner: 0n });

    const quest = {
      id: entityId,
      col: normalized.x,
      row: normalized.y,
      owner: 0n,
      type: "quest" as const,
    };
    this.addObject(quest);
  }

  public getQuestHexes(): Map<number, Map<number, HexEntityInfo>> {
    return this.questHexes;
  }

  public handleHexClick(
    questId: number, 
    col: number, 
    row: number, 
    store: any
  ): { shouldSelect: boolean } {
    const isDoubleClick = store.handleObjectClick(questId, "quest", col, row);
    
    if (isDoubleClick) {
      return { shouldSelect: false };
    }

    return { shouldSelect: true };
  }

  public clearQuestData(): void {
    this.questHexes.clear();
  }

  public dispose(): void {
    this.clearQuestData();
    this.renderer.dispose();
  }

  public static disposeStaticAssets(): void {
    // No longer needed
  }
}
