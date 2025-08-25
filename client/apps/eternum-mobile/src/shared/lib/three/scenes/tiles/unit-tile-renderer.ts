import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForTile } from "../utils";
import { BaseTileRenderer, TilePosition } from "./base-tile-renderer";
import { getTroopTileIndex, TILEMAP_CONFIGS, UnitTileIndex } from "./tile-enums";

export interface UnitTilePosition extends TilePosition {
  troopType?: TroopType;
  troopTier?: TroopTier;
  isDonkey?: boolean;
}

export class UnitTileRenderer extends BaseTileRenderer<UnitTileIndex> {
  constructor(scene: THREE.Scene) {
    super(scene, TILEMAP_CONFIGS.units);
  }

  protected async createTileMaterials(tilesPerRow: number, texture: THREE.Texture): Promise<void> {
    Object.values(UnitTileIndex).forEach((tileIndex) => {
      if (typeof tileIndex === "number") {
        this.createTileMaterial(tileIndex, tileIndex, tilesPerRow, texture);
      }
    });
  }

  public renderTilesForHexes(hexes: UnitTilePosition[]): void {
    this.clearTiles();

    if (!this.materialsInitialized) {
      console.warn("Unit tile materials not yet initialized");
      return;
    }

    hexes.forEach(({ col, row, troopType, troopTier, isDonkey, isExplored }) => {
      this.createTileSprite(col, row, troopType, troopTier, isDonkey, isExplored);
    });
  }

  private createTileSprite(
    col: number,
    row: number,
    troopType?: TroopType,
    troopTier?: TroopTier,
    isDonkey?: boolean,
    isExplored: boolean = true,
  ): void {
    if (!isExplored) {
      return;
    }

    const hexKey = `${col},${row}`;
    getWorldPositionForTile({ col, row }, true, this.tempVector3);

    let tileId: UnitTileIndex;

    if (isDonkey) {
      tileId = UnitTileIndex.Donkey;
    } else if (troopType && troopTier) {
      tileId = getTroopTileIndex(troopType, troopTier);
    } else {
      return;
    }

    this.createSingleTileSprite(hexKey, tileId, this.tempVector3, row, true);
  }

  public addTile(
    col: number,
    row: number,
    troopType?: TroopType,
    troopTier?: TroopTier,
    isDonkey?: boolean,
    isExplored: boolean = true,
  ): void {
    const hexKey = `${col},${row}`;

    if (this.sprites.has(hexKey) || !isExplored) {
      return;
    }

    this.createTileSprite(col, row, troopType, troopTier, isDonkey, isExplored);
  }

  public updateTilesForHexes(hexes: UnitTilePosition[]): void {
    if (!this.materialsInitialized) {
      console.warn("Unit tile materials not yet initialized");
      return;
    }

    const validHexes = hexes.filter(
      ({ isExplored, troopType, troopTier, isDonkey }) => isExplored && (isDonkey || (troopType && troopTier)),
    );

    const newHexKeys = new Set(validHexes.map(({ col, row }) => `${col},${row}`));
    const currentHexKeys = new Set(this.sprites.keys());

    const toRemove = new Set<string>();
    const toAdd: UnitTilePosition[] = [];
    const toUpdate: UnitTilePosition[] = [];

    currentHexKeys.forEach((hexKey) => {
      if (!newHexKeys.has(hexKey)) {
        toRemove.add(hexKey);
      }
    });

    validHexes.forEach((hex) => {
      const hexKey = `${hex.col},${hex.row}`;
      if (!currentHexKeys.has(hexKey)) {
        toAdd.push(hex);
      } else {
        const existingSprite = this.sprites.get(hexKey);
        if (existingSprite) {
          const currentTileId = this.getTileIdFromSprite(existingSprite);
          let expectedTileId: UnitTileIndex;

          if (hex.isDonkey) {
            expectedTileId = UnitTileIndex.Donkey;
          } else if (hex.troopType && hex.troopTier) {
            expectedTileId = getTroopTileIndex(hex.troopType, hex.troopTier);
          } else {
            return;
          }

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

    toUpdate.forEach(({ col, row, troopType, troopTier, isDonkey, isExplored }) => {
      this.removeTile(col, row);
      this.addTile(col, row, troopType, troopTier, isDonkey, isExplored);
    });

    toAdd.forEach(({ col, row, troopType, troopTier, isDonkey, isExplored }) => {
      this.addTile(col, row, troopType, troopTier, isDonkey, isExplored);
    });
  }
}
