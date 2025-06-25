import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "./utils";

export interface TilePosition {
  col: number;
  row: number;
}

export class TileRenderer {
  private scene: THREE.Scene;
  private materials: Map<number, THREE.SpriteMaterial> = new Map();
  private sprites: Map<string, THREE.Sprite> = new Map();
  private materialsInitialized: boolean = false;

  // Tile constants
  private static readonly TILE_WIDTH = 256;
  private static readonly TILE_HEIGHT = 304;
  private static readonly TILE_GAP = 1;
  private static readonly TILEMAP_PATH = "/images/tiles/isometric-tiles.png";

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeTileMaterials();
  }

  private async initializeTileMaterials(): Promise<void> {
    if (this.materialsInitialized) return;

    const textureLoader = new THREE.TextureLoader();

    try {
      const tileTexture = await textureLoader.loadAsync(TileRenderer.TILEMAP_PATH);
      tileTexture.magFilter = THREE.LinearFilter;
      tileTexture.minFilter = THREE.LinearFilter;
      tileTexture.colorSpace = THREE.SRGBColorSpace;

      // Calculate how many tiles per row in the tilemap, accounting for gaps
      const tileWidthWithGap = TileRenderer.TILE_WIDTH + TileRenderer.TILE_GAP;
      const tilesPerRow = Math.floor((tileTexture.image.width + TileRenderer.TILE_GAP) / tileWidthWithGap);

      // Create materials for tile 1 and tile 2 (can be extended for more tiles)
      this.createTileMaterial(1, 0, tilesPerRow, tileTexture); // First tile (index 0)
      this.createTileMaterial(2, 1, tilesPerRow, tileTexture); // Second tile (index 1)
      this.createTileMaterial(3, 2, tilesPerRow, tileTexture); // Third tile (index 2)
      this.createTileMaterial(4, 3, tilesPerRow, tileTexture); // Fourth tile (index 3)
      this.createTileMaterial(5, 4, tilesPerRow, tileTexture); // Fifth tile (index 4)

      this.materialsInitialized = true;
      console.log("Tile materials initialized successfully");
    } catch (error) {
      console.error("Failed to load tile texture:", error);
    }
  }

  private createTileMaterial(tileId: number, tileIndex: number, tilesPerRow: number, texture: THREE.Texture): void {
    const tileUV = this.calculateTileUV(tileIndex, tilesPerRow, texture.image.width, texture.image.height);

    const material = new THREE.SpriteMaterial({
      map: texture.clone(),
      transparent: true,
      alphaTest: 0.1,
    });

    material.map!.offset.set(tileUV.offsetX, tileUV.offsetY);
    material.map!.repeat.set(tileUV.repeatX, tileUV.repeatY);

    this.materials.set(tileId, material);
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

    sortedHexes.forEach(({ col, row }) => {
      this.createTileSprite(col, row);
    });
  }

  private createTileSprite(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const position = getWorldPositionForTile({ col, row });

    // Choose tile based on row (even = tile1, odd = tile2)
    const tileId = Math.floor(Math.random() * 5) + 1;
    const material = this.materials.get(tileId);

    if (!material) {
      console.warn(`Material for tile ${tileId} not found`);
      return;
    }

    const sprite = new THREE.Sprite(material);

    // Scale sprite to match hex size
    const spriteScale = HEX_SIZE * 3.2; // Adjustable multiplier
    sprite.scale.set(spriteScale, spriteScale * 1.15, 1);

    // Position sprite above the hex shape
    sprite.position.set(position.x, 0.2, position.z - HEX_SIZE * 0.825);

    // Set render order based on row (higher row = higher render order)
    sprite.renderOrder = 1000 + row;

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

  public addTile(col: number, row: number): void {
    const hexKey = `${col},${row}`;

    // Don't create duplicate tiles
    if (this.sprites.has(hexKey)) {
      return;
    }

    this.createTileSprite(col, row);
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
    hexes.forEach(({ col, row }) => {
      const hexKey = `${col},${row}`;
      if (!currentHexKeys.has(hexKey)) {
        this.addTile(col, row);
      }
    });
  }

  public getTileCount(): number {
    return this.sprites.size;
  }

  public dispose(): void {
    this.clearTiles();

    // Dispose all materials
    this.materials.forEach((material) => {
      material.dispose();
      if (material.map) {
        material.map.dispose();
      }
    });

    this.materials.clear();
    this.materialsInitialized = false;
  }
}
