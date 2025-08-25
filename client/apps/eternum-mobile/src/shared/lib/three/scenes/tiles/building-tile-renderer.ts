import { BuildingType } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForTile } from "../utils";
import { BaseTileRenderer, TilePosition } from "./base-tile-renderer";
import { BuildingTileIndex, BuildingTypeToTileIndex, TILEMAP_CONFIGS } from "./tile-enums";

export interface BuildingTilePosition extends TilePosition {
  buildingType?: BuildingType;
}

export class BuildingTileRenderer extends BaseTileRenderer<BuildingTileIndex> {
  constructor(scene: THREE.Scene) {
    super(scene, TILEMAP_CONFIGS.buildings);
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
    if (!isExplored || !buildingType || buildingType === BuildingType.None) {
      return;
    }

    const hexKey = `${col},${row}`;
    getWorldPositionForTile({ col, row }, true, this.tempVector3);

    const tileId = BuildingTypeToTileIndex[buildingType];
    this.createSingleTileSprite(hexKey, tileId, this.tempVector3, row, true);
  }

  public addTile(col: number, row: number, buildingType?: BuildingType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;

    if (this.sprites.has(hexKey) || !isExplored || !buildingType || buildingType === BuildingType.None) {
      return;
    }

    this.createTileSprite(col, row, buildingType, isExplored);
  }

  public updateTilesForHexes(hexes: BuildingTilePosition[]): void {
    if (!this.materialsInitialized) {
      console.warn("Building tile materials not yet initialized");
      return;
    }

    const newHexKeys = new Set(
      hexes
        .filter(({ buildingType, isExplored }) => isExplored && buildingType && buildingType !== BuildingType.None)
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
      if (!hex.isExplored || !hex.buildingType || hex.buildingType === BuildingType.None) {
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
}
