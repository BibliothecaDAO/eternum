import { Position } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex, getBuildingTileIndex } from "../tiles/tile-enums";
import { StructureLabelData, StructureLabelType } from "../utils/labels/label-factory";
import { HEX_SIZE, loggedInAccount } from "../utils/utils";
import { ObjectRenderer } from "./base-object-renderer";
import { StructureObject } from "./types";

export class StructureRenderer extends ObjectRenderer<StructureObject> {
  private buildingTileRenderer: BuildingTileRenderer;
  private labels: Map<number, CSS2DObject> = new Map();
  private labelAttachmentState: Map<number, boolean> = new Map();

  constructor(scene: THREE.Scene) {
    super(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
  }

  public addObject(object: StructureObject): void {
    this.objects.set(object.id, object);
    this.createLabel(object);
    this.syncBuildingTile(object);
  }

  public updateObject(object: StructureObject): void {
    const existingStructure = this.objects.get(object.id);

    // If structure doesn't exist, treat as new object
    if (!existingStructure) {
      this.addObject(object);
      return;
    }

    // Check if the structure has moved to a new position (unlikely but consistent API)
    if (existingStructure.col !== object.col || existingStructure.row !== object.row) {
      // If currently moving, don't start another movement
      if (this.isObjectMoving(object.id)) {
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.updateLabelContent(object);
      this.syncBuildingTile(object);
    }
  }

  public removeObject(objectId: number): void {
    const structure = this.objects.get(objectId);
    if (structure) {
      this.buildingTileRenderer.removeTile(structure.col, structure.row);
    }
    this.removeLabel(objectId);
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldStructure = this.objects.get(objectId);
    if (oldStructure) {
      this.buildingTileRenderer.removeTile(oldStructure.col, oldStructure.row);

      const label = this.labels.get(objectId);
      if (label) {
        const wasAttached = this.labelAttachmentState.get(objectId) ?? false;
        if (wasAttached) {
          this.buildingTileRenderer.removeObjectFromTileGroup(oldStructure.col, oldStructure.row, label);
        }
      }
    }

    const structure = this.objects.get(objectId);
    if (structure) {
      structure.col = col;
      structure.row = row;
      this.syncBuildingTile(structure);

      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(col, row);
        if (shouldBeVisible) {
          this.buildingTileRenderer.addObjectToTileGroup(col, row, label);
          this.labelAttachmentState.set(objectId, true);
        } else {
          this.labelAttachmentState.set(objectId, false);
        }
      }
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
    this.updateLabelVisibility();
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

      // Update label attachment for new position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(targetCol, targetRow);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.buildingTileRenderer.addObjectToTileGroup(targetCol, targetRow, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.buildingTileRenderer.removeObjectFromTileGroup(targetCol, targetRow, label);
          this.labelAttachmentState.set(objectId, false);
        }
      }
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

      // Update label attachment for final position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(finalHex.col, finalHex.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.buildingTileRenderer.addObjectToTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.buildingTileRenderer.removeObjectFromTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, false);
        }
      }
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

  private createLabel(structure: StructureObject): void {
    const structureLabelData = this.convertStructureToLabelData(structure);

    const labelDiv = StructureLabelType.createElement(structureLabelData);

    // Create CSS2DObject
    const label = new CSS2DObject(labelDiv);

    // Position the label above the tile (relative to tile group position)
    label.position.set(0, 2.1, -HEX_SIZE * 2);

    // Store entityId in userData for identification
    label.userData.entityId = structure.id;

    this.labels.set(structure.id, label);

    // Set initial attachment state based on visibility bounds
    const shouldBeVisible = this.isHexVisible(structure.col, structure.row);
    if (shouldBeVisible) {
      this.buildingTileRenderer.addObjectToTileGroup(structure.col, structure.row, label);
      this.labelAttachmentState.set(structure.id, true);
    } else {
      this.labelAttachmentState.set(structure.id, false);
    }
  }

  private updateLabelContent(structure: StructureObject): void {
    const label = this.labels.get(structure.id);
    if (!label || !label.element) return;

    const structureLabelData = this.convertStructureToLabelData(structure);
    StructureLabelType.updateElement?.(label.element, structureLabelData);
  }

  private removeLabel(structureId: number): void {
    const label = this.labels.get(structureId);
    const structure = this.objects.get(structureId);
    if (label && structure) {
      const isAttached = this.labelAttachmentState.get(structureId) ?? false;
      if (isAttached) {
        this.buildingTileRenderer.removeObjectFromTileGroup(structure.col, structure.row, label);
      }
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.labels.delete(structureId);
      this.labelAttachmentState.delete(structureId);
    }
  }

  private convertStructureToLabelData(structure: StructureObject): StructureLabelData {
    const playerAddress = loggedInAccount();
    const isPlayerStructure = structure.owner && structure.owner.toString() === playerAddress?.toString();
    const structureType = structure.structureType
      ? (parseInt(structure.structureType) as StructureType)
      : StructureType.Realm;

    console.log(`[StructureRenderer] Converting structure ${structure.id} to label data:`, {
      structureType,
      hyperstructureRealmCount: structure.hyperstructureRealmCount,
      guardArmies: structure.guardArmies?.length || 0,
      activeProductions: structure.activeProductions?.length || 0,
      ownerName: structure.ownerName,
    });

    return {
      entityId: structure.id,
      hexCoords: new Position({ x: structure.col, y: structure.row }),
      structureType,
      stage: structure.stage || 1,
      initialized: structure.initialized ?? true,
      level: structure.level || 1,
      isMine: Boolean(isPlayerStructure),
      hasWonder: structure.hasWonder || false,
      owner: {
        address: structure.owner || 0n,
        ownerName: structure.ownerName || (isPlayerStructure ? "My Structure" : "Structure"),
        guildName: structure.guildName || "",
      },
      guardArmies: structure.guardArmies || [],
      activeProductions: structure.activeProductions || [],
      hyperstructureRealmCount: structure.hyperstructureRealmCount || 0,
    };
  }

  private updateLabelVisibility(): void {
    this.labels.forEach((label, structureId) => {
      const structure = this.objects.get(structureId);
      if (structure) {
        const shouldBeVisible = this.isHexVisible(structure.col, structure.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(structureId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.buildingTileRenderer.addObjectToTileGroup(structure.col, structure.row, label);
          this.labelAttachmentState.set(structureId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.buildingTileRenderer.removeObjectFromTileGroup(structure.col, structure.row, label);
          this.labelAttachmentState.set(structureId, false);
        }
      }
    });
  }

  public dispose(): void {
    this.labels.forEach((label) => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();
    this.labelAttachmentState.clear();

    this.buildingTileRenderer.dispose();
  }
}
