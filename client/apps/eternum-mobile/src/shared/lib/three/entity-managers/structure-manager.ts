import { ActionPaths, Position, StructureActionManager, StructureTileSystemUpdate } from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import { HexEntityInfo, ID, StructureType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex, getBuildingTileIndex } from "../tiles/tile-enums";
import { StructureLabelData, StructureLabelType } from "../utils/labels/label-factory";
import { HEX_SIZE, loggedInAccount } from "../utils/utils";
import { EntityManager } from "./entity-manager";
import { StructureObject } from "./types";

export class StructureManager extends EntityManager<StructureObject> {
  private labels: Map<number, CSS2DObject> = new Map();
  private labelAttachmentState: Map<number, boolean> = new Map();
  protected renderer: BuildingTileRenderer;

  // Structure tracking data
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private exploredTiles: Map<number, Map<number, any>> = new Map();

  // Dependencies
  private dojo: DojoResult | null = null;
  private biomeRefreshCallback?: () => void;

  constructor(scene: THREE.Scene, biomeRefreshCallback?: () => void) {
    super(scene);
    this.renderer = new BuildingTileRenderer(scene);
    this.biomeRefreshCallback = biomeRefreshCallback;
  }

  public setDependencies(dojo: DojoResult, exploredTiles: Map<number, Map<number, any>>): void {
    this.dojo = dojo;
    this.exploredTiles = exploredTiles;
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
      this.renderer.removeTile(structure.col, structure.row);
    }
    this.removeLabel(objectId);
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldStructure = this.objects.get(objectId);
    if (oldStructure) {
      this.renderer.removeTile(oldStructure.col, oldStructure.row);

      const label = this.labels.get(objectId);
      if (label) {
        const wasAttached = this.labelAttachmentState.get(objectId) ?? false;
        if (wasAttached) {
          this.renderer.removeObjectFromTileGroup(oldStructure.col, oldStructure.row, label);
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
          this.renderer.addObjectToTileGroup(col, row, label);
          this.labelAttachmentState.set(objectId, true);
        } else {
          this.labelAttachmentState.set(objectId, false);
        }
      }
    }
  }

  private syncBuildingTile(structure: StructureObject): void {
    const tileIndex = this.getTileIndexFromStructure(structure);
    this.renderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
  }

  private getTileIndexFromStructure(structure: StructureObject): BuildingTileIndex {
    const structureType = structure.structureType ? (parseInt(structure.structureType) as StructureType) : undefined;
    const buildingType = structure.buildingType;
    const level = structure.level;

    return getBuildingTileIndex(structureType, buildingType, level);
  }

  public getBuildingTileRenderer(): BuildingTileRenderer {
    return this.renderer;
  }

  public updateAllBuildingTiles(): void {
    this.renderer.clearTiles();

    Array.from(this.objects.values()).forEach((structure) => {
      const tileIndex = this.getTileIndexFromStructure(structure);
      this.renderer.addTileByIndex(structure.col, structure.row, tileIndex, true);
    });
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
    const structure = this.objects.get(objectId);

    if (structure) {
      this.renderer.selectTile(structure.col, structure.row);
    }
  }

  public deselectObject(): void {
    this.renderer.deselectTile();
    this.selectedObjectId = null;
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.renderer.setVisibleBounds(bounds);
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

    return this.renderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update structure position after movement completes
      structure.col = targetCol;
      structure.row = targetRow;

      // Update label attachment for new position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(targetCol, targetRow);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.renderer.addObjectToTileGroup(targetCol, targetRow, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.renderer.removeObjectFromTileGroup(targetCol, targetRow, label);
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

    return this.renderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update structure position after movement completes
      structure.col = finalHex.col;
      structure.row = finalHex.row;

      // Update label attachment for final position
      const label = this.labels.get(objectId);
      if (label) {
        const shouldBeVisible = this.isHexVisible(finalHex.col, finalHex.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(objectId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.renderer.addObjectToTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.renderer.removeObjectFromTileGroup(finalHex.col, finalHex.row, label);
          this.labelAttachmentState.set(objectId, false);
        }
      }
    });
  }

  public isObjectMoving(objectId: number): boolean {
    const structure = this.objects.get(objectId);
    if (!structure) return false;
    return this.renderer.isTileMoving(structure.col, structure.row);
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
      this.renderer.addObjectToTileGroup(structure.col, structure.row, label);
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
        this.renderer.removeObjectFromTileGroup(structure.col, structure.row, label);
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
          this.renderer.addObjectToTileGroup(structure.col, structure.row, label);
          this.labelAttachmentState.set(structureId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.renderer.removeObjectFromTileGroup(structure.col, structure.row, label);
          this.labelAttachmentState.set(structureId, false);
        }
      }
    });
  }

  // Structure-specific methods moved from HexagonMap
  public handleSystemUpdate(update: StructureTileSystemUpdate): void {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
      structureType,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    if (!this.structureHexes.has(normalized.x)) {
      this.structureHexes.set(normalized.x, new Map());
    }
    this.structureHexes.get(normalized.x)?.set(normalized.y, { id: entityId, owner: address || 0n });

    const structure: StructureObject = {
      id: entityId,
      col: normalized.x,
      row: normalized.y,
      owner: address || 0n,
      type: "structure",
      structureType: structureType.toString(),
      ownerName: update.owner.ownerName,
      guildName: update.owner.guildName,
      guardArmies: update.guardArmies,
      activeProductions: update.activeProductions,
      hyperstructureRealmCount: update.hyperstructureRealmCount,
      stage: update.stage,
      initialized: update.initialized,
      level: update.level,
      hasWonder: update.hasWonder,
    };
    this.updateObject(structure);
    
    // Refresh biome tiles to hide any biomes at the structure position
    if (this.biomeRefreshCallback) {
      this.biomeRefreshCallback();
    }
  }

  public handleStructureUpdate(update: {
    entityId: ID;
    guardArmies: any[];
    owner: { address: bigint; ownerName: string; guildName: string };
  }): void {
    const existingStructure = this.getObject(update.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        guardArmies: update.guardArmies,
        ownerName: update.owner.ownerName,
        guildName: update.owner.guildName,
      };
      this.updateObject(updatedStructure);
    }
  }

  public handleBuildingUpdate(update: {
    entityId: ID;
    activeProductions: Array<{ buildingCount: number; buildingType: any }>;
  }): void {
    const existingStructure = this.getObject(update.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        activeProductions: update.activeProductions,
      };
      this.updateObject(updatedStructure);
    }
  }

  public handleContributionUpdate(value: { entityId: ID; structureType: any; stage: any }): void {
    const existingStructure = this.getObject(value.entityId);
    if (existingStructure) {
      const updatedStructure = {
        ...existingStructure,
        stage: value.stage,
        hyperstructureRealmCount: value.stage,
      };
      this.updateObject(updatedStructure);
    }
  }

  public selectStructure(
    structureId: number,
    _col: number,
    _row: number,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
  ): ActionPaths | null {
    if (!this.dojo) {
      console.error("Dependencies not set for structure selection");
      return null;
    }

    this.selectObject(structureId);

    const structureActionManager = new StructureActionManager(this.dojo.setup.components, structureId);
    const playerAddress = loggedInAccount();

    const actionPaths = structureActionManager.findActionPaths(armyHexes, this.exploredTiles, playerAddress);
    return actionPaths;
  }

  public handleHexClick(
    structureId: number,
    col: number,
    row: number,
    store: any,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
  ): { shouldSelect: boolean; actionPaths?: ActionPaths } {
    const isDoubleClick = store.handleObjectClick(structureId, "structure", col, row);

    if (isDoubleClick) {
      return { shouldSelect: false };
    }

    const actionPaths = this.selectStructure(structureId, col, row, armyHexes);
    return { shouldSelect: true, actionPaths: actionPaths || undefined };
  }

  public getStructureHexes(): Map<number, Map<number, HexEntityInfo>> {
    return this.structureHexes;
  }

  public clearStructureData(): void {
    this.structureHexes.clear();
  }

  public dispose(): void {
    this.labels.forEach((label) => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();
    this.labelAttachmentState.clear();
    this.clearStructureData();

    this.renderer.dispose();
  }
}
