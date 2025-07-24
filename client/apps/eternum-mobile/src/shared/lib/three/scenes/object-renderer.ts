import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { isAddressEqualToAccount } from "../helpers/utils";
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
  troopType?: TroopType;
  troopTier?: TroopTier;
  ownerName?: string;
  guildName?: string;
  isDaydreamsAgent?: boolean;
  isAlly?: boolean;
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
  protected visibleBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;

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

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.updateObjectVisibility();
  }

  protected updateObjectVisibility(): void {
    if (!this.visibleBounds) return;

    for (const [objectId, object] of this.objects) {
      const sprite = this.sprites.get(objectId);

      if (sprite) {
        const shouldBeVisible = this.isHexVisible(object.col, object.row);

        if (shouldBeVisible && !sprite.parent) {
          this.scene.add(sprite);
        } else if (!shouldBeVisible && sprite.parent) {
          this.scene.remove(sprite);
        }
      }
    }
  }

  protected isHexVisible(col: number, row: number): boolean {
    if (!this.visibleBounds) return false;
    return (
      col >= this.visibleBounds.minCol &&
      col <= this.visibleBounds.maxCol &&
      row >= this.visibleBounds.minRow &&
      row <= this.visibleBounds.maxRow
    );
  }

  public addObject(object: T): void {
    this.objects.set(object.id, object);
    const sprite = this.createSprite(object);
    this.sprites.set(object.id, sprite);

    if (this.isHexVisible(object.col, object.row)) {
      this.scene.add(sprite);
    }
  }

  public removeObject(objectId: number): void {
    const sprite = this.sprites.get(objectId);
    if (sprite && sprite.parent) {
      this.scene.remove(sprite);
    }
    this.sprites.delete(objectId);
    this.objects.delete(objectId);

    if (this.selectedObjectId === objectId) {
      this.selectedObjectId = null;
      this.stopSelectionAnimation();
    }
  }

  public updateObject(object: T): void {
    const existingSprite = this.sprites.get(object.id);
    if (existingSprite && existingSprite.parent) {
      this.scene.remove(existingSprite);
    }

    this.objects.set(object.id, object);
    const sprite = this.createSprite(object);
    this.sprites.set(object.id, sprite);

    if (this.isHexVisible(object.col, object.row)) {
      this.scene.add(sprite);
    }
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

          const shouldBeVisible = this.isHexVisible(targetCol, targetRow);

          if (shouldBeVisible && !sprite.parent) {
            this.scene.add(sprite);
          } else if (!shouldBeVisible && sprite.parent) {
            this.scene.remove(sprite);
          }

          resolve();
        }
      };

      animate();
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const object = this.objects.get(objectId);
    const sprite = this.sprites.get(objectId);

    if (!object || !sprite || path.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let currentStep = 0;

      const moveToNextStep = () => {
        if (currentStep >= path.length) {
          resolve();
          return;
        }

        const targetHex = path[currentStep];
        getWorldPositionForTile({ col: targetHex.col, row: targetHex.row }, true, this.tempVector3);

        const startPosition = sprite.position.clone();
        const endPosition = this.tempVector3.clone();
        endPosition.y = 0.2;
        endPosition.z -= HEX_SIZE * 0.825;

        const startTime = performance.now();

        const animate = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / stepDuration, 1);

          // Chess-like movement: quick movement with slight arc
          const easeProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          // Add slight vertical arc for chess-like movement
          const arcHeight = 0.1;
          const arcProgress = Math.sin(progress * Math.PI) * arcHeight;

          sprite.position.lerpVectors(startPosition, endPosition, easeProgress);
          sprite.position.y += arcProgress;

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            object.col = targetHex.col;
            object.row = targetHex.row;

            const shouldBeVisible = this.isHexVisible(targetHex.col, targetHex.row);

            if (shouldBeVisible && !sprite.parent) {
              this.scene.add(sprite);
            } else if (!shouldBeVisible && sprite.parent) {
              this.scene.remove(sprite);
            }

            currentStep++;
            setTimeout(moveToNextStep, 50); // Small delay between steps
          }
        };

        animate();
      };

      moveToNextStep();
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
          const baseRenderOrder = Math.max(100 + object.row, 1);
          sprite.renderOrder = baseRenderOrder + (object.type === "army" ? 1000 : object.type === "quest" ? 1500 : 500);
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

  protected stopSelectionAnimation(): void {
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
      if (sprite.parent) {
        this.scene.remove(sprite);
      }
    });
    this.sprites.clear();
    this.objects.clear();
    this.visibleBounds = null;
  }
}

