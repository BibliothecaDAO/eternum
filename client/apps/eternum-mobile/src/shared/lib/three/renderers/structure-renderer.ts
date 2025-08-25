import { StructureType } from "@bibliothecadao/types";
import * as THREE from "three";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex, getBuildingTileIndex } from "../tiles/tile-enums";
import { ObjectRenderer } from "./base-object-renderer";
import { StructureObject } from "./types";

export class StructureRenderer extends ObjectRenderer<StructureObject> {
  private buildingTileRenderer: BuildingTileRenderer;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: StructureObject): void {
    this.objects.set(object.id, object);
    this.syncBuildingTile(object);
  }

  public updateObject(object: StructureObject): void {
    const existingStructure = this.objects.get(object.id);

    // Check if the structure has moved to a new position (unlikely but consistent API)
    if (existingStructure && (existingStructure.col !== object.col || existingStructure.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.isObjectMoving(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.syncBuildingTile(object);
    }
  }

  public removeObject(objectId: number): void {
    const structure = this.objects.get(objectId);
    if (structure) {
      this.buildingTileRenderer.removeTile(structure.col, structure.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldStructure = this.objects.get(objectId);
    if (oldStructure) {
      this.buildingTileRenderer.removeTile(oldStructure.col, oldStructure.row);
    }

    const structure = this.objects.get(objectId);
    if (structure) {
      structure.col = col;
      structure.row = row;
      this.syncBuildingTile(structure);
    }
  }

  private syncBuildingTile(structure: StructureObject): void {
    const tileIndex = this.getTileIndexFromStructure(structure);
    this.buildingTileRenderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
  }

  private getTileIndexFromStructure(structure: StructureObject): BuildingTileIndex {
    const structureType = structure.structureType ? (parseInt(structure.structureType) as StructureType) : undefined;
    const buildingType = structure.buildingType;
    const level = structure.level;

    return getBuildingTileIndex(structureType, buildingType, level);
  }

  public getBuildingTileRenderer(): BuildingTileRenderer {
    return this.buildingTileRenderer;
  }

  public updateAllBuildingTiles(): void {
    this.buildingTileRenderer.clearTiles();

    Array.from(this.objects.values()).forEach((structure) => {
      const tileIndex = this.getTileIndexFromStructure(structure);
      this.buildingTileRenderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
    });
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const structure = this.objects.get(objectId);

    if (structure) {
      this.buildingTileRenderer.selectTile(structure.col, structure.row);
    }
  }

  public deselectObject(): void {
    this.buildingTileRenderer.deselectTile();
    this.selectedObjectId = null;
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.buildingTileRenderer.setVisibleBounds(bounds);
  }

  public getObject(objectId: number): StructureObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): StructureObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): StructureObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const structure = this.objects.get(objectId);
    if (!structure) {
      return Promise.resolve();
    }

    const startCol = structure.col;
    const startRow = structure.row;

    return this.buildingTileRenderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update structure position after movement completes
      structure.col = targetCol;
      structure.row = targetRow;
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const structure = this.objects.get(objectId);
    if (!structure || path.length === 0) {
      return Promise.resolve();
    }

    const startCol = structure.col;
    const startRow = structure.row;
    const finalHex = path[path.length - 1];

    return this.buildingTileRenderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update structure position after movement completes
      structure.col = finalHex.col;
      structure.row = finalHex.row;
    });
  }

  public isObjectMoving(objectId: number): boolean {
    const structure = this.objects.get(objectId);
    if (!structure) return false;
    return this.buildingTileRenderer.isTileMoving(structure.col, structure.row);
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

  public dispose(): void {
    this.buildingTileRenderer.dispose();
  }
}
