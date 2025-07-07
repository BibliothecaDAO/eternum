import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "./utils";

export interface TilePosition {
  col: number;
  row: number;
  biome?: BiomeType;
  isExplored: boolean;
}

export class TileRenderer {
  private scene: THREE.Scene;
  private materials: Map<number, THREE.SpriteMaterial> = new Map();
  private sprites: Map<string, THREE.Sprite> = new Map();
  private materialsInitialized: boolean = false;

  // Prototype sprites for cloning
  private prototypeSprites: Map<number, THREE.Sprite> = new Map();

  // Reusable objects to avoid creation in loops
  private tempVector3 = new THREE.Vector3();

  // Cached texture - shared across all materials
  private static tileTexture: THREE.Texture | null = null;
  private static textureLoader = new THREE.TextureLoader();

  // Tile constants
  private static readonly TILE_WIDTH = 256;
  private static readonly TILE_HEIGHT = 304;
  private static readonly TILE_GAP = 1;
  private static readonly TILEMAP_PATH = "/images/tiles/biomes-tiles.png";

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeTileMaterials();
  }

  private async initializeTileMaterials(): Promise<void> {
    if (this.materialsInitialized) return;

    try {
      // Load texture only once and reuse it
      if (!TileRenderer.tileTexture) {
        TileRenderer.tileTexture = await TileRenderer.textureLoader.loadAsync(TileRenderer.TILEMAP_PATH);
        TileRenderer.tileTexture.magFilter = THREE.LinearFilter;
        TileRenderer.tileTexture.minFilter = THREE.LinearFilter;
        TileRenderer.tileTexture.colorSpace = THREE.SRGBColorSpace;
      }

      // Calculate how many tiles per row in the tilemap, accounting for gaps
      const tileWidthWithGap = TileRenderer.TILE_WIDTH + TileRenderer.TILE_GAP;
      const tilesPerRow = Math.floor((TileRenderer.tileTexture.image.width + TileRenderer.TILE_GAP) / tileWidthWithGap);

      // Create materials for tile 1 and tile 2 (can be extended for more tiles)
      this.createTileMaterial(BiomeTypeToId[BiomeType.DeepOcean], 12, tilesPerRow, TileRenderer.tileTexture); // First tile (index 0)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Ocean], 3, tilesPerRow, TileRenderer.tileTexture); // Second tile (index 1)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Beach], 0, tilesPerRow, TileRenderer.tileTexture); // Third tile (index 2)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Scorched], 3, tilesPerRow, TileRenderer.tileTexture); // Fourth tile (index 3)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Bare], 11, tilesPerRow, TileRenderer.tileTexture); // Fifth tile (index 4)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Tundra], 10, tilesPerRow, TileRenderer.tileTexture); // Sixth tile (index 5)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Snow], 5, tilesPerRow, TileRenderer.tileTexture); // Seventh tile (index 6)
      this.createTileMaterial(BiomeTypeToId[BiomeType.TemperateDesert], 7, tilesPerRow, TileRenderer.tileTexture); // Eighth tile (index 7)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Shrubland], 4, tilesPerRow, TileRenderer.tileTexture); // Ninth tile (index 8)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Taiga], 6, tilesPerRow, TileRenderer.tileTexture); // Tenth tile (index 9)
      this.createTileMaterial(BiomeTypeToId[BiomeType.Grassland], 2, tilesPerRow, TileRenderer.tileTexture); // Eleventh tile (index 10)
      this.createTileMaterial(
        BiomeTypeToId[BiomeType.TemperateDeciduousForest],
        1,
        tilesPerRow,
        TileRenderer.tileTexture,
      ); // Twelfth tile (index 11)
      this.createTileMaterial(BiomeTypeToId[BiomeType.TemperateRainForest], 8, tilesPerRow, TileRenderer.tileTexture); // Thirteenth tile (index 12)
      this.createTileMaterial(BiomeTypeToId[BiomeType.SubtropicalDesert], 7, tilesPerRow, TileRenderer.tileTexture); // Fourteenth tile (index 13)
      this.createTileMaterial(
        BiomeTypeToId[BiomeType.TropicalSeasonalForest],
        9,
        tilesPerRow,
        TileRenderer.tileTexture,
      ); // Fifteenth tile (index 14)
      this.createTileMaterial(BiomeTypeToId[BiomeType.TropicalRainForest], 9, tilesPerRow, TileRenderer.tileTexture); // Sixteenth tile (index 15)
      this.createTileMaterial(17, 13, tilesPerRow, TileRenderer.tileTexture, 0.3); // Outline tile for unexplored hexes

      // Create prototype sprites for each tile type
      this.createPrototypeSprites();

      this.materialsInitialized = true;
      console.log("Tile materials and prototype sprites initialized successfully");
    } catch (error) {
      console.error("Failed to load tile texture:", error);
    }
  }

  private createTileMaterial(
    tileId: number,
    tileIndex: number,
    tilesPerRow: number,
    texture: THREE.Texture,
    opacity: number = 1.0,
  ): void {
    const tileUV = this.calculateTileUV(tileIndex, tilesPerRow, texture.image.width, texture.image.height);

    // Don't clone texture - reuse the same texture with different UV settings
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      opacity: opacity,
    });

    // Create a copy of the texture for UV manipulation
    material.map = texture.clone();
    material.map.offset.set(tileUV.offsetX, tileUV.offsetY);
    material.map.repeat.set(tileUV.repeatX, tileUV.repeatY);

    this.materials.set(tileId, material);
  }

  private createPrototypeSprites(): void {
    // Create prototype sprites for each tile type
    this.materials.forEach((material, tileId) => {
      const sprite = new THREE.Sprite(material);

      // Scale sprite to match hex size
      const spriteScale = HEX_SIZE * 3.2; // Adjustable multiplier
      sprite.scale.set(spriteScale, spriteScale * 1.15, 1);

      // Store prototype (don't add to scene yet)
      this.prototypeSprites.set(tileId, sprite);
    });
  }

  private calculateTileUV(tileIndex: number, tilesPerRow: number, textureWidth: number, textureHeight: number) {
    const tileX = tileIndex % tilesPerRow;
    const tileY = Math.floor(tileIndex / tilesPerRow);

    // Account for tile gaps when calculating UV coordinates
    const tileWidthWithGap = TileRenderer.TILE_WIDTH + TileRenderer.TILE_GAP;
    const tileHeightWithGap = TileRenderer.TILE_HEIGHT + TileRenderer.TILE_GAP;

    const repeatX = TileRenderer.TILE_WIDTH / textureWidth;
    const repeatY = TileRenderer.TILE_HEIGHT / textureHeight;

    // Calculate offset accounting for gaps
    const offsetX = (tileX * tileWidthWithGap) / textureWidth;
    const offsetY = 1 - ((tileY + 1) * tileHeightWithGap) / textureHeight; // Flip Y coordinate for correct orientation

    return { offsetX, offsetY, repeatX, repeatY };
  }

  public renderTilesForHexes(hexes: TilePosition[]): void {
    // Clear existing tiles first
    this.clearTiles();

    if (!this.materialsInitialized) {
      console.warn("Tile materials not yet initialized");
      return;
    }

    // Sort hexes by row for proper rendering order (higher row = higher render order)
    const sortedHexes = [...hexes].sort((a, b) => b.row - a.row);

    sortedHexes.forEach(({ col, row, biome, isExplored }) => {
      this.createTileSprite(col, row, biome, isExplored);
    });
  }

  private createTileSprite(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;
    // Reuse tempVector3 instead of creating new Vector3
    getWorldPositionForTile({ col, row }, true, this.tempVector3);

    // Use tileId 17 for unexplored hexes (outline tile), otherwise use biome's tileId
    const tileId = isExplored && biome ? BiomeTypeToId[biome] : 17;
    const prototypeSprite = this.prototypeSprites.get(tileId);

    if (!prototypeSprite) {
      console.warn(
        `Prototype sprite for ${isExplored ? `biome ${biome}` : "unexplored hex"} (tileId: ${tileId}) not found`,
      );
      return;
    }

    // Clone the prototype sprite instead of creating from scratch
    const sprite = prototypeSprite.clone();

    // Position sprite above the hex shape using reused vector
    sprite.position.set(this.tempVector3.x, 0.2, this.tempVector3.z - HEX_SIZE * 0.825);

    // Set render order based on row (higher row = higher render order)
    sprite.renderOrder = 10 + row;

    this.sprites.set(hexKey, sprite);
    this.scene.add(sprite);
  }

  public clearTiles(): void {
    this.sprites.forEach((sprite) => {
      this.scene.remove(sprite);
      // Don't dispose materials here as they're reused
    });
    this.sprites.clear();
  }

  public removeTile(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const sprite = this.sprites.get(hexKey);

    if (sprite) {
      this.scene.remove(sprite);
      this.sprites.delete(hexKey);
    }
  }

  public addTile(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;

    // Don't create duplicate tiles
    if (this.sprites.has(hexKey)) {
      return;
    }

    this.createTileSprite(col, row, biome, isExplored);
  }

  public updateTilesForHexes(hexes: TilePosition[]): void {
    const currentHexKeys = new Set(Array.from(this.sprites.keys()));
    const newHexKeys = new Set(hexes.map(({ col, row }) => `${col},${row}`));

    // Remove tiles that are no longer needed
    currentHexKeys.forEach((hexKey) => {
      if (!newHexKeys.has(hexKey)) {
        const [col, row] = hexKey.split(",").map(Number);
        this.removeTile(col, row);
      }
    });

    // Add new tiles
    hexes.forEach(({ col, row, biome, isExplored }) => {
      const hexKey = `${col},${row}`;
      if (!currentHexKeys.has(hexKey)) {
        this.addTile(col, row, biome, isExplored);
      }
    });
  }

  public getTileCount(): number {
    return this.sprites.size;
  }

  public dispose(): void {
    this.clearTiles();

    // Dispose prototype sprites
    this.prototypeSprites.forEach((sprite) => {
      // Don't dispose materials here as they're shared
    });
    this.prototypeSprites.clear();

    // Dispose all materials
    this.materials.forEach((material) => {
      material.dispose();
      if (material.map) {
        material.map.dispose();
      }
    });

    this.materials.clear();
    this.materialsInitialized = false;

    // Don't dispose static texture here as it might be used by other instances
  }

  // Static method to dispose shared resources when no longer needed
  public static disposeStaticAssets(): void {
    if (TileRenderer.tileTexture) {
      TileRenderer.tileTexture.dispose();
      TileRenderer.tileTexture = null;
    }
  }
}
