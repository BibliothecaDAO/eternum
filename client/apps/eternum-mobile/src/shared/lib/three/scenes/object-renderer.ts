import * as THREE from "three";
import { getWorldPositionForTile, HEX_SIZE } from "./utils";

export interface MapObject {
  id: number;
  col: number;
  row: number;
  owner?: bigint;
  type: string;
}

export interface ArmyObject extends MapObject {
  type: "army";
  strength?: number;
  isMoving?: boolean;
  targetCol?: number;
  targetRow?: number;
}

export interface StructureObject extends MapObject {
  type: "structure";
  structureType?: string;
  level?: number;
}

export interface QuestObject extends MapObject {
  type: "quest";
  questType?: string;
  isCompleted?: boolean;
}

export type GameMapObject = ArmyObject | StructureObject | QuestObject;

export abstract class ObjectRenderer<T extends MapObject> {
  protected scene: THREE.Scene;
  protected objects: Map<number, T> = new Map();
  protected sprites: Map<number, THREE.Sprite> = new Map();
  protected selectedObjectId: number | null = null;
  protected animationId: number | null = null;

  protected tempVector3 = new THREE.Vector3();
  protected tempColor = new THREE.Color();

  protected startTime = performance.now();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeMaterials();
  }

  protected abstract initializeMaterials(): void;
  protected abstract createSprite(object: T): THREE.Sprite;
  protected abstract getTileId(object: T): number;
  protected abstract getSharedMaterial(objectType: string): THREE.SpriteMaterial;

  public addObject(object: T): void {
    this.objects.set(object.id, object);
    const sprite = this.createSprite(object);
    this.sprites.set(object.id, sprite);
    this.scene.add(sprite);
  }

  public removeObject(objectId: number): void {
    const sprite = this.sprites.get(objectId);
    if (sprite) {
      this.scene.remove(sprite);
      this.sprites.delete(objectId);
    }
    this.objects.delete(objectId);

    if (this.selectedObjectId === objectId) {
      this.selectedObjectId = null;
      this.stopSelectionAnimation();
    }
  }

  public updateObject(object: T): void {
    const existingSprite = this.sprites.get(object.id);
    if (existingSprite) {
      this.scene.remove(existingSprite);
      this.sprites.delete(object.id);
    }

    this.objects.set(object.id, object);
    const sprite = this.createSprite(object);
    this.sprites.set(object.id, sprite);
    this.scene.add(sprite);
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const object = this.objects.get(objectId);
    const sprite = this.sprites.get(objectId);

    if (!object || !sprite) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startPosition = sprite.position.clone();
      getWorldPositionForTile({ col: targetCol, row: targetRow }, true, this.tempVector3);
      const endPosition = this.tempVector3.clone();
      endPosition.y = 0.2;
      endPosition.z -= HEX_SIZE * 0.825;

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = 1 - Math.pow(1 - progress, 3);

        sprite.position.lerpVectors(startPosition, endPosition, easeProgress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          object.col = targetCol;
          object.row = targetRow;
          resolve();
        }
      };

      animate();
    });
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const sprite = this.sprites.get(objectId);
    if (sprite) {
      sprite.renderOrder = 3000;

      // Move selected sprite higher to ensure it's above highlights
      sprite.userData.originalY = sprite.position.y;
      sprite.position.y = 0.35;

      // Create individual material for selected sprite to avoid affecting others
      if (sprite.material instanceof THREE.SpriteMaterial) {
        const individualMaterial = sprite.material.clone();
        sprite.material = individualMaterial;
        sprite.userData.hasIndividualMaterial = true;
      }
    }
    this.startSelectionAnimation();
  }

  public deselectObject(): void {
    if (this.selectedObjectId !== null) {
      const sprite = this.sprites.get(this.selectedObjectId);
      if (sprite) {
        // Restore original opacity
        if (sprite.material instanceof THREE.SpriteMaterial) {
          sprite.material.opacity = 1.0;

          // Dispose individual material and restore shared material
          if (sprite.userData.hasIndividualMaterial) {
            sprite.material.dispose();
            if (sprite.material.map) {
              sprite.material.map.dispose();
            }

            // Restore shared material based on object type
            const object = this.objects.get(this.selectedObjectId);
            if (object) {
              sprite.material = this.getSharedMaterial(object.type);
            }
            sprite.userData.hasIndividualMaterial = false;
          }
        }

        // Restore original Y position
        if (sprite.userData.originalY !== undefined) {
          sprite.position.y = sprite.userData.originalY;
          sprite.userData.originalY = undefined;
        }

        // Restore original render order
        const object = this.objects.get(this.selectedObjectId);
        if (object) {
          sprite.renderOrder = 10 + object.row + (object.type === "army" ? 1000 : object.type === "quest" ? 1500 : 500);
        }
      }
    }
    this.selectedObjectId = null;
    this.stopSelectionAnimation();
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public getObject(objectId: number): T | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): T[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): T[] {
    return Array.from(this.objects.values());
  }

  private startSelectionAnimation(): void {
    if (this.animationId !== null) return;

    this.startTime = performance.now();
    this.animateSelection();
  }

  private stopSelectionAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private animateSelection = (): void => {
    if (this.selectedObjectId === null) {
      this.animationId = null;
      return;
    }

    const sprite = this.sprites.get(this.selectedObjectId);
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

  public dispose(): void {
    this.stopSelectionAnimation();
    this.sprites.forEach((sprite) => {
      this.scene.remove(sprite);
    });
    this.sprites.clear();
    this.objects.clear();
  }
}

