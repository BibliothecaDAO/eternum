import { BuildingType, StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { loggedInAccount } from "../helpers/utils";
import { BuildingTileRenderer } from "./tiles/building-tile-renderer";
import { BuildingTileIndex, getBuildingTileIndex } from "./tiles/tile-enums";
import { UnitTilePosition, UnitTileRenderer } from "./tiles/unit-tile-renderer";
import { HEX_SIZE } from "./utils";

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
  buildingType?: BuildingType;
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
  protected selectedObjectId: number | null = null;
  protected visibleBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null = null;

  protected tempVector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public abstract setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void;
  public abstract addObject(object: T): void;
  public abstract removeObject(objectId: number): void;
  public abstract updateObject(object: T): void;
  public abstract updateObjectPosition(objectId: number, col: number, row: number): void;
  public abstract moveObject(objectId: number, targetCol: number, targetRow: number, duration?: number): Promise<void>;
  public abstract moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration?: number,
  ): Promise<void>;
  public abstract isObjectMoving(objectId: number): boolean;
  public abstract getObject(objectId: number): T | undefined;
  public abstract getObjectsAtHex(col: number, row: number): T[];
  public abstract selectObject(objectId: number): void;
  public abstract deselectObject(): void;
  public abstract getSelectedObjectId(): number | null;
  public abstract getAllObjects(): T[];
  public abstract dispose(): void;
}

export class ArmyRenderer extends ObjectRenderer<ArmyObject> {
  private labels: Map<number, CSS2DObject> = new Map();
  private unitTileRenderer: UnitTileRenderer;
  private movingObjects: Set<number> = new Set();
  private labelAttachmentState: Map<number, boolean> = new Map();

  constructor(scene: THREE.Scene) {
    super(scene);
    this.unitTileRenderer = new UnitTileRenderer(scene);
  }

  public addObject(object: ArmyObject): void {
    console.log(`[ArmyRenderer] addObject: Adding army ${object.id} at (${object.col},${object.row})`);
    this.objects.set(object.id, object);
    this.createLabel(object);
    this.syncUnitTile(object);
  }

