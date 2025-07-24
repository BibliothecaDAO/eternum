import { BiomeType, BiomeTypeToId } from "@bibliothecadao/types";
import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "./utils";

export interface TilePosition {
  col: number;
  row: number;
  biome?: BiomeType;
  isExplored: boolean;
}

const OUTLINE_TILE_ID = 17;
export class TileRenderer {
  private scene: THREE.Scene;
  private materials: Map<number, THREE.SpriteMaterial> = new Map();
  private sprites: Map<string, THREE.Sprite> = new Map();
  private materialsInitialized: boolean = false;

  private prototypeSprites: Map<number, THREE.Sprite> = new Map();

  private tempVector3 = new THREE.Vector3();

  private static tileTexture: THREE.Texture | null = null;
  private static textureLoader = new THREE.TextureLoader();

  private static readonly TILE_WIDTH = 256;
  private static readonly TILE_HEIGHT = 304;
  private static readonly TILE_GAP = 1;
  private static readonly TILEMAP_PATH = "/images/tiles/biomes-tiles.png";
  private static readonly BASE_RENDER_ORDER = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeTileMaterials();
  }

  private async initializeTileMaterials(): Promise<void> {
    if (this.materialsInitialized) return;

    try {
      if (!TileRenderer.tileTexture) {
        TileRenderer.tileTexture = await TileRenderer.textureLoader.loadAsync(TileRenderer.TILEMAP_PATH);
        TileRenderer.tileTexture.magFilter = THREE.LinearFilter;
        TileRenderer.tileTexture.minFilter = THREE.LinearFilter;
        TileRenderer.tileTexture.colorSpace = THREE.SRGBColorSpace;
      }

      const tileWidthWithGap = TileRenderer.TILE_WIDTH + TileRenderer.TILE_GAP;
      const tilesPerRow = Math.floor((TileRenderer.tileTexture.image.width + TileRenderer.TILE_GAP) / tileWidthWithGap);

      this.createTileMaterial(BiomeTypeToId[BiomeType.DeepOcean], 12, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Ocean], 3, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Beach], 0, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Scorched], 3, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Bare], 11, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Tundra], 10, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Snow], 5, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.TemperateDesert], 7, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Shrubland], 4, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Taiga], 6, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.Grassland], 2, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(
        BiomeTypeToId[BiomeType.TemperateDeciduousForest],
        1,
        tilesPerRow,
        TileRenderer.tileTexture,
      );
      this.createTileMaterial(BiomeTypeToId[BiomeType.TemperateRainForest], 8, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(BiomeTypeToId[BiomeType.SubtropicalDesert], 7, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(
        BiomeTypeToId[BiomeType.TropicalSeasonalForest],
        9,
        tilesPerRow,
        TileRenderer.tileTexture,
      );
      this.createTileMaterial(BiomeTypeToId[BiomeType.TropicalRainForest], 9, tilesPerRow, TileRenderer.tileTexture);
      this.createTileMaterial(OUTLINE_TILE_ID, 13, tilesPerRow, TileRenderer.tileTexture, 0.3);

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

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      opacity: opacity,
    });

    material.map = texture.clone();
    material.map.offset.set(tileUV.offsetX, tileUV.offsetY);
    material.map.repeat.set(tileUV.repeatX, tileUV.repeatY);

    this.materials.set(tileId, material);
  }

  private createPrototypeSprites(): void {
    this.materials.forEach((material, tileId) => {
      const sprite = new THREE.Sprite(material);

      const spriteScale = HEX_SIZE * 3.2;
      sprite.scale.set(spriteScale, spriteScale * 1.15, 1);

      this.prototypeSprites.set(tileId, sprite);
    });
  }

  private calculateTileUV(tileIndex: number, tilesPerRow: number, textureWidth: number, textureHeight: number) {
    const tileX = tileIndex % tilesPerRow;
    const tileY = Math.floor(tileIndex / tilesPerRow);

    const tileWidthWithGap = TileRenderer.TILE_WIDTH + TileRenderer.TILE_GAP;
    const tileHeightWithGap = TileRenderer.TILE_HEIGHT + TileRenderer.TILE_GAP;

    const repeatX = TileRenderer.TILE_WIDTH / textureWidth;
    const repeatY = TileRenderer.TILE_HEIGHT / textureHeight;

    const offsetX = (tileX * tileWidthWithGap) / textureWidth;
    const offsetY = 1 - ((tileY + 1) * tileHeightWithGap) / textureHeight;

    return { offsetX, offsetY, repeatX, repeatY };
  }

  public renderTilesForHexes(hexes: TilePosition[]): void {
    this.clearTiles();

    if (!this.materialsInitialized) {
      console.warn("Tile materials not yet initialized");
      return;
    }

    hexes.forEach(({ col, row, biome, isExplored }) => {
      this.createTileSprite(col, row, biome, isExplored);
    });
  }

  private createTileSprite(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    const hexKey = `${col},${row}`;
    getWorldPositionForTile({ col, row }, true, this.tempVector3);

    let baseTileId: number;
    if (isExplored && biome) {
      baseTileId = BiomeTypeToId[biome];
    } else {
      baseTileId = OUTLINE_TILE_ID;
    }

    this.createSingleTileSprite(hexKey, baseTileId, this.tempVector3, row, false);
  }

  private createSingleTileSprite(
    spriteKey: string,
    tileId: number,
    position: THREE.Vector3,
    row: number,
    isOverlay: boolean = false,
  ): void {
    const prototypeSprite = this.prototypeSprites.get(tileId);

    if (!prototypeSprite) {
      console.warn(`Prototype sprite for tileId: ${tileId} not found`);
      return;
    }

    const sprite = prototypeSprite.clone();

    const yOffset = isOverlay ? 0.25 : 0.2;
    sprite.position.set(position.x, yOffset, position.z - HEX_SIZE * 0.825);

    sprite.renderOrder = Math.max(TileRenderer.BASE_RENDER_ORDER + row, 1) + (isOverlay ? 1000 : 0);

    this.sprites.set(spriteKey, sprite);
    this.scene.add(sprite);
  }

  public clearTiles(): void {
    this.sprites.forEach((sprite) => {
      this.scene.remove(sprite);
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

    if (this.sprites.has(hexKey)) {
      return;
    }

    this.createTileSprite(col, row, biome, isExplored);
  }

  public updateTilesForHexes(hexes: TilePosition[]): void {
    if (!this.materialsInitialized) {
      console.warn("Tile materials not yet initialized");
      return;
    }

    const newHexKeys = new Set(hexes.map(({ col, row }) => `${col},${row}`));
    const currentHexKeys = new Set(this.sprites.keys());

    const toRemove = new Set<string>();
    const toAdd: TilePosition[] = [];
    const toUpdate: TilePosition[] = [];

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
          const currentBiome = this.getTileIdFromSprite(existingSprite);
          const expectedTileId = hex.isExplored && hex.biome ? BiomeTypeToId[hex.biome] : OUTLINE_TILE_ID;

          if (currentBiome !== expectedTileId) {
            toUpdate.push(hex);
          }
        }
      }
    });

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
  }

  private getTileIdFromSprite(sprite: THREE.Sprite): number {
    for (const [tileId, prototypeSprite] of this.prototypeSprites) {
      if (sprite.material === prototypeSprite.material) {
        return tileId;
      }
    }
    return OUTLINE_TILE_ID;
  }

  public getTileCount(): number {
    return this.sprites.size;
  }

  public dispose(): void {
    this.clearTiles();

    this.prototypeSprites.forEach((sprite) => {});
    this.prototypeSprites.clear();

    this.materials.forEach((material) => {
      material.dispose();
      if (material.map) {
        material.map.dispose();
      }
    });

    this.materials.clear();
    this.materialsInitialized = false;
  }

  public static disposeStaticAssets(): void {
    if (TileRenderer.tileTexture) {
      TileRenderer.tileTexture.dispose();
      TileRenderer.tileTexture = null;
    }
  }
}