export class ArmyRenderer extends ObjectRenderer<ArmyObject> {
  private static armyMaterial: THREE.SpriteMaterial | null = null;
  private static armyTexture: THREE.Texture | null = null;
  private static textureLoader = new THREE.TextureLoader();

  protected initializeMaterials(): void {
    if (!ArmyRenderer.armyMaterial) {
      this.loadArmyTexture();
    }
  }

  private async loadArmyTexture(): Promise<void> {
    try {
      if (!ArmyRenderer.armyTexture) {
        ArmyRenderer.armyTexture = await ArmyRenderer.textureLoader.loadAsync("/images/tiles/biomes-tiles.png");
        ArmyRenderer.armyTexture.magFilter = THREE.LinearFilter;
        ArmyRenderer.armyTexture.minFilter = THREE.LinearFilter;
        ArmyRenderer.armyTexture.colorSpace = THREE.SRGBColorSpace;
      }

      const tileWidthWithGap = 256 + 1;
      const tilesPerRow = Math.floor((ArmyRenderer.armyTexture.image.width + 1) / tileWidthWithGap);
      const tileIndex = 15;

      const tileUV = this.calculateTileUV(
        tileIndex,
        tilesPerRow,
        ArmyRenderer.armyTexture.image.width,
        ArmyRenderer.armyTexture.image.height,
      );

      ArmyRenderer.armyMaterial = new THREE.SpriteMaterial({
        map: ArmyRenderer.armyTexture.clone(),
        transparent: true,
        alphaTest: 0.1,
        opacity: 1.0,
      });

      ArmyRenderer.armyMaterial.map!.offset.set(tileUV.offsetX, tileUV.offsetY);
      ArmyRenderer.armyMaterial.map!.repeat.set(tileUV.repeatX, tileUV.repeatY);
    } catch (error) {
      console.error("Failed to load army texture:", error);
    }
  }

  private calculateTileUV(tileIndex: number, tilesPerRow: number, textureWidth: number, textureHeight: number) {
    const tileX = tileIndex % tilesPerRow;
    const tileY = Math.floor(tileIndex / tilesPerRow);

    const tileWidth = 256;
    const tileHeight = 304;
    const tileGap = 1;
    const tileWidthWithGap = tileWidth + tileGap;
    const tileHeightWithGap = tileHeight + tileGap;

    const repeatX = tileWidth / textureWidth;
    const repeatY = tileHeight / textureHeight;

    const offsetX = (tileX * tileWidthWithGap) / textureWidth;
    const offsetY = 1 - ((tileY + 1) * tileHeightWithGap) / textureHeight;

    return { offsetX, offsetY, repeatX, repeatY };
  }

  protected createSprite(army: ArmyObject): THREE.Sprite {
    const sprite = new THREE.Sprite(ArmyRenderer.armyMaterial!);

    const spriteScale = HEX_SIZE * 3.2;
    sprite.scale.set(spriteScale, spriteScale * 1.15, 1);
    sprite.userData.originalScale = { x: spriteScale, y: spriteScale * 1.15, z: 1 };

    getWorldPositionForTile({ col: army.col, row: army.row }, true, this.tempVector3);
    sprite.position.set(this.tempVector3.x, 0.2, this.tempVector3.z - HEX_SIZE * 0.825);

    sprite.renderOrder = 10 + army.row + 1000;

    return sprite;
  }

  protected getTileId(army: ArmyObject): number {
    return 19;
  }

  protected getSharedMaterial(objectType: string): THREE.SpriteMaterial {
    return ArmyRenderer.armyMaterial!;
  }

  public static disposeStaticAssets(): void {
    if (ArmyRenderer.armyMaterial) {
      ArmyRenderer.armyMaterial.dispose();
      if (ArmyRenderer.armyMaterial.map) {
        ArmyRenderer.armyMaterial.map.dispose();
      }
      ArmyRenderer.armyMaterial = null;
    }
    if (ArmyRenderer.armyTexture) {
      ArmyRenderer.armyTexture.dispose();
      ArmyRenderer.armyTexture = null;
    }
  }
}

export class StructureRenderer extends ObjectRenderer<StructureObject> {
  private static structureMaterial: THREE.SpriteMaterial | null = null;
  private static structureTexture: THREE.Texture | null = null;
  private static textureLoader = new THREE.TextureLoader();

  protected initializeMaterials(): void {
    if (!StructureRenderer.structureMaterial) {
      this.loadStructureTexture();
    }
  }