  public updateObject(object: ArmyObject): void {
    const existingArmy = this.objects.get(object.id);

    console.log(`[ArmyRenderer] updateObject called for army ${object.id}`, {
      existingPosition: existingArmy ? { col: existingArmy.col, row: existingArmy.row } : null,
      newPosition: { col: object.col, row: object.row },
      hasPositionChanged: existingArmy ? existingArmy.col !== object.col || existingArmy.row !== object.row : false,
      isCurrentlyMoving: this.movingObjects.has(object.id),
    });

    // Check if the army has moved to a new position
    if (existingArmy && (existingArmy.col !== object.col || existingArmy.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.movingObjects.has(object.id)) {
        console.log(`[ArmyRenderer] Army ${object.id} is already moving, skipping update`);
        return;
      }

      console.log(
        `[ArmyRenderer] Starting movement animation for army ${object.id} from (${existingArmy.col},${existingArmy.row}) to (${object.col},${object.row})`,
      );

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000).then(() => {
        console.log(`[ArmyRenderer] Movement completed for army ${object.id}`);
        // Update label content after movement completes
        this.updateLabelContent(object);
      });
    } else {
      console.log(`[ArmyRenderer] No position change for army ${object.id}, updating properties only`);
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.updateLabelContent(object);
      this.syncUnitTile(object);
    }
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
      staminaElement.textContent = `${army.currentStamina}${army.maxStamina ? `/${army.maxStamina}` : ""}`;
    }
  }

  public removeObject(objectId: number): void {
    const army = this.objects.get(objectId);
    if (army) {
      this.unitTileRenderer.removeTile(army.col, army.row);
    }
    this.removeLabel(objectId);
    this.objects.delete(objectId);
    this.movingObjects.delete(objectId);
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
      "has-[.opacity-0]:h-12",
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
      staminaText.textContent = `${army.currentStamina}${army.maxStamina ? `/${army.maxStamina}` : ""}`;
      staminaText.classList.add("text-white", "font-mono");
      staminaInfo.appendChild(staminaText);

      textContainer.appendChild(staminaInfo);
    }

    labelDiv.appendChild(textContainer);

    // Create CSS2DObject
    const label = new CSS2DObject(labelDiv);

    // Position the label above the tile (relative to tile group position)
    label.position.set(0, 2.1, -HEX_SIZE * 1.425);

    // Store entityId in userData for identification
    label.userData.entityId = army.id;

    this.labels.set(army.id, label);

    // Set initial attachment state based on visibility bounds
    const shouldBeVisible = this.isHexVisible(army.col, army.row);
    if (shouldBeVisible) {
      this.unitTileRenderer.addObjectToTileGroup(army.col, army.row, label);
      this.labelAttachmentState.set(army.id, true);
    } else {
      this.labelAttachmentState.set(army.id, false);
    }
  }

  private syncUnitTile(army: ArmyObject): void {
    console.log(
      `[ArmyRenderer] syncUnitTile: Syncing tile for army ${army.id} at (${army.col},${army.row}) with troopType ${army.troopType}, troopTier ${army.troopTier}`,
    );
    this.unitTileRenderer.addTile(army.col, army.row, army.troopType, army.troopTier, false, true);
  }

  private removeLabel(armyId: number): void {
    const label = this.labels.get(armyId);
    const army = this.objects.get(armyId);
    if (label && army) {
      const isAttached = this.labelAttachmentState.get(armyId) ?? false;
      if (isAttached) {
        this.unitTileRenderer.removeObjectFromTileGroup(army.col, army.row, label);
      }
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.labels.delete(armyId);
      this.labelAttachmentState.delete(armyId);
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
    this.unitTileRenderer.setVisibleBounds(bounds);
    this.updateLabelVisibility();
  }

  public getUnitTileRenderer(): UnitTileRenderer {
    return this.unitTileRenderer;
  }

  private updateLabelVisibility(): void {
    this.labels.forEach((label, armyId) => {
      const army = this.objects.get(armyId);
      if (army) {
        const shouldBeVisible = this.isHexVisible(army.col, army.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(armyId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.unitTileRenderer.addObjectToTileGroup(army.col, army.row, label);
          this.labelAttachmentState.set(armyId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.unitTileRenderer.removeObjectFromTileGroup(army.col, army.row, label);
          this.labelAttachmentState.set(armyId, false);
        }
      }
    });
  }

  public updateAllUnitTiles(): void {
    const unitTilePositions: UnitTilePosition[] = Array.from(this.objects.values()).map((army) => ({
      col: army.col,
      row: army.row,
      troopType: army.troopType,
      troopTier: army.troopTier,
      isExplored: true,
    }));

    this.unitTileRenderer.updateTilesForHexes(unitTilePositions);
  }

  protected updateLabelPosition(objectId: number, col: number, row: number): void {
    // Labels are now part of tile groups, so no manual position updates needed
    // The tile renderer handles positioning automatically
    void objectId;
    void col;
    void row;
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldArmy = this.objects.get(objectId);
    if (oldArmy) {
      this.unitTileRenderer.removeTile(oldArmy.col, oldArmy.row);

      const label = this.labels.get(objectId);
      if (label) {
        const wasAttached = this.labelAttachmentState.get(objectId) ?? false;
        if (wasAttached) {
          this.unitTileRenderer.removeObjectFromTileGroup(oldArmy.col, oldArmy.row, label);
        }
      }
    }

    const army = this.objects.get(objectId);
    if (army) {
      army.col = col;
      army.row = row;

      this.syncUnitTile(army);

      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(col, row);
        if (shouldBeVisible) {
          this.unitTileRenderer.addObjectToTileGroup(col, row, label);
          this.labelAttachmentState.set(objectId, true);
        } else {
          this.labelAttachmentState.set(objectId, false);
        }
      }
    }
  }

  protected updateLabelPositionFromSprite(objectId: number): void {
    // Labels are now part of tile groups and move automatically with the tile
    void objectId;
  }

  public getObject(objectId: number): ArmyObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): ArmyObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): ArmyObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
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

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const army = this.objects.get(objectId);

    if (army) {
      this.unitTileRenderer.selectTile(army.col, army.row);
    }
  }

  public deselectObject(): void {
    this.unitTileRenderer.deselectTile();
    this.selectedObjectId = null;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const army = this.objects.get(objectId);
    if (!army) {
      console.log(`[ArmyRenderer] moveObject: Army ${objectId} not found`);
      return Promise.resolve();
    }

    const startCol = army.col;
    const startRow = army.row;

    console.log(
      `[ArmyRenderer] moveObject: Moving army ${objectId} from (${startCol},${startRow}) to (${targetCol},${targetRow}) with duration ${duration}ms`,
    );

    // Mark as moving
    this.movingObjects.add(objectId);
    console.log(
      `[ArmyRenderer] moveObject: Marked army ${objectId} as moving. Moving objects count: ${this.movingObjects.size}`,
    );

    return this.unitTileRenderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      console.log(`[ArmyRenderer] moveObject: Tile movement completed for army ${objectId}`);

      // Update army position after movement completes
      army.col = targetCol;
      army.row = targetRow;

      // Update label attachment for new position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(targetCol, targetRow);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.unitTileRenderer.addObjectToTileGroup(targetCol, targetRow, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.unitTileRenderer.removeObjectFromTileGroup(targetCol, targetRow, label);
          this.labelAttachmentState.set(objectId, false);
        }
      }

      // Mark as no longer moving
      this.movingObjects.delete(objectId);
      console.log(
        `[ArmyRenderer] moveObject: Unmarked army ${objectId} as moving. Moving objects count: ${this.movingObjects.size}`,
      );
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const army = this.objects.get(objectId);
    if (!army || path.length === 0) {
      return Promise.resolve();
    }

    const startCol = army.col;
    const startRow = army.row;
    const finalHex = path[path.length - 1];

    // Mark as moving
    this.movingObjects.add(objectId);

    return this.unitTileRenderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update army position after movement completes
      army.col = finalHex.col;
      army.row = finalHex.row;

      // Update label attachment for final position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(finalHex.col, finalHex.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.unitTileRenderer.addObjectToTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.unitTileRenderer.removeObjectFromTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, false);
        }
      }

      // Mark as no longer moving
      this.movingObjects.delete(objectId);
    });
  }

  public isObjectMoving(objectId: number): boolean {
    return this.movingObjects.has(objectId);
  }

  public dispose(): void {
    this.labels.forEach((label) => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();
    this.movingObjects.clear();
    this.labelAttachmentState.clear();

    this.unitTileRenderer.dispose();
  }
}