export class ArmyRenderer extends ObjectRenderer<ArmyObject> {
  private static armyMaterial: THREE.SpriteMaterial | null = null;
  private static armyTexture: THREE.Texture | null = null;
  private static textureLoader = new THREE.TextureLoader();
  private labels: Map<number, CSS2DObject> = new Map();

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

    sprite.renderOrder = Math.max(100 + army.row, 1) + 1000;

    return sprite;
  }

  public addObject(object: ArmyObject): void {
    super.addObject(object);
    // Create label for the army
    this.createLabel(object);
  }

  public updateObject(object: ArmyObject): void {
    // Remove existing label
    this.removeLabel(object.id);
    super.updateObject(object);
    // Create new label
    this.createLabel(object);
  }

  public removeObject(objectId: number): void {
    // Remove label
    this.removeLabel(objectId);
    super.removeObject(objectId);
  }

  private createLabel(army: ArmyObject): void {
    // Create label div
    const labelDiv = document.createElement("div");
    labelDiv.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      text-align: center;
      pointer-events: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // Determine ownership color using the same logic as desktop
    let textColor = "#ffffff";
    const isPlayerArmy = army.owner ? isAddressEqualToAccount(army.owner) : false;

    if (army.isDaydreamsAgent) {
      textColor = "#ffd700"; // Gold for AI agents
    } else if (isPlayerArmy) {
      textColor = "#00ff00"; // Green for player's armies
    } else if (army.isAlly) {
      textColor = "#87ceeb"; // Sky blue for allies
    } else if (army.owner && army.owner.toString() !== "0") {
      textColor = "#ff4444"; // Red for enemies
    }

    labelDiv.style.color = textColor;

    // Create label content
    const lines = [];

    // Owner name (if available)
    if (army.ownerName && army.ownerName !== "test") {
      lines.push(army.ownerName);
    } else if (army.isDaydreamsAgent) {
      lines.push("Agent");
    } else if (isPlayerArmy) {
      lines.push("My Army");
    } else {
      lines.push("Army");
    }

    // Troop info (if available)
    if (army.troopType && army.troopTier) {
      const troopName = this.getTroopDisplayName(army.troopType, army.troopTier);
      lines.push(troopName);
    }

    labelDiv.innerHTML = lines.join("<br>");

    // Create CSS2DObject
    const label = new CSS2DObject(labelDiv);

    // Position the label above the army sprite
    getWorldPositionForTile({ col: army.col, row: army.row }, true, this.tempVector3);
    label.position.set(this.tempVector3.x, 1.5, this.tempVector3.z - HEX_SIZE * 2.5);

    this.labels.set(army.id, label);

    // Add to scene if army is visible
    if (this.isHexVisible(army.col, army.row)) {
      this.scene.add(label);
    }
  }

  private removeLabel(armyId: number): void {
    const label = this.labels.get(armyId);
    if (label) {
      if (label.parent) {
        this.scene.remove(label);
      }
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.labels.delete(armyId);
    }
  }

  private getTroopDisplayName(troopType: TroopType, troopTier: TroopTier): string {
    const typeNames: Record<TroopType, string> = {
      [TroopType.Paladin]: "Paladin",
      [TroopType.Crossbowman]: "Crossbowman",
      [TroopType.Knight]: "Knight",
    };

    const tierNames: Record<TroopTier, string> = {
      [TroopTier.T1]: "I",
      [TroopTier.T2]: "II",
      [TroopTier.T3]: "III",
    };

    return `${typeNames[troopType] || "Unknown"} ${tierNames[troopTier] || ""}`;
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.updateObjectVisibility();
    this.updateLabelVisibility();
  }

  private updateLabelVisibility(): void {
    if (!this.visibleBounds) return;

    for (const [armyId, army] of this.objects) {
      const label = this.labels.get(armyId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(army.col, army.row);

        if (shouldBeVisible && !label.parent) {
          this.scene.add(label);
        } else if (!shouldBeVisible && label.parent) {
          this.scene.remove(label);
        }
      }
    }
  }

  protected getTileId(army: ArmyObject): number {
    return 19;
  }

  protected getSharedMaterial(objectType: string): THREE.SpriteMaterial {
    return ArmyRenderer.armyMaterial!;
  }

  public dispose(): void {
    // Remove all labels
    this.labels.forEach((label) => {
      if (label.parent) {
        this.scene.remove(label);
      }
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();

    super.dispose();
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

    sprite.renderOrder = Math.max(100 + structure.row, 1) + 500;

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

    sprite.renderOrder = Math.max(100 + quest.row, 1) + 1500;

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