  private async loadStructureTexture(): Promise<void> {
    try {
      if (!StructureRenderer.structureTexture) {
        StructureRenderer.structureTexture = await StructureRenderer.textureLoader.loadAsync(
          "/images/tiles/biomes-tiles.png",
        );
        StructureRenderer.structureTexture.magFilter = THREE.LinearFilter;
        StructureRenderer.structureTexture.minFilter = THREE.LinearFilter;
        StructureRenderer.structureTexture.colorSpace = THREE.SRGBColorSpace;
      }

      const tileWidthWithGap = 256 + 1;
      const tilesPerRow = Math.floor((StructureRenderer.structureTexture.image.width + 1) / tileWidthWithGap);
      const tileIndex = 14;

      const tileUV = this.calculateTileUV(
        tileIndex,
        tilesPerRow,
        StructureRenderer.structureTexture.image.width,
        StructureRenderer.structureTexture.image.height,
      );

      StructureRenderer.structureMaterial = new THREE.SpriteMaterial({
        map: StructureRenderer.structureTexture.clone(),
        transparent: true,
        alphaTest: 0.1,
        opacity: 1.0,
      });

      StructureRenderer.structureMaterial.map!.offset.set(tileUV.offsetX, tileUV.offsetY);
      StructureRenderer.structureMaterial.map!.repeat.set(tileUV.repeatX, tileUV.repeatY);
    } catch (error) {
      console.error("Failed to load structure texture:", error);
    }
  }

  private calculateTileUV(tileIndex: number, tilesPerRow: number, textureWidth: number, textureHeight: number) {
    const tileX = tileIndex % tilesPerRow;
    const tileY = Math.floor(tileIndex / tilesPerRow);

    const tileWidth = 256;
    const tileHeight = 304;
    const tileGap = 1;
    const tileWidthWithGap = tileWidth + tileGap;
    const tileHeightWithGap = tileHeight + tileGap;

    const repeatX = tileWidth / textureWidth;
    const repeatY = tileHeight / textureHeight;

    const offsetX = (tileX * tileWidthWithGap) / textureWidth;
    const offsetY = 1 - ((tileY + 1) * tileHeightWithGap) / textureHeight;

    return { offsetX, offsetY, repeatX, repeatY };
  }

  protected createSprite(structure: StructureObject): THREE.Sprite {
    const sprite = new THREE.Sprite(StructureRenderer.structureMaterial!);

    const spriteScale = HEX_SIZE * 3.2;
    sprite.scale.set(spriteScale, spriteScale * 1.15, 1);
    sprite.userData.originalScale = { x: spriteScale, y: spriteScale * 1.15, z: 1 };

    getWorldPositionForTile({ col: structure.col, row: structure.row }, true, this.tempVector3);
    sprite.position.set(this.tempVector3.x, 0.2, this.tempVector3.z - HEX_SIZE * 0.825);

    sprite.renderOrder = 10 + structure.row + 500;

    return sprite;
  }

  protected getTileId(structure: StructureObject): number {
    return 18;
  }

  protected getSharedMaterial(objectType: string): THREE.SpriteMaterial {
    return StructureRenderer.structureMaterial!;
  }

  public static disposeStaticAssets(): void {
    if (StructureRenderer.structureMaterial) {
      StructureRenderer.structureMaterial.dispose();
      if (StructureRenderer.structureMaterial.map) {
        StructureRenderer.structureMaterial.map.dispose();
      }
      StructureRenderer.structureMaterial = null;
    }
    if (StructureRenderer.structureTexture) {
      StructureRenderer.structureTexture.dispose();
      StructureRenderer.structureTexture = null;
    }
  }
}

export class QuestRenderer extends ObjectRenderer<QuestObject> {
  private static questMaterial: THREE.SpriteMaterial | null = null;

  protected initializeMaterials(): void {
    if (!QuestRenderer.questMaterial) {
      QuestRenderer.questMaterial = new THREE.SpriteMaterial({
        color: 0xffd700,
        transparent: true,
        alphaTest: 0.1,
        opacity: 1.0,
      });
    }
  }

  protected createSprite(quest: QuestObject): THREE.Sprite {
    const sprite = new THREE.Sprite(QuestRenderer.questMaterial!);

    const spriteScale = HEX_SIZE * 2.0;
    sprite.scale.set(spriteScale, spriteScale, 1);
    sprite.userData.originalScale = { x: spriteScale, y: spriteScale, z: 1 };

    getWorldPositionForTile({ col: quest.col, row: quest.row }, true, this.tempVector3);
    sprite.position.set(this.tempVector3.x, 0.3, this.tempVector3.z - HEX_SIZE * 0.825);

    sprite.renderOrder = 10 + quest.row + 1500;

    return sprite;
  }

  protected getTileId(quest: QuestObject): number {
    return 20;
  }

  protected getSharedMaterial(objectType: string): THREE.SpriteMaterial {
    return QuestRenderer.questMaterial!;
  }

  public static disposeStaticAssets(): void {
    if (QuestRenderer.questMaterial) {
      QuestRenderer.questMaterial.dispose();
      QuestRenderer.questMaterial = null;
    }
  }
}
