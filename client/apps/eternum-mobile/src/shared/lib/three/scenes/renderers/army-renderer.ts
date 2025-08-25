import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { loggedInAccount } from "../../helpers/utils";
import { UnitTilePosition, UnitTileRenderer } from "../tiles/unit-tile-renderer";
import { HEX_SIZE } from "../utils";
import { ObjectRenderer } from "./base-object-renderer";
import { ArmyObject } from "./types";

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
