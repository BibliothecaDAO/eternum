import { Position } from "@bibliothecadao/eternum";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { UnitTilePosition, UnitTileRenderer } from "../tiles/unit-tile-renderer";
import { ArmyLabelData, ArmyLabelType } from "../utils/labels/label-factory";
import { HEX_SIZE, loggedInAccount } from "../utils/utils";
import { EntityManager } from "./entity-manager";
import { ArmyObject } from "./types";

export class ArmyManager extends EntityManager<ArmyObject> {
  private labels: Map<number, CSS2DObject> = new Map();
  private unitTileRenderer: UnitTileRenderer;
  private movingObjects: Set<number> = new Set();
  private labelAttachmentState: Map<number, boolean> = new Map();

  constructor(scene: THREE.Scene) {
    super(scene);
    this.unitTileRenderer = new UnitTileRenderer(scene);
  }

  public addObject(object: ArmyObject): void {
    this.objects.set(object.id, object);
    this.createLabel(object);
    this.syncUnitTile(object);
  }

  public updateObject(object: ArmyObject): void {
    const existingArmy = this.objects.get(object.id);

    // Check if the army has moved to a new position
    if (existingArmy && (existingArmy.col !== object.col || existingArmy.row !== object.row)) {
      // If currently moving, don't start another movement
      if (this.movingObjects.has(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.updateLabelContent(object);
      this.syncUnitTile(object);
    }
  }

  private updateLabelContent(army: ArmyObject): void {
    const label = this.labels.get(army.id);
    if (!label || !label.element) return;

    // Don't recalculate stamina - use the values provided by the system
    // The hexagon-map has already calculated the correct stamina values
    const armyLabelData = this.convertArmyToLabelData(army);
    ArmyLabelType.updateElement?.(label.element, armyLabelData);
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
    const armyLabelData = this.convertArmyToLabelData(army);

    const labelDiv = ArmyLabelType.createElement(armyLabelData);

    // Create CSS2DObject
    const label = new CSS2DObject(labelDiv);

    // Position the label above the tile (relative to tile group position)
    label.position.set(0, 2.1, -HEX_SIZE * 2);

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

  private convertArmyToLabelData(army: ArmyObject): ArmyLabelData {
    const playerAddress = loggedInAccount();
    const isPlayerArmy = army.owner && army.owner.toString() === playerAddress?.toString();

    return {
      entityId: army.id,
      hexCoords: new Position({ x: army.col, y: army.row }),
      category: army.troopType || TroopType.Paladin,
      tier: army.troopTier || TroopTier.T1,
      isMine: Boolean(isPlayerArmy),
      isDaydreamsAgent: Boolean(army.isDaydreamsAgent),
      owner: {
        address: army.owner || 0n,
        ownerName: army.ownerName || (army.isDaydreamsAgent ? "Agent" : isPlayerArmy ? "My Army" : "Army"),
        guildName: "",
      },
      color: isPlayerArmy ? "green" : "red",
      troopCount: army.troopCount || 0,
      currentStamina: isNaN(army.currentStamina ?? 0) ? 0 : (army.currentStamina ?? 0),
      maxStamina: isNaN(army.maxStamina ?? 0) ? 0 : (army.maxStamina ?? 0),
    };
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
      return Promise.resolve();
    }

    const startCol = army.col;
    const startRow = army.row;
    // Mark as moving
    this.movingObjects.add(objectId);

    return this.unitTileRenderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update army position after movement completes
      army.col = targetCol;
      army.row = targetRow;

      // Note: Don't update label content here - wait for system update with fresh stamina data

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

      // Note: Don't update label content here - wait for system update with fresh stamina data

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