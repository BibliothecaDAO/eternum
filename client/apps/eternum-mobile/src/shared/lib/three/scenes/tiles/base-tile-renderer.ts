import * as THREE from "three";
import { HEX_SIZE } from "../utils";
import type { TilemapConfig } from "./tile-enums";

export interface TilePosition {
  col: number;
  row: number;
  isExplored: boolean;
}

export abstract class BaseTileRenderer<TTileIndex extends number = number> {
  protected scene: THREE.Scene;
  protected materials: Map<TTileIndex, THREE.SpriteMaterial> = new Map();
  protected sprites: Map<string, THREE.Sprite> = new Map();
  protected materialsInitialized: boolean = false;
  protected prototypeSprites: Map<TTileIndex, THREE.Sprite> = new Map();
  protected tempVector3 = new THREE.Vector3();

  protected static textureLoader = new THREE.TextureLoader();
  protected static readonly BASE_RENDER_ORDER = 100;

  protected texture: THREE.Texture | null = null;
  protected config: TilemapConfig;

  constructor(scene: THREE.Scene, config: TilemapConfig) {
    this.scene = scene;
    this.config = config;
    this.initializeTileMaterials();
  }

  protected async initializeTileMaterials(): Promise<void> {
    if (this.materialsInitialized) return;

    try {
      if (!this.texture) {
        this.texture = await BaseTileRenderer.textureLoader.loadAsync(this.config.path);
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.colorSpace = THREE.SRGBColorSpace;
      }

      const tileWidthWithGap = this.config.tileWidth + this.config.tileGap;
      const tilesPerRow = Math.floor((this.texture.image.width + this.config.tileGap) / tileWidthWithGap);

      await this.createTileMaterials(tilesPerRow, this.texture);
      this.createPrototypeSprites();

      this.materialsInitialized = true;
      console.log(`${this.constructor.name} materials and prototype sprites initialized successfully`);
    } catch (error) {
      console.error(`Failed to load texture for ${this.constructor.name}:`, error);
    }
  }

  protected abstract createTileMaterials(tilesPerRow: number, texture: THREE.Texture): Promise<void>;

  protected createTileMaterial(
    tileId: TTileIndex,
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

  protected createPrototypeSprites(): void {
    this.materials.forEach((material, tileId) => {
      const sprite = new THREE.Sprite(material);
      const spriteScale = HEX_SIZE * 3.2;
      sprite.scale.set(spriteScale, spriteScale * 1.15, 1);
      this.prototypeSprites.set(tileId, sprite);
    });
  }

  protected calculateTileUV(tileIndex: number, tilesPerRow: number, textureWidth: number, textureHeight: number) {
    const tileX = tileIndex % tilesPerRow;
    const tileY = Math.floor(tileIndex / tilesPerRow);

    const tileWidthWithGap = this.config.tileWidth + this.config.tileGap;
    const tileHeightWithGap = this.config.tileHeight + this.config.tileGap;

    const repeatX = this.config.tileWidth / textureWidth;
    const repeatY = this.config.tileHeight / textureHeight;

    const offsetX = (tileX * tileWidthWithGap) / textureWidth;
    const offsetY = 1 - ((tileY + 1) * tileHeightWithGap) / textureHeight;

    return { offsetX, offsetY, repeatX, repeatY };
  }

  protected createSingleTileSprite(
    spriteKey: string,
    tileId: TTileIndex,
    position: THREE.Vector3,
    row: number,
    isOverlay: boolean = false,
  ): void {
    const prototypeSprite = this.prototypeSprites.get(tileId);

    if (!prototypeSprite) {
      console.warn(`Prototype sprite for tileId: ${tileId} not found in ${this.constructor.name}`);
      return;
    }

    const sprite = prototypeSprite.clone();

    const yOffset = isOverlay ? 0.25 : 0.2;
    sprite.position.set(position.x, yOffset, position.z - HEX_SIZE * 0.825);

    sprite.renderOrder = Math.max(BaseTileRenderer.BASE_RENDER_ORDER + row, 1) + (isOverlay ? 1000 : 0);

    this.sprites.set(spriteKey, sprite);
    this.scene.add(sprite);
  }

  protected getTileIdFromSprite(sprite: THREE.Sprite): TTileIndex | null {
    for (const [tileId, prototypeSprite] of this.prototypeSprites) {
      if (sprite.material === prototypeSprite.material) {
        return tileId;
      }
    }
    return null;
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

    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}
