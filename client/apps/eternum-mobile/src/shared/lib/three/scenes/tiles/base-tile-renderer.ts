import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "../utils";
import type { TilemapConfig } from "./tile-enums";

export interface TilePosition {
  col: number;
  row: number;
  isExplored: boolean;
}

export interface MovingTileData {
  col: number;
  row: number;
  targetCol: number;
  targetRow: number;
  additionalObjects?: THREE.Object3D[];
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

  protected selectedTile: string | null = null;
  protected animationId: number | null = null;
  protected startTime = performance.now();

  protected movingTiles: Set<string> = new Set();
  protected tileGroups: Map<string, THREE.Group> = new Map();
  protected visibleBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;

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
      this.configureSpriteScale(sprite, tileId);
      this.prototypeSprites.set(tileId, sprite);
    });
  }

  protected configureSpriteScale(sprite: THREE.Sprite, tileId: TTileIndex): void {
    void tileId; // Base implementation doesn't use tileId, but subclasses might
    const spriteScale = HEX_SIZE * 3.2;
    sprite.scale.set(spriteScale, spriteScale * 1.15, 1);
  }

  protected configureSpritePosition(
    sprite: THREE.Sprite,
    position: THREE.Vector3,
    row: number,
    isOverlay: boolean,
  ): void {
    void position; // Position is now handled by the group
    void row; // Base implementation doesn't use row for positioning, but subclasses might
    const yOffset = isOverlay ? 0.25 : 0.2;
    sprite.position.set(0, yOffset, 0);
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
    void position; // Position is now handled by the group

    console.log(`[BaseTileRenderer] createSingleTileSprite: Creating sprite for key ${spriteKey}, tileId ${tileId}`);

    const material = this.materials.get(tileId);

    if (!material) {
      console.warn(`Material for tileId: ${tileId} not found in ${this.constructor.name}`);
      return;
    }

    const sprite = new THREE.Sprite(material);
    this.configureSpriteScale(sprite, tileId);
    this.configureSpritePosition(sprite, position, row, isOverlay);
    sprite.renderOrder = Math.max(BaseTileRenderer.BASE_RENDER_ORDER + row, 1) + (isOverlay ? 1000 : 0);

    this.sprites.set(spriteKey, sprite);
    console.log(`[BaseTileRenderer] createSingleTileSprite: Added sprite to sprites map with key ${spriteKey}`);

    const [col, row_pos] = spriteKey.split(",").map(Number);
    const group = this.createTileGroup(col, row_pos);
    group.add(sprite);
    console.log(
      `[BaseTileRenderer] createSingleTileSprite: Added sprite to group for (${col},${row_pos}). Group children count: ${group.children.length}`,
    );
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.updateTileVisibility();
  }

  protected updateTileVisibility(): void {
    if (!this.visibleBounds) return;

    for (const [hexKey, group] of this.tileGroups) {
      const [col, row] = hexKey.split(",").map(Number);
      const shouldBeVisible = this.isHexVisible(col, row);

      if (shouldBeVisible && !group.parent) {
        this.scene.add(group);
        this.onTileGroupShown(col, row, group);
      } else if (!shouldBeVisible && group.parent) {
        this.scene.remove(group);
        this.onTileGroupHidden(col, row, group);
      }
    }
  }

  protected onTileGroupShown(col: number, row: number, group: THREE.Group): void {
    void col;
    void row;
    void group;
  }

  protected onTileGroupHidden(col: number, row: number, group: THREE.Group): void {
    void col;
    void row;
    void group;
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

  public createTileGroup(col: number, row: number): THREE.Group {
    const hexKey = `${col},${row}`;
    let group = this.tileGroups.get(hexKey);

    if (!group) {
      console.log(`[BaseTileRenderer] createTileGroup: Creating new group for (${col},${row})`);
      group = new THREE.Group();
      getWorldPositionForTile({ col, row }, true, this.tempVector3);
      group.position.set(this.tempVector3.x, 0, this.tempVector3.z - HEX_SIZE * 0.825);
      this.tileGroups.set(hexKey, group);

      if (this.isHexVisible(col, row)) {
        this.scene.add(group);
        console.log(`[BaseTileRenderer] createTileGroup: Added group to scene for (${col},${row})`);
      } else {
        console.log(`[BaseTileRenderer] createTileGroup: Group created but not visible for (${col},${row})`);
      }
    } else {
      console.log(`[BaseTileRenderer] createTileGroup: Reusing existing group for (${col},${row})`);
    }

    return group;
  }

  public addObjectToTileGroup(col: number, row: number, object: THREE.Object3D): void {
    const group = this.createTileGroup(col, row);
    group.add(object);
  }

  public removeObjectFromTileGroup(col: number, row: number, object: THREE.Object3D): void {
    const hexKey = `${col},${row}`;
    const group = this.tileGroups.get(hexKey);
    if (group) {
      group.remove(object);
      if (group.children.length === 0) {
        if (group.parent) {
          this.scene.remove(group);
        }
        this.tileGroups.delete(hexKey);
      }
    }
  }

  public removeTileGroup(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const group = this.tileGroups.get(hexKey);
    if (group) {
      if (group.parent) {
        this.scene.remove(group);
      }
      group.children.forEach((child) => {
        group.remove(child);
      });
      this.tileGroups.delete(hexKey);
    }
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
    const clearStartTime = performance.now();
    const groupCount = this.tileGroups.size;

    this.tileGroups.forEach((group) => {
      if (group.parent) {
        this.scene.remove(group);
      }
      group.children.forEach((child) => {
        group.remove(child);
      });
    });
    this.tileGroups.clear();
    this.sprites.clear();

    if (groupCount > 0) {
      console.log(
        `[TILE-TIMING] Cleared ${groupCount} tile groups in ${(performance.now() - clearStartTime).toFixed(2)}ms`,
      );
    }
  }

  public removeTile(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const sprite = this.sprites.get(hexKey);
    const group = this.tileGroups.get(hexKey);

    if (sprite && group) {
      group.remove(sprite);
      this.sprites.delete(hexKey);

      if (group.children.length === 0) {
        if (group.parent) {
          this.scene.remove(group);
        }
        this.tileGroups.delete(hexKey);
      }
    }
  }

  public getTileCount(): number {
    return this.sprites.size;
  }

  public selectTile(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const sprite = this.sprites.get(hexKey);

    if (!sprite) return;

    this.selectedTile = hexKey;

    if (sprite.material instanceof THREE.SpriteMaterial) {
      const individualMaterial = sprite.material.clone();
      sprite.material = individualMaterial;
      sprite.userData.hasIndividualMaterial = true;
    }

    this.startSelectionAnimation();
  }

  public deselectTile(): void {
    if (!this.selectedTile) return;

    const sprite = this.sprites.get(this.selectedTile);
    if (sprite && sprite.material instanceof THREE.SpriteMaterial) {
      sprite.material.opacity = 1.0;

      if (sprite.userData.hasIndividualMaterial) {
        sprite.material.dispose();
        if (sprite.material.map) {
          sprite.material.map.dispose();
        }

        const tileId = this.getTileIdFromSprite(sprite);
        if (tileId !== null) {
          const originalMaterial = this.materials.get(tileId);
          if (originalMaterial) {
            sprite.material = originalMaterial;
          }
        }
        sprite.userData.hasIndividualMaterial = false;
      }
    }

    this.selectedTile = null;
    this.stopSelectionAnimation();
  }

  public getSelectedTile(): string | null {
    return this.selectedTile;
  }

  protected startSelectionAnimation(): void {
    if (this.animationId !== null) return;

    this.startTime = performance.now();
    this.animateSelection();
  }

  protected stopSelectionAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  protected animateSelection = (): void => {
    if (!this.selectedTile) {
      this.animationId = null;
      return;
    }

    const sprite = this.sprites.get(this.selectedTile);
    if (!sprite || !(sprite.material instanceof THREE.SpriteMaterial)) {
      this.animationId = null;
      return;
    }

    const currentTime = performance.now();
    const elapsed = (currentTime - this.startTime) / 1000;

    const pulseValue = Math.sin(elapsed * 3.0 * Math.PI) * 0.3 + 0.7;
    sprite.material.opacity = pulseValue;

    this.animationId = requestAnimationFrame(this.animateSelection);
  };

  public moveTile(
    col: number,
    row: number,
    targetCol: number,
    targetRow: number,
    duration: number = 1000,
  ): Promise<void> {
    const hexKey = `${col},${row}`;
    const targetHexKey = `${targetCol},${targetRow}`;
    const group = this.tileGroups.get(hexKey);

    console.log(
      `[BaseTileRenderer] moveTile: Attempting to move tile from (${col},${row}) to (${targetCol},${targetRow})`,
    );
    console.log(`[BaseTileRenderer] moveTile: Group exists:`, !!group);
    console.log(`[BaseTileRenderer] moveTile: Available groups:`, Array.from(this.tileGroups.keys()));

    if (!group) {
      console.log(`[BaseTileRenderer] moveTile: No group found at (${col},${row}), cannot move`);
      return Promise.resolve();
    }

    console.log(
      `[BaseTileRenderer] moveTile: Starting movement animation for ${hexKey} -> ${targetHexKey} over ${duration}ms`,
    );
    this.movingTiles.add(hexKey);

    return new Promise((resolve) => {
      const startPosition = group.position.clone();
      console.log(`[BaseTileRenderer] moveTile: Start position:`, startPosition);

      getWorldPositionForTile({ col: targetCol, row: targetRow }, true, this.tempVector3);
      const endPosition = this.tempVector3.clone();
      endPosition.y = 0;
      endPosition.z -= HEX_SIZE * 0.825;
      console.log(`[BaseTileRenderer] moveTile: End position:`, endPosition);

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        group.position.lerpVectors(startPosition, endPosition, easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          console.log(`[BaseTileRenderer] moveTile: Animation completed for ${hexKey}`);
          this.handleTileMoveComplete(hexKey, targetHexKey, targetCol, targetRow);
          this.movingTiles.delete(hexKey);
          resolve();
        }
      };

      animate();
    });
  }

  public moveTileAlongPath(
    col: number,
    row: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const hexKey = `${col},${row}`;
    const group = this.tileGroups.get(hexKey);

    if (!group || path.length === 0) {
      return Promise.resolve();
    }

    this.movingTiles.add(hexKey);

    return new Promise((resolve) => {
      let currentStep = 0;

      const moveToNextStep = () => {
        if (currentStep >= path.length) {
          const finalHex = path[path.length - 1];
          const finalHexKey = `${finalHex.col},${finalHex.row}`;
          this.handleTileMoveComplete(hexKey, finalHexKey, finalHex.col, finalHex.row);
          this.movingTiles.delete(hexKey);
          resolve();
          return;
        }

        const targetHex = path[currentStep];
        getWorldPositionForTile({ col: targetHex.col, row: targetHex.row }, true, this.tempVector3);

        const startPosition = group.position.clone();
        const endPosition = this.tempVector3.clone();
        endPosition.y = 0;
        endPosition.z -= HEX_SIZE * 0.825;

        const startTime = performance.now();

        const animate = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / stepDuration, 1);

          const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          const arcHeight = 0.1;
          const arcProgress = Math.sin(progress * Math.PI) * arcHeight;

          group.position.lerpVectors(startPosition, endPosition, easeProgress);
          group.position.y += arcProgress;

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            currentStep++;
            setTimeout(moveToNextStep, 50);
          }
        };

        animate();
      };

      moveToNextStep();
    });
  }

  protected handleTileMoveComplete(oldHexKey: string, newHexKey: string, newCol: number, newRow: number): void {
    const sprite = this.sprites.get(oldHexKey);
    const group = this.tileGroups.get(oldHexKey);

    if (sprite) {
      this.sprites.delete(oldHexKey);
      this.sprites.set(newHexKey, sprite);
    }

    if (group) {
      this.tileGroups.delete(oldHexKey);
      this.tileGroups.set(newHexKey, group);

      const shouldBeVisible = this.isHexVisible(newCol, newRow);
      if (shouldBeVisible && !group.parent) {
        this.scene.add(group);
      } else if (!shouldBeVisible && group.parent) {
        this.scene.remove(group);
      }
    }
  }

  public isTileMoving(col: number, row: number): boolean {
    const hexKey = `${col},${row}`;
    return this.movingTiles.has(hexKey);
  }

  public dispose(): void {
    this.stopSelectionAnimation();
    this.clearTiles();

    this.tileGroups.forEach((group) => {
      if (group.parent) {
        this.scene.remove(group);
      }
      group.children.forEach((child) => {
        group.remove(child);
      });
    });
    this.tileGroups.clear();

    this.prototypeSprites.forEach((sprite) => {
      void sprite; // No cleanup needed for prototype sprites
    });
    this.prototypeSprites.clear();

    this.materials.forEach((material) => {
      material.dispose();
      if (material.map) {
        material.map.dispose();
      }
    });

    this.materials.clear();
    this.materialsInitialized = false;
    this.movingTiles.clear();

    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}
