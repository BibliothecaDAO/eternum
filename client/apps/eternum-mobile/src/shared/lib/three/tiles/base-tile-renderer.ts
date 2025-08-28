import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "../utils/utils";
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

  protected spritePool: Map<TTileIndex, THREE.Sprite[]> = new Map();
  protected readonly POOL_SIZE = 100;
  protected positionCache: Map<string, THREE.Vector3> = new Map();

  protected pendingSceneAdds: Set<THREE.Group> = new Set();
  protected pendingSceneRemoves: Set<THREE.Group> = new Set();
  protected isBatchingSceneOps: boolean = false;

  protected visibleTileKeys: Set<string> = new Set();
  protected previousVisibleBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;

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
    } catch (error) {
      console.error(`Failed to load texture for ${this.constructor.name}:`, error);
    }
  }

  public async ensureMaterialsReady(): Promise<void> {
    await this.initializeTileMaterials();
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

      // Pre-populate sprite pool
      this.spritePool.set(tileId, []);
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const pooledSprite = new THREE.Sprite(material);
        this.configureSpriteScale(pooledSprite, tileId);
        this.spritePool.get(tileId)!.push(pooledSprite);
      }
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

    // Try to get a sprite from the pool first
    let sprite = this.getPooledSprite(tileId);

    if (!sprite) {
      // If pool is empty, create a new sprite
      const material = this.materials.get(tileId);

      if (!material) {
        console.warn(`Material for tileId: ${tileId} not found in ${this.constructor.name}`);
        return;
      }
      sprite = new THREE.Sprite(material);
      this.configureSpriteScale(sprite, tileId);
    }

    this.configureSpritePosition(sprite, position, row, isOverlay);
    sprite.renderOrder = Math.max(BaseTileRenderer.BASE_RENDER_ORDER + row, 1) + (isOverlay ? 1000 : 0);

    this.sprites.set(spriteKey, sprite);

    const [col, row_pos] = spriteKey.split(",").map(Number);
    const group = this.createTileGroup(col, row_pos);
    group.add(sprite);
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.updateTileVisibilitySmart(bounds);
  }

  protected updateTileVisibility(): void {
    if (!this.visibleBounds) return;

    this.startBatchSceneOps();

    for (const [hexKey, group] of this.tileGroups) {
      const [col, row] = hexKey.split(",").map(Number);
      const shouldBeVisible = this.isHexVisible(col, row);

      if (shouldBeVisible && !group.parent) {
        this.addGroupToScene(group);
        this.onTileGroupShown(col, row, group);
      } else if (!shouldBeVisible && group.parent) {
        this.removeGroupFromScene(group);
        this.onTileGroupHidden(col, row, group);
      }
    }

    this.applyBatchedSceneOps();
  }

  protected updateTileVisibilitySmart(bounds: {
    minCol: number;
    maxCol: number;
    minRow: number;
    maxRow: number;
  }): void {
    const visibilityStartTime = performance.now();

    // Build set of tiles that should be visible with new bounds
    const newVisibleTileKeys = new Set<string>();

    // Only check tiles that we have sprites for (existing tiles)
    for (const [hexKey] of this.tileGroups) {
      const [col, row] = hexKey.split(",").map(Number);
      if (col >= bounds.minCol && col <= bounds.maxCol && row >= bounds.minRow && row <= bounds.maxRow) {
        newVisibleTileKeys.add(hexKey);
      }
    }

    // Find tiles that changed visibility status
    const tilesToHide = new Set<string>();
    const tilesToShow = new Set<string>();

    // Find tiles that became invisible (were visible, now invisible)
    for (const hexKey of this.visibleTileKeys) {
      if (!newVisibleTileKeys.has(hexKey)) {
        tilesToHide.add(hexKey);
      }
    }

    // Find tiles that became visible (were invisible, now visible)
    for (const hexKey of newVisibleTileKeys) {
      if (!this.visibleTileKeys.has(hexKey)) {
        tilesToShow.add(hexKey);
      }
    }

    if (tilesToHide.size === 0 && tilesToShow.size === 0) {
      return;
    }

    this.startBatchSceneOps();

    // Hide tiles that became invisible
    for (const hexKey of tilesToHide) {
      const group = this.tileGroups.get(hexKey);
      if (group && group.parent) {
        this.removeGroupFromScene(group);
        const [col, row] = hexKey.split(",").map(Number);
        this.onTileGroupHidden(col, row, group);
      }
    }

    // Show tiles that became visible
    for (const hexKey of tilesToShow) {
      const group = this.tileGroups.get(hexKey);
      if (group && !group.parent) {
        this.addGroupToScene(group);
        const [col, row] = hexKey.split(",").map(Number);
        this.onTileGroupShown(col, row, group);
      }
    }

    this.applyBatchedSceneOps();

    // Update our tracking
    this.visibleTileKeys = newVisibleTileKeys;
    this.previousVisibleBounds = { ...bounds };
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

  protected getPooledSprite(tileId: TTileIndex): THREE.Sprite | null {
    const pool = this.spritePool.get(tileId);
    if (pool && pool.length > 0) {
      return pool.pop()!;
    }
    return null;
  }

  protected returnSpriteToPool(sprite: THREE.Sprite, tileId: TTileIndex): void {
    const pool = this.spritePool.get(tileId);
    if (pool && pool.length < this.POOL_SIZE) {
      sprite.position.set(0, 0, 0);
      sprite.rotation.set(0, 0, 0);
      sprite.scale.set(1, 1, 1);
      this.configureSpriteScale(sprite, tileId);
      pool.push(sprite);
    }
  }

  protected getCachedWorldPosition(col: number, row: number): THREE.Vector3 {
    const hexKey = `${col},${row}`;
    let cachedPosition = this.positionCache.get(hexKey);

    if (!cachedPosition) {
      getWorldPositionForTile({ col, row }, true, this.tempVector3);
      cachedPosition = this.tempVector3.clone();
      this.positionCache.set(hexKey, cachedPosition);
    }

    return cachedPosition;
  }

  protected startBatchSceneOps(): void {
    this.isBatchingSceneOps = true;
    this.pendingSceneAdds.clear();
    this.pendingSceneRemoves.clear();
  }

  protected applyBatchedSceneOps(): void {
    if (!this.isBatchingSceneOps) return;

    const addStartTime = performance.now();
    this.pendingSceneAdds.forEach((group) => {
      this.scene.add(group);
    });

    const removeStartTime = performance.now();
    this.pendingSceneRemoves.forEach((group) => {
      this.scene.remove(group);
    });

    this.pendingSceneAdds.clear();
    this.pendingSceneRemoves.clear();
    this.isBatchingSceneOps = false;
  }

  protected addGroupToScene(group: THREE.Group): void {
    if (this.isBatchingSceneOps) {
      this.pendingSceneAdds.add(group);
      this.pendingSceneRemoves.delete(group); // Remove from removes if it was there
    } else {
      this.scene.add(group);
    }
  }

  protected removeGroupFromScene(group: THREE.Group): void {
    if (this.isBatchingSceneOps) {
      this.pendingSceneRemoves.add(group);
      this.pendingSceneAdds.delete(group); // Remove from adds if it was there
    } else {
      this.scene.remove(group);
    }
  }

  public createTileGroup(col: number, row: number): THREE.Group {
    const hexKey = `${col},${row}`;
    let group = this.tileGroups.get(hexKey);

    if (!group) {
      group = new THREE.Group();
      const cachedPosition = this.getCachedWorldPosition(col, row);
      group.position.set(cachedPosition.x, 0, cachedPosition.z - HEX_SIZE * 0.825);
      this.tileGroups.set(hexKey, group);

      if (this.isHexVisible(col, row)) {
        this.addGroupToScene(group);
        this.visibleTileKeys.add(hexKey);
      } else {
      }
    } else {
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
          this.removeGroupFromScene(group);
        }
        this.tileGroups.delete(hexKey);
        this.visibleTileKeys.delete(hexKey);
      }
    }
  }

  public removeTileGroup(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const group = this.tileGroups.get(hexKey);
    if (group) {
      if (group.parent) {
        this.removeGroupFromScene(group);
      }
      group.children.forEach((child) => {
        group.remove(child);
      });
      this.tileGroups.delete(hexKey);
      this.visibleTileKeys.delete(hexKey);
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

    // Return all sprites to pool before clearing
    this.sprites.forEach((sprite) => {
      const tileId = this.getTileIdFromSprite(sprite);
      if (tileId !== null) {
        this.returnSpriteToPool(sprite, tileId);
      }
    });

    this.startBatchSceneOps();
    this.tileGroups.forEach((group) => {
      if (group.parent) {
        this.removeGroupFromScene(group);
      }
      group.children.forEach((child) => {
        group.remove(child);
      });
    });
    this.applyBatchedSceneOps();
    this.tileGroups.clear();
    this.sprites.clear();
    this.visibleTileKeys.clear();
  }

  public removeTile(col: number, row: number): void {
    const hexKey = `${col},${row}`;
    const sprite = this.sprites.get(hexKey);
    const group = this.tileGroups.get(hexKey);

    if (sprite && group) {
      group.remove(sprite);
      this.sprites.delete(hexKey);

      // Return sprite to pool if possible
      const tileId = this.getTileIdFromSprite(sprite);
      if (tileId !== null) {
        this.returnSpriteToPool(sprite, tileId);
      }

      if (group.children.length === 0) {
        if (group.parent) {
          this.removeGroupFromScene(group);
        }
        this.tileGroups.delete(hexKey);
        this.visibleTileKeys.delete(hexKey);
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

    if (!group) {
      return Promise.resolve();
    }

    this.movingTiles.add(hexKey);

    return new Promise((resolve) => {
      const startPosition = group.position.clone();

      const endPosition = this.getCachedWorldPosition(targetCol, targetRow).clone();
      endPosition.y = 0;
      endPosition.z -= HEX_SIZE * 0.825;

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        group.position.lerpVectors(startPosition, endPosition, easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
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
        const startPosition = group.position.clone();
        const endPosition = this.getCachedWorldPosition(targetHex.col, targetHex.row).clone();
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

    // Clear sprite pools
    this.spritePool.forEach((pool) => {
      pool.forEach((sprite) => {
        void sprite; // Pool sprites share materials, no individual cleanup needed
      });
      pool.length = 0;
    });
    this.spritePool.clear();

    this.materials.forEach((material) => {
      material.dispose();
      if (material.map) {
        material.map.dispose();
      }
    });

    this.materials.clear();
    this.materialsInitialized = false;
    this.movingTiles.clear();
    this.positionCache.clear();
    this.pendingSceneAdds.clear();
    this.pendingSceneRemoves.clear();
    this.isBatchingSceneOps = false;
    this.visibleTileKeys.clear();
    this.previousVisibleBounds = null;

    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}
