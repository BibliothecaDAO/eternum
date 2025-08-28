import { BiomeType } from "@bibliothecadao/types";
import * as THREE from "three";
import { BiomeTilePosition, BiomeTileRenderer } from "../tiles/biome-tile-renderer";
import { EntityManager } from "./entity-manager";
import { BiomeObject } from "./types";

export class BiomesManager extends EntityManager<BiomeObject> {
  protected renderer: BiomeTileRenderer;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.renderer = new BiomeTileRenderer(scene);
  }

  public addObject(object: BiomeObject): void {
    if (this.objects.has(object.id)) {
      return;
    }

    this.objects.set(object.id, object);

    if (this.isHexVisible(object.col, object.row)) {
      this.renderer.addTile(object.col, object.row, object.biome, object.isExplored);
    }
  }

  public updateObject(object: BiomeObject): void {
    const existingBiome = this.objects.get(object.id);

    if (existingBiome && (existingBiome.col !== object.col || existingBiome.row !== object.row)) {
      if (this.isObjectMoving(object.id)) {
        return;
      }

      this.moveObject(object.id, object.col, object.row, 0);
    } else {
      const needsUpdate =
        existingBiome && (existingBiome.isExplored !== object.isExplored || existingBiome.biome !== object.biome);

      this.objects.set(object.id, object);

      if (this.isHexVisible(object.col, object.row)) {
        if (needsUpdate) {
          this.renderer.removeTile(object.col, object.row);
        }
        this.renderer.addTile(object.col, object.row, object.biome, object.isExplored);
      }
    }
  }

  public removeObject(objectId: number): void {
    const biome = this.objects.get(objectId);
    if (biome && this.isHexVisible(biome.col, biome.row)) {
      this.renderer.removeTile(biome.col, biome.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldBiome = this.objects.get(objectId);
    if (oldBiome) {
      if (this.isHexVisible(oldBiome.col, oldBiome.row)) {
        this.renderer.removeTile(oldBiome.col, oldBiome.row);
      }

      const updatedBiome = { ...oldBiome, col, row };
      this.objects.set(objectId, updatedBiome);

      if (this.isHexVisible(col, row)) {
        this.renderer.addTile(col, row, updatedBiome.biome, updatedBiome.isExplored);
      }
    }
  }

  public async moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 0): Promise<void> {
    void duration;
    const biome = this.objects.get(objectId);
    if (!biome) return;

    const oldCol = biome.col;
    const oldRow = biome.row;

    if (this.isHexVisible(oldCol, oldRow)) {
      this.renderer.removeTile(oldCol, oldRow);
    }

    const updatedBiome = { ...biome, col: targetCol, row: targetRow };
    this.objects.set(objectId, updatedBiome);

    if (this.isHexVisible(targetCol, targetRow)) {
      this.renderer.addTile(targetCol, targetRow, updatedBiome.biome, updatedBiome.isExplored);
    }
  }

  public async moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 0,
  ): Promise<void> {
    if (path.length === 0) return;

    const finalPosition = path[path.length - 1];
    await this.moveObject(objectId, finalPosition.col, finalPosition.row, stepDuration * path.length);
  }

  public isObjectMoving(objectId: number): boolean {
    void objectId;
    return false;
  }

  public getObject(objectId: number): BiomeObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): BiomeObject[] {
    return Array.from(this.objects.values()).filter((biome) => biome.col === col && biome.row === row);
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

  public getAllObjects(): BiomeObject[] {
    return Array.from(this.objects.values());
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.renderer.setVisibleBounds(bounds);
    this.fillUnexploredTilesInBounds(bounds);
    this.updateTileVisibility();
  }

  private isHexVisible(col: number, row: number): boolean {
    if (!this.visibleBounds) return true;
    return (
      col >= this.visibleBounds.minCol &&
      col <= this.visibleBounds.maxCol &&
      row >= this.visibleBounds.minRow &&
      row <= this.visibleBounds.maxRow
    );
  }

  private fillUnexploredTilesInBounds(bounds: {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
  }): void {
    for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
      for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
        const objectId = this.generateObjectId(col, row);

        if (!this.objects.has(objectId)) {
          this.addUnexploredTile(col, row, BiomeType.None);
        }
      }
    }
  }

  private updateTileVisibility(): void {
    const visibleBiomeTiles: BiomeTilePosition[] = [];

    this.objects.forEach((biome) => {
      if (this.isHexVisible(biome.col, biome.row)) {
        visibleBiomeTiles.push({
          col: biome.col,
          row: biome.row,
          biome: biome.biome,
          isExplored: biome.isExplored,
        });
      }
    });

    this.renderer.renderTilesForHexes(visibleBiomeTiles);
  }

  public async ensureMaterialsReady(): Promise<void> {
    await this.renderer.ensureMaterialsReady();
  }

  public addUnexploredTile(col: number, row: number, biome: BiomeType): void {
    const objectId = this.generateObjectId(col, row);

    const biomeObject: BiomeObject = {
      id: objectId,
      col,
      row,
      type: "biome",
      biome,
      isExplored: false,
    };

    this.addObject(biomeObject);
  }

  public addExploredTile(col: number, row: number, biome: BiomeType): void {
    const objectId = this.generateObjectId(col, row);

    const biomeObject: BiomeObject = {
      id: objectId,
      col,
      row,
      type: "biome",
      biome,
      isExplored: true,
    };

    this.updateObject(biomeObject);
  }

  public removeExploredTile(col: number, row: number): void {
    const objectId = this.generateObjectId(col, row);
    this.removeObject(objectId);
  }

  private generateObjectId(col: number, row: number): number {
    return (col << 16) | (row & 0xffff);
  }

  public dispose(): void {
    this.objects.clear();
    this.renderer.dispose();
    this.selectedObjectId = null;
    this.visibleBounds = null;
  }
}
