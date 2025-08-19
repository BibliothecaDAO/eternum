import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { loggedInAccount } from "../helpers/utils";
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
  troopCount?: number;
  currentStamina?: number;
  maxStamina?: number;
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
  
  // Track objects that are currently moving to prevent conflicts
  protected movingObjects: Set<number> = new Set();

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
    // Remove any existing object first to prevent duplicates
    this.removeObject(object.id);
    
    this.objects.set(object.id, object);
    const sprite = this.createSprite(object);
    this.sprites.set(object.id, sprite);

    if (this.isHexVisible(object.col, object.row)) {
      this.scene.add(sprite);
    }
  }

  public removeObject(objectId: number): void {
    const sprite = this.sprites.get(objectId);
    if (sprite) {
      if (sprite.parent) {
        this.scene.remove(sprite);
      }
      // Dispose of the sprite material if it's individual
      if (sprite.userData.hasIndividualMaterial && sprite.material) {
        sprite.material.dispose();
      }
    }
    
    this.sprites.delete(objectId);
    this.objects.delete(objectId);
    this.movingObjects.delete(objectId);

    if (this.selectedObjectId === objectId) {
      this.selectedObjectId = null;
      this.stopSelectionAnimation();
    }
  }

  public updateObject(object: T): void {
    // If object is moving, only update non-position properties
    if (this.movingObjects.has(object.id)) {
      this.updateObjectProperties(object);
      return;
    }

    // For non-moving objects, do a full update
    this.updateObjectFull(object);
  }

  private updateObjectProperties(object: T): void {
    const existingObject = this.objects.get(object.id);
    if (!existingObject) return;

    // Update only non-position properties
    const updatedObject = {
      ...existingObject,
      owner: object.owner,
      type: object.type,
    };

    // Update army-specific properties if it's an army
    if ('troopType' in object && 'troopTier' in object) {
      (updatedObject as any).troopType = (object as any).troopType;
      (updatedObject as any).troopTier = (object as any).troopTier;
      (updatedObject as any).ownerName = (object as any).ownerName;
      (updatedObject as any).guildName = (object as any).guildName;
      (updatedObject as any).isDaydreamsAgent = (object as any).isDaydreamsAgent;
      (updatedObject as any).isAlly = (object as any).isAlly;
      (updatedObject as any).troopCount = (object as any).troopCount;
      (updatedObject as any).currentStamina = (object as any).currentStamina;
      (updatedObject as any).maxStamina = (object as any).maxStamina;
    }

    this.objects.set(object.id, updatedObject);
  }

  private updateObjectFull(object: T): void {
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

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const object = this.objects.get(objectId);
    const sprite = this.sprites.get(objectId);

    if (!object || !sprite) return;

    // Update the object's position
    object.col = col;
    object.row = row;

    // Update the sprite's position
    getWorldPositionForTile({ col, row }, true, this.tempVector3);
    sprite.position.set(this.tempVector3.x, 0.2, this.tempVector3.z - HEX_SIZE * 0.825);

    // Update visibility
    const shouldBeVisible = this.isHexVisible(col, row);
    if (shouldBeVisible && !sprite.parent) {
      this.scene.add(sprite);
    } else if (!shouldBeVisible && sprite.parent) {
      this.scene.remove(sprite);
    }

    // Update label position if this is an army
    this.updateLabelPosition(objectId, col, row);
  }

  protected updateLabelPosition(objectId: number, col: number, row: number): void {
    // Base implementation does nothing - override in subclasses
    void objectId;
    void col;
    void row;
  }

  // Update label to follow sprite position smoothly during movement
  // Override in subclasses that have labels
  protected updateLabelPositionFromSprite(objectId: number): void {
    // Base implementation does nothing
    void objectId;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const object = this.objects.get(objectId);
    const sprite = this.sprites.get(objectId);

    if (!object || !sprite) {
      return Promise.resolve();
    }

    // Mark object as moving
    this.movingObjects.add(objectId);

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
        
        // Update label position to follow sprite smoothly
        this.updateLabelPositionFromSprite(objectId);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Update final position
          object.col = targetCol;
          object.row = targetRow;

          const shouldBeVisible = this.isHexVisible(targetCol, targetRow);

          if (shouldBeVisible && !sprite.parent) {
            this.scene.add(sprite);
          } else if (!shouldBeVisible && sprite.parent) {
            this.scene.remove(sprite);
          }

          // Mark object as no longer moving
          this.movingObjects.delete(objectId);
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

    // Mark object as moving
    this.movingObjects.add(objectId);

    return new Promise((resolve) => {
      let currentStep = 0;

      const moveToNextStep = () => {
        if (currentStep >= path.length) {
          // Mark object as no longer moving
          this.movingObjects.delete(objectId);
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

          // Update label position to follow sprite smoothly during movement
          this.updateLabelPositionFromSprite(objectId);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            // Update object position
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

  public isObjectMoving(objectId: number): boolean {
    return this.movingObjects.has(objectId);
  }

  public getObject(objectId: number): T | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): T[] {
    return Array.from(this.objects.values()).filter(obj => obj.col === col && obj.row === row);
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
    // Update existing label content instead of recreating
    this.updateLabelContent(object);
    super.updateObject(object);
  }

  private updateLabelContent(army: ArmyObject): void {
    const label = this.labels.get(army.id);
    if (!label || !label.element) return;

    const playerAddress = loggedInAccount();
    const isPlayerArmy = army.owner && army.owner.toString() === playerAddress?.toString();
    
    // Update ownership colors
    let backgroundColor: string;
    let borderColor: string;
    let textColor: string;
    let hoverBackgroundColor: string;

    if (army.isDaydreamsAgent) {
      backgroundColor = "rgba(147, 51, 234, 0.3)";
      borderColor = "rgba(147, 51, 234, 0.5)";
      textColor = "#a855f7";
      hoverBackgroundColor = "rgba(147, 51, 234, 0.5)";
    } else if (isPlayerArmy) {
      backgroundColor = "rgba(34, 197, 94, 0.3)";
      borderColor = "rgba(34, 197, 94, 0.5)";
      textColor = "#d9f99d";
      hoverBackgroundColor = "rgba(34, 197, 94, 0.5)";
    } else {
      backgroundColor = "rgba(239, 68, 68, 0.3)";
      borderColor = "rgba(239, 68, 68, 0.5)";
      textColor = "#fecdd3";
      hoverBackgroundColor = "rgba(239, 68, 68, 0.5)";
    }

    label.element.style.setProperty("background-color", backgroundColor, "important");
    label.element.style.setProperty("border", `1px solid ${borderColor}`, "important");
    label.element.style.setProperty("color", textColor, "important");

    // Update hover effects
    label.element.onmouseenter = () => {
      label.element.style.setProperty("background-color", hoverBackgroundColor, "important");
    };

    label.element.onmouseleave = () => {
      label.element.style.setProperty("background-color", backgroundColor, "important");
    };

    // Update army icon
    const armyIcon = label.element.querySelector('[data-component="army-icon"]') as HTMLImageElement;
    if (armyIcon) {
      armyIcon.src = army.isDaydreamsAgent
        ? "/images/logos/daydreams.png"
        : `/images/labels/${isPlayerArmy ? "army" : "enemy_army"}.png`;
    }

    // Update owner text
    const ownerElement = label.element.querySelector('[data-component="owner"] span');
    if (ownerElement) {
      if (army.ownerName && army.ownerName !== "test") {
        ownerElement.textContent = army.ownerName;
      } else if (army.isDaydreamsAgent) {
        ownerElement.textContent = "Agent";
      } else if (isPlayerArmy) {
        ownerElement.textContent = "My Army";
      } else {
        ownerElement.textContent = "Army";
      }
    }

    // Update troop count if present
    const troopCountElement = label.element.querySelector('[data-component="troop-count"] [data-role="count"]');
    if (troopCountElement && army.troopType && army.troopTier) {
      const troopName = this.getTroopDisplayName(army.troopType, army.troopTier);
      const troopCountText = army.troopCount ? `${army.troopCount}x ${troopName}` : troopName;
      troopCountElement.textContent = troopCountText;
    }

    // Update stamina if present
    const staminaElement = label.element.querySelector('[data-component="stamina-info"] span:last-child');
    if (staminaElement && army.currentStamina !== undefined) {
      staminaElement.textContent = `${army.currentStamina}${army.maxStamina ? `/${army.maxStamina}` : ''}`;
    }
  }

  public removeObject(objectId: number): void {
    // Remove label
    this.removeLabel(objectId);
    super.removeObject(objectId);
  }

  private createLabel(army: ArmyObject): void {
    const playerAddress = loggedInAccount();
    const isPlayerArmy = army.owner && army.owner.toString() === playerAddress?.toString();

    // Create base label element with desktop styling
    const labelDiv = document.createElement("div");
    labelDiv.classList.add(
      "rounded-md",
      "p-0.5",
      "-translate-x-1/2",
      "text-xxs",
      "flex",
      "items-center",
      "group",
      "shadow-md",
      "font-semibold",
      "transition-[height]",
      "duration-700",
      "ease-in-out",
      "h-auto",
      "has-[.opacity-0]:h-12"
    );

    // Apply desktop-style ownership colors
    let backgroundColor: string;
    let borderColor: string;
    let textColor: string;
    let hoverBackgroundColor: string;

    if (army.isDaydreamsAgent) {
      backgroundColor = "rgba(147, 51, 234, 0.3)";
      borderColor = "rgba(147, 51, 234, 0.5)";
      textColor = "#a855f7";
      hoverBackgroundColor = "rgba(147, 51, 234, 0.5)";
    } else if (isPlayerArmy) {
      backgroundColor = "rgba(34, 197, 94, 0.3)";
      borderColor = "rgba(34, 197, 94, 0.5)";
      textColor = "#d9f99d";
      hoverBackgroundColor = "rgba(34, 197, 94, 0.5)";
    } else {
      backgroundColor = "rgba(239, 68, 68, 0.3)";
      borderColor = "rgba(239, 68, 68, 0.5)";
      textColor = "#fecdd3";
      hoverBackgroundColor = "rgba(239, 68, 68, 0.5)";
    }

    labelDiv.style.setProperty("background-color", backgroundColor, "important");
    labelDiv.style.setProperty("border", `1px solid ${borderColor}`, "important");
    labelDiv.style.setProperty("color", textColor, "important");

    // Add hover effects
    labelDiv.addEventListener("mouseenter", () => {
      labelDiv.style.setProperty("background-color", hoverBackgroundColor, "important");
    });

    labelDiv.addEventListener("mouseleave", () => {
      labelDiv.style.setProperty("background-color", backgroundColor, "important");
    });

    // Prevent right click
    labelDiv.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Add army icon
    const img = document.createElement("img");
    img.src = army.isDaydreamsAgent
      ? "/images/logos/daydreams.png"
      : `/images/labels/${isPlayerArmy ? "army" : "enemy_army"}.png`;
    img.classList.add("w-auto", "h-full", "inline-block", "object-contain", "max-w-[32px]");
    img.setAttribute("data-component", "army-icon");
    labelDiv.appendChild(img);

    // Create content container
    const textContainer = document.createElement("div");
    textContainer.classList.add("ml-1", "flex", "flex-col", "justify-center", "items-start", "text-left", "min-w-0");
    textContainer.setAttribute("data-component", "content-container");

    // Add owner information
    const ownerDisplay = document.createElement("div");
    ownerDisplay.classList.add("flex", "items-center", "gap-1", "min-w-0");
    ownerDisplay.setAttribute("data-component", "owner");

    const ownerText = document.createElement("span");
    ownerText.classList.add("truncate", "text-xxs");
    ownerText.style.color = "inherit";
    
    if (army.ownerName && army.ownerName !== "test") {
      ownerText.textContent = army.ownerName;
    } else if (army.isDaydreamsAgent) {
      ownerText.textContent = "Agent";
    } else if (isPlayerArmy) {
      ownerText.textContent = "My Army";
    } else {
      ownerText.textContent = "Army";
    }
    
    ownerDisplay.appendChild(ownerText);
    textContainer.appendChild(ownerDisplay);

    // Add troop info if available
    if (army.troopType && army.troopTier) {
      const troopDisplay = document.createElement("div");
      troopDisplay.classList.add("flex", "items-center", "text-xxs", "gap-1");
      troopDisplay.setAttribute("data-component", "troop-count");

      const troopIcon = document.createElement("span");
      troopIcon.textContent = "⚔️";
      troopIcon.classList.add("text-yellow-400");
      troopDisplay.appendChild(troopIcon);

      const troopText = document.createElement("span");
      troopText.classList.add("text-white", "font-mono");
      troopText.setAttribute("data-role", "count");
      
      const troopName = this.getTroopDisplayName(army.troopType, army.troopTier);
      const troopCountText = army.troopCount ? `${army.troopCount}x ${troopName}` : troopName;
      troopText.textContent = troopCountText;
      troopDisplay.appendChild(troopText);

      textContainer.appendChild(troopDisplay);
    }

    // Add stamina bar if available
    if (army.currentStamina !== undefined) {
      const staminaInfo = document.createElement("div");
      staminaInfo.classList.add("flex", "items-center", "text-xxs", "gap-1");
      staminaInfo.setAttribute("data-component", "stamina-info");

      const staminaIcon = document.createElement("span");
      staminaIcon.textContent = "⚡";
      staminaIcon.classList.add("text-yellow-400");
      staminaInfo.appendChild(staminaIcon);

      const staminaText = document.createElement("span");
      staminaText.textContent = `${army.currentStamina}${army.maxStamina ? `/${army.maxStamina}` : ''}`;
      staminaText.classList.add("text-white", "font-mono");
      staminaInfo.appendChild(staminaText);

      textContainer.appendChild(staminaInfo);
    }

    labelDiv.appendChild(textContainer);

    // Create CSS2DObject
    const label = new CSS2DObject(labelDiv);

    // Position the label above the army sprite
    getWorldPositionForTile({ col: army.col, row: army.row }, true, this.tempVector3);
    label.position.set(this.tempVector3.x, 2.1, this.tempVector3.z - HEX_SIZE * 2.25);
    
    // Store entityId in userData for identification
    label.userData.entityId = army.id;

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

  protected getTileId(_army: ArmyObject): number {
    return 19;
  }

  protected getSharedMaterial(_objectType: string): THREE.SpriteMaterial {
    return ArmyRenderer.armyMaterial!;
  }

  protected updateLabelPosition(objectId: number, col: number, row: number): void {
    const label = this.labels.get(objectId);
    if (label) {
      // Update label position to match tile position
      getWorldPositionForTile({ col, row }, true, this.tempVector3);
      label.position.set(this.tempVector3.x, 2.1, this.tempVector3.z - HEX_SIZE * 2.25);

      // Update visibility
      const shouldBeVisible = this.isHexVisible(col, row);
      if (shouldBeVisible && !label.parent) {
        this.scene.add(label);
      } else if (!shouldBeVisible && label.parent) {
        this.scene.remove(label);
      }
    }
  }

  // Override to implement smooth label following for armies
  protected updateLabelPositionFromSprite(objectId: number): void {
    const label = this.labels.get(objectId);
    const sprite = this.sprites.get(objectId);
    if (label && sprite) {
      // Copy sprite position and adjust for label offset
      label.position.copy(sprite.position);
      label.position.y = 2.1; // Fixed height above ground
      label.position.z += HEX_SIZE * 0.825 - HEX_SIZE * 2.25; // Adjust for sprite vs label offset difference
    }
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

  protected getTileId(_structure: StructureObject): number {
    return 18;
  }

  protected getSharedMaterial(_objectType: string): THREE.SpriteMaterial {
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

  protected getTileId(_quest: QuestObject): number {
    return 20;
  }

  protected getSharedMaterial(_objectType: string): THREE.SpriteMaterial {
    return QuestRenderer.questMaterial!;
  }

  public static disposeStaticAssets(): void {
    if (QuestRenderer.questMaterial) {
      QuestRenderer.questMaterial.dispose();
      QuestRenderer.questMaterial = null;
    }
  }
}