export class StructureRenderer extends ObjectRenderer<StructureObject> {
  private buildingTileRenderer: BuildingTileRenderer;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: StructureObject): void {
    this.objects.set(object.id, object);
    this.syncBuildingTile(object);
  }

  public updateObject(object: StructureObject): void {
    const existingStructure = this.objects.get(object.id);

    // Check if the structure has moved to a new position (unlikely but consistent API)
    if (existingStructure && (existingStructure.col !== object.col || existingStructure.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.isObjectMoving(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.syncBuildingTile(object);
    }
  }

  public removeObject(objectId: number): void {
    const structure = this.objects.get(objectId);
    if (structure) {
      this.buildingTileRenderer.removeTile(structure.col, structure.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldStructure = this.objects.get(objectId);
    if (oldStructure) {
      this.buildingTileRenderer.removeTile(oldStructure.col, oldStructure.row);
    }

    const structure = this.objects.get(objectId);
    if (structure) {
      structure.col = col;
      structure.row = row;
      this.syncBuildingTile(structure);
    }
  }

  private syncBuildingTile(structure: StructureObject): void {
    const tileIndex = this.getTileIndexFromStructure(structure);
    this.buildingTileRenderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
  }

  private getTileIndexFromStructure(structure: StructureObject): BuildingTileIndex {
    const structureType = structure.structureType ? (parseInt(structure.structureType) as StructureType) : undefined;
    const buildingType = structure.buildingType;
    const level = structure.level;

    return getBuildingTileIndex(structureType, buildingType, level);
  }

  public getBuildingTileRenderer(): BuildingTileRenderer {
    return this.buildingTileRenderer;
  }

  public updateAllBuildingTiles(): void {
    this.buildingTileRenderer.clearTiles();

    Array.from(this.objects.values()).forEach((structure) => {
      const tileIndex = this.getTileIndexFromStructure(structure);
      this.buildingTileRenderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
    });
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const structure = this.objects.get(objectId);

    if (structure) {
      this.buildingTileRenderer.selectTile(structure.col, structure.row);
    }
  }

  public deselectObject(): void {
    this.buildingTileRenderer.deselectTile();
    this.selectedObjectId = null;
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.buildingTileRenderer.setVisibleBounds(bounds);
  }

  public getObject(objectId: number): StructureObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): StructureObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): StructureObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const structure = this.objects.get(objectId);
    if (!structure) {
      return Promise.resolve();
    }

    const startCol = structure.col;
    const startRow = structure.row;

    return this.buildingTileRenderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update structure position after movement completes
      structure.col = targetCol;
      structure.row = targetRow;
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const structure = this.objects.get(objectId);
    if (!structure || path.length === 0) {
      return Promise.resolve();
    }

    const startCol = structure.col;
    const startRow = structure.row;
    const finalHex = path[path.length - 1];

    return this.buildingTileRenderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update structure position after movement completes
      structure.col = finalHex.col;
      structure.row = finalHex.row;
    });
  }

  public isObjectMoving(objectId: number): boolean {
    const structure = this.objects.get(objectId);
    if (!structure) return false;
    return this.buildingTileRenderer.isTileMoving(structure.col, structure.row);
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

  public dispose(): void {
    this.buildingTileRenderer.dispose();
  }
}

