import { BiomeType } from "@bibliothecadao/types";
import * as THREE from "three";
import { BaseTileRenderer, TilePosition } from "./base-tile-renderer";
import { BiomeTileIndex, BiomeTypeToTileIndex, TILEMAP_CONFIGS } from "./tile-enums";

export interface BiomeTilePosition extends TilePosition {
  biome?: BiomeType;
}

export class BiomeTileRenderer extends BaseTileRenderer<BiomeTileIndex> {
  constructor(scene: THREE.Scene) {
    super(scene, TILEMAP_CONFIGS.biomes);
  }

  protected async createTileMaterials(tilesPerRow: number, texture: THREE.Texture): Promise<void> {
    Object.entries(BiomeTypeToTileIndex).forEach(([, tileIndex]) => {
      this.createTileMaterial(tileIndex, tileIndex, tilesPerRow, texture);
    });

    this.createTileMaterial(BiomeTileIndex.Outline, BiomeTileIndex.Outline, tilesPerRow, texture, 0.3);
  }

  public renderTilesForHexes(hexes: BiomeTilePosition[]): void {
    const renderStartTime = performance.now();
    console.log(`[BIOME-TIMING] Starting biome tile render for ${hexes.length} hexes`);

    if (!this.materialsInitialized) {
      console.warn("Biome tile materials not yet initialized");
      return;
    }

    // Use differential update instead of clear+rebuild
    const differentialStartTime = performance.now();
    this.updateTilesForHexes(hexes);
    console.log(`[BIOME-TIMING] Differential update: ${(performance.now() - differentialStartTime).toFixed(2)}ms`);
    console.log(`[BIOME-TIMING] Total biome render time: ${(performance.now() - renderStartTime).toFixed(2)}ms`);
  }

  private createTileSprite(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;
    const cachedPosition = this.getCachedWorldPosition(col, row);

    let tileId: BiomeTileIndex;
    if (isExplored && biome) {
      tileId = BiomeTypeToTileIndex[biome];
    } else {
      tileId = BiomeTileIndex.Outline;
    }

    this.createSingleTileSprite(hexKey, tileId, cachedPosition, row, false);
  }

  public addTile(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;

    if (this.sprites.has(hexKey)) {
      return;
    }

    this.createTileSprite(col, row, biome, isExplored);
  }

  public updateTilesForHexes(hexes: BiomeTilePosition[]): void {
    if (!this.materialsInitialized) {
      console.warn("Biome tile materials not yet initialized");
      return;
    }

    const newHexKeys = new Set(hexes.map(({ col, row }) => `${col},${row}`));
    const currentHexKeys = new Set(this.sprites.keys());

    const toRemove = new Set<string>();
    const toAdd: BiomeTilePosition[] = [];
    const toUpdate: BiomeTilePosition[] = [];

    currentHexKeys.forEach((hexKey) => {
      if (!newHexKeys.has(hexKey)) {
        toRemove.add(hexKey);
      }
    });

    hexes.forEach((hex) => {
      const hexKey = `${hex.col},${hex.row}`;
      if (!currentHexKeys.has(hexKey)) {
        toAdd.push(hex);
      } else {
        const existingSprite = this.sprites.get(hexKey);
        if (existingSprite) {
          const currentTileId = this.getTileIdFromSprite(existingSprite);
          const expectedTileId = hex.isExplored && hex.biome ? BiomeTypeToTileIndex[hex.biome] : BiomeTileIndex.Outline;

          if (currentTileId !== expectedTileId) {
            toUpdate.push(hex);
          }
        }
      }
    });

    // Batch all scene operations for this update
    this.startBatchSceneOps();

    toRemove.forEach((hexKey) => {
      const [col, row] = hexKey.split(",").map(Number);
      this.removeTile(col, row);
    });

    toUpdate.forEach(({ col, row, biome, isExplored }) => {
      this.removeTile(col, row);
      this.addTile(col, row, biome, isExplored);
    });

    toAdd.forEach(({ col, row, biome, isExplored }) => {
      this.addTile(col, row, biome, isExplored);
    });

    this.applyBatchedSceneOps();
  }
}
