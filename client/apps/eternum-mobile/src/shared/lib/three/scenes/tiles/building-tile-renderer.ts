import { BuildingType } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "../utils";
import { BaseTileRenderer, TilePosition } from "./base-tile-renderer";
import { BuildingTileIndex, BuildingTypeToTileIndex, TILEMAP_CONFIGS } from "./tile-enums";

export interface BuildingTilePosition extends TilePosition {
  buildingType?: BuildingType;
}

export class BuildingTileRenderer extends BaseTileRenderer<BuildingTileIndex> {
  constructor(scene: THREE.Scene) {
    super(scene, TILEMAP_CONFIGS.buildings);
  }

  protected configureSpriteScale(sprite: THREE.Sprite, tileId: BuildingTileIndex): void {
    void tileId; // Not used in current implementation, but subclasses might need it
    const spriteScale = HEX_SIZE * 3.2;
    const heightRatio = this.config.tileHeight / 312;
    sprite.scale.set(spriteScale, spriteScale * 1.15 * heightRatio, 1);
  }

  protected configureSpritePosition(
    sprite: THREE.Sprite,
    position: THREE.Vector3,
    row: number,
    isOverlay: boolean,
  ): void {
    void position; // Position is now handled by the group
    void row; // Not used in new implementation

    const yOffset = isOverlay ? 0.25 : 0.2;
    const heightRatio = this.config.tileHeight / 312;
    const zAdjustment = HEX_SIZE * 0.825 * heightRatio;
    sprite.position.set(0, yOffset, -zAdjustment * 1.075);
  }

  protected async createTileMaterials(tilesPerRow: number, texture: THREE.Texture): Promise<void> {
    Object.values(BuildingTileIndex).forEach((tileIndex) => {
      if (typeof tileIndex === "number") {
        this.createTileMaterial(tileIndex, tileIndex, tilesPerRow, texture);
      }
    });
  }

  public renderTilesForHexes(hexes: BuildingTilePosition[]): void {
    this.clearTiles();

    if (!this.materialsInitialized) {
      console.warn("Building tile materials not yet initialized");
      return;
    }

    hexes.forEach(({ col, row, buildingType, isExplored }) => {
      this.createTileSprite(col, row, buildingType, isExplored);
    });
  }

  private createTileSprite(col: number, row: number, buildingType?: BuildingType, isExplored: boolean = true): void {
    if (!isExplored || buildingType === undefined || buildingType === BuildingType.None) {
      return;
    }

    const hexKey = `${col},${row}`;
    getWorldPositionForTile({ col, row }, false, this.tempVector3);

    const tileId = BuildingTypeToTileIndex[buildingType];
    this.createSingleTileSprite(hexKey, tileId, this.tempVector3, row, true);
  }

  public addTile(col: number, row: number, buildingType?: BuildingType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;

    if (this.sprites.has(hexKey) || !isExplored || buildingType === undefined || buildingType === BuildingType.None) {
      return;
    }

    this.createTileSprite(col, row, buildingType, isExplored);
  }

  public addTileByIndex(col: number, row: number, tileIndex: BuildingTileIndex, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;

    if (this.sprites.has(hexKey) || !isExplored) {
      return;
    }

    getWorldPositionForTile({ col, row }, false, this.tempVector3);
    this.createSingleTileSprite(hexKey, tileIndex, this.tempVector3, row, true);
  }

  public updateTilesForHexes(hexes: BuildingTilePosition[]): void {
    if (!this.materialsInitialized) {
      console.warn("Building tile materials not yet initialized");
      return;
    }

    const newHexKeys = new Set(
      hexes
        .filter(
          ({ buildingType, isExplored }) =>
            isExplored && buildingType !== undefined && buildingType !== BuildingType.None,
        )
        .map(({ col, row }) => `${col},${row}`),
    );
    const currentHexKeys = new Set(this.sprites.keys());

    const toRemove = new Set<string>();
    const toAdd: BuildingTilePosition[] = [];
    const toUpdate: BuildingTilePosition[] = [];

    currentHexKeys.forEach((hexKey) => {
      if (!newHexKeys.has(hexKey)) {
        toRemove.add(hexKey);
      }
    });

    hexes.forEach((hex) => {
      if (!hex.isExplored || hex.buildingType === undefined || hex.buildingType === BuildingType.None) {
        return;
      }

      const hexKey = `${hex.col},${hex.row}`;
      if (!currentHexKeys.has(hexKey)) {
        toAdd.push(hex);
      } else {
        const existingSprite = this.sprites.get(hexKey);
        if (existingSprite) {
          const currentTileId = this.getTileIdFromSprite(existingSprite);
          const expectedTileId = BuildingTypeToTileIndex[hex.buildingType];

          if (currentTileId !== expectedTileId) {
            toUpdate.push(hex);
          }
        }
      }
    });

    toRemove.forEach((hexKey) => {
      const [col, row] = hexKey.split(",").map(Number);
      this.removeTile(col, row);
    });

    toUpdate.forEach(({ col, row, buildingType, isExplored }) => {
      this.removeTile(col, row);
      this.addTile(col, row, buildingType, isExplored);
    });

    toAdd.forEach(({ col, row, buildingType, isExplored }) => {
      this.addTile(col, row, buildingType, isExplored);
    });
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    const boundsStartTime = performance.now();
    console.log(`[BuildingTileRenderer] setVisibleBounds: sprites=${this.sprites.size}, bounds:`, bounds);
    // Use parent class visibility management which works with groups
    super.setVisibleBounds(bounds);
    console.log(`[BUILDING-TIMING] Set visible bounds: ${(performance.now() - boundsStartTime).toFixed(2)}ms`);
  }
}
