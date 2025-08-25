import * as THREE from "three";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex } from "../tiles/tile-enums";
import { ObjectRenderer } from "./base-object-renderer";
import { ChestObject } from "./types";

export class ChestRenderer extends ObjectRenderer<ChestObject> {
  private buildingTileRenderer: BuildingTileRenderer;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: ChestObject): void {
    this.objects.set(object.id, object);
    this.buildingTileRenderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true, true);
  }

  public updateObject(object: ChestObject): void {
    const existingChest = this.objects.get(object.id);

    if (existingChest && (existingChest.col !== object.col || existingChest.row !== object.row)) {
      if (this.isObjectMoving(object.id)) {
        return;
      }

      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      this.objects.set(object.id, object);
      this.buildingTileRenderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true, true);
    }
  }

  public removeObject(objectId: number): void {
    const chest = this.objects.get(objectId);
    if (chest) {
      this.buildingTileRenderer.removeTile(chest.col, chest.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldChest = this.objects.get(objectId);
    if (oldChest) {
      this.buildingTileRenderer.removeTile(oldChest.col, oldChest.row);

      const updatedChest = { ...oldChest, col, row };
      this.objects.set(objectId, updatedChest);

      this.buildingTileRenderer.addTileByIndex(col, row, BuildingTileIndex.Chest, true, true);
    }
  }

  public async moveObject(
    objectId: number,
    targetCol: number,
    targetRow: number,
    duration: number = 1000,
  ): Promise<void> {
    const chest = this.objects.get(objectId);
    if (!chest) return;

    const oldCol = chest.col;
    const oldRow = chest.row;

    this.buildingTileRenderer.removeTile(oldCol, oldRow);

    const updatedChest = { ...chest, col: targetCol, row: targetRow };
    this.objects.set(objectId, updatedChest);

    this.buildingTileRenderer.addTileByIndex(targetCol, targetRow, BuildingTileIndex.Chest, true, true);
  }

  public async moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    if (path.length === 0) return;

    const finalPosition = path[path.length - 1];
    await this.moveObject(objectId, finalPosition.col, finalPosition.row, stepDuration * path.length);
  }

  public isObjectMoving(objectId: number): boolean {
    return false;
  }

  public getObject(objectId: number): ChestObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): ChestObject[] {
    return Array.from(this.objects.values()).filter((chest) => chest.col === col && chest.row === row);
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
  }

  public deselectObject(): void {
    this.selectedObjectId = null;
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public getAllObjects(): ChestObject[] {
    return Array.from(this.objects.values());
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.buildingTileRenderer.setVisibleBounds(bounds);
  }

  public dispose(): void {
    this.objects.clear();
    this.buildingTileRenderer.dispose();
    this.selectedObjectId = null;
    this.visibleBounds = null;
  }
}