export class QuestRenderer extends ObjectRenderer<QuestObject> {
  private buildingTileRenderer: BuildingTileRenderer;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: QuestObject): void {
    this.objects.set(object.id, object);
    // Use Chest tile index for quests temporarily
    this.buildingTileRenderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true);
  }

  public updateObject(object: QuestObject): void {
    const existingQuest = this.objects.get(object.id);

    // Check if the quest has moved to a new position (unlikely but consistent API)
    if (existingQuest && (existingQuest.col !== object.col || existingQuest.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.isObjectMoving(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.buildingTileRenderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true);
    }
  }

  public removeObject(objectId: number): void {
    const quest = this.objects.get(objectId);
    if (quest) {
      this.buildingTileRenderer.removeTile(quest.col, quest.row);
    }
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldQuest = this.objects.get(objectId);
    if (oldQuest) {
      this.buildingTileRenderer.removeTile(oldQuest.col, oldQuest.row);
    }

    const quest = this.objects.get(objectId);
    if (quest) {
      quest.col = col;
      quest.row = row;
      this.buildingTileRenderer.addTileByIndex(col, row, BuildingTileIndex.Chest, true);
    }
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.buildingTileRenderer.setVisibleBounds(bounds);
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const quest = this.objects.get(objectId);

    if (quest) {
      this.buildingTileRenderer.selectTile(quest.col, quest.row);
    }
  }

  public deselectObject(): void {
    this.buildingTileRenderer.deselectTile();
    this.selectedObjectId = null;
  }

  public getObject(objectId: number): QuestObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): QuestObject[] {
    return Array.from(this.objects.values()).filter((obj) => obj.col === col && obj.row === row);
  }

  public getAllObjects(): QuestObject[] {
    return Array.from(this.objects.values());
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public moveObject(objectId: number, targetCol: number, targetRow: number, duration: number = 1000): Promise<void> {
    const quest = this.objects.get(objectId);
    if (!quest) {
      return Promise.resolve();
    }

    const startCol = quest.col;
    const startRow = quest.row;

    return this.buildingTileRenderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update quest position after movement completes
      quest.col = targetCol;
      quest.row = targetRow;
    });
  }

  public moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    const quest = this.objects.get(objectId);
    if (!quest || path.length === 0) {
      return Promise.resolve();
    }

    const startCol = quest.col;
    const startRow = quest.row;
    const finalHex = path[path.length - 1];

    return this.buildingTileRenderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update quest position after movement completes
      quest.col = finalHex.col;
      quest.row = finalHex.row;
    });
  }

  public isObjectMoving(objectId: number): boolean {
    const quest = this.objects.get(objectId);
    if (!quest) return false;
    return this.buildingTileRenderer.isTileMoving(quest.col, quest.row);
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

  public dispose(): void {
    this.buildingTileRenderer.dispose();
  }

  public static disposeStaticAssets(): void {
    // No longer needed
  }
}
