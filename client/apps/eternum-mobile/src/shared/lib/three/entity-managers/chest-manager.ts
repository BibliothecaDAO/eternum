import { ActionPath, ChestSystemUpdate, Position } from "@bibliothecadao/eternum";
import { HexEntityInfo } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BuildingTileRenderer } from "../tiles/building-tile-renderer";
import { BuildingTileIndex } from "../tiles/tile-enums";
import { ChestLabelData, ChestLabelType } from "../utils/labels/label-factory";
import { HEX_SIZE } from "../utils/utils";
import { EntityManager } from "./entity-manager";
import { ChestObject } from "./types";

export class ChestManager extends EntityManager<ChestObject> {
  private labels: Map<number, CSS2DObject> = new Map();
  private labelAttachmentState: Map<number, boolean> = new Map();
  protected renderer: BuildingTileRenderer;

  // Chest tracking data
  private chestHexes: Map<number, Map<number, HexEntityInfo>> = new Map();

  constructor(scene: THREE.Scene) {
    super(scene);
    this.renderer = new BuildingTileRenderer(scene);
  }

  private createLabel(chest: ChestObject): void {
    const chestLabelData = this.convertChestToLabelData(chest);

    const labelDiv = ChestLabelType.createElement(chestLabelData);

    const label = new CSS2DObject(labelDiv);

    label.position.set(0, 2.1, -HEX_SIZE * 1.225);

    label.userData.entityId = chest.id;

    this.labels.set(chest.id, label);

    const shouldBeVisible = this.isHexVisible(chest.col, chest.row);
    if (shouldBeVisible) {
      this.renderer.addObjectToTileGroup(chest.col, chest.row, label);
      this.labelAttachmentState.set(chest.id, true);
    } else {
      this.labelAttachmentState.set(chest.id, false);
    }
  }

  private removeLabel(chestId: number): void {
    const label = this.labels.get(chestId);
    const chest = this.objects.get(chestId);
    if (label && chest) {
      const isAttached = this.labelAttachmentState.get(chestId) ?? false;
      if (isAttached) {
        this.renderer.removeObjectFromTileGroup(chest.col, chest.row, label);
      }
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
      this.labels.delete(chestId);
      this.labelAttachmentState.delete(chestId);
    }
  }

  private convertChestToLabelData(chest: ChestObject): ChestLabelData {
    return {
      entityId: chest.id,
      hexCoords: new Position({ x: chest.col, y: chest.row }),
    };
  }

  private isHexVisible(col: number, row: number): boolean {
    if (!this.visibleBounds) return true;
    return (
      col >= this.visibleBounds.minCol &&
      col <= this.visibleBounds.maxCol &&
      row >= this.visibleBounds.minRow &&
      row <= this.visibleBounds.maxRow
    );
  }

  public addObject(object: ChestObject): void {
    if (this.objects.has(object.id)) {
      return;
    }

    this.objects.set(object.id, object);
    this.createLabel(object);
    this.renderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true, true);
  }

  public updateObject(object: ChestObject): void {
    const existingChest = this.objects.get(object.id);

    if (existingChest && (existingChest.col !== object.col || existingChest.row !== object.row)) {
      if (this.isObjectMoving(object.id)) {
        return;
      }

      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      this.objects.set(object.id, object);
      this.renderer.addTileByIndex(object.col, object.row, BuildingTileIndex.Chest, true, true);
    }
  }

  public removeObject(objectId: number): void {
    const chest = this.objects.get(objectId);
    if (chest) {
      this.renderer.removeTile(chest.col, chest.row);
    }
    this.removeLabel(objectId);
    this.objects.delete(objectId);
  }

  public updateObjectPosition(objectId: number, col: number, row: number): void {
    const oldChest = this.objects.get(objectId);
    if (oldChest) {
      this.renderer.removeTile(oldChest.col, oldChest.row);

      const label = this.labels.get(objectId);
      if (label) {
        const wasAttached = this.labelAttachmentState.get(objectId) ?? false;
        if (wasAttached) {
          this.renderer.removeObjectFromTileGroup(oldChest.col, oldChest.row, label);
        }
      }

      const updatedChest = { ...oldChest, col, row };
      this.objects.set(objectId, updatedChest);

      this.renderer.addTileByIndex(col, row, BuildingTileIndex.Chest, true, true);

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

  public async moveObject(
    objectId: number,
    targetCol: number,
    targetRow: number,
    duration: number = 1000,
  ): Promise<void> {
    void duration;
    const chest = this.objects.get(objectId);
    if (!chest) return;

    const oldCol = chest.col;
    const oldRow = chest.row;

    this.renderer.removeTile(oldCol, oldRow);

    const updatedChest = { ...chest, col: targetCol, row: targetRow };
    this.objects.set(objectId, updatedChest);

    this.renderer.addTileByIndex(targetCol, targetRow, BuildingTileIndex.Chest, true, true);

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
  }

  public async moveObjectAlongPath(
    objectId: number,
    path: Array<{ col: number; row: number }>,
    stepDuration: number = 300,
  ): Promise<void> {
    if (path.length === 0) return;

    const finalPosition = path[path.length - 1];
    await this.moveObject(objectId, finalPosition.col, finalPosition.row, stepDuration * path.length);
  }

  public isObjectMoving(objectId: number): boolean {
    void objectId;
    return false;
  }

  public getObject(objectId: number): ChestObject | undefined {
    return this.objects.get(objectId);
  }

  public getObjectsAtHex(col: number, row: number): ChestObject[] {
    return Array.from(this.objects.values()).filter((chest) => chest.col === col && chest.row === row);
  }

  public selectObject(objectId: number): void {
    this.selectedObjectId = objectId;
  }

  public deselectObject(): void {
    this.selectedObjectId = null;
  }

  public getSelectedObjectId(): number | null {
    return this.selectedObjectId;
  }

  public getAllObjects(): ChestObject[] {
    return Array.from(this.objects.values());
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.renderer.setVisibleBounds(bounds);
    this.updateLabelVisibility();
  }

  private updateLabelVisibility(): void {
    this.labels.forEach((label, chestId) => {
      const chest = this.objects.get(chestId);
      if (chest) {
        const shouldBeVisible = this.isHexVisible(chest.col, chest.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(chestId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.renderer.addObjectToTileGroup(chest.col, chest.row, label);
          this.labelAttachmentState.set(chestId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.renderer.removeObjectFromTileGroup(chest.col, chest.row, label);
          this.labelAttachmentState.set(chestId, false);
        }
      }
    });
  }

  // Chest-specific methods moved from HexagonMap
  public handleSystemUpdate(update: ChestSystemUpdate): void {
    const {
      hexCoords: { col, row },
      occupierId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    if (!this.chestHexes.has(normalized.x)) {
      this.chestHexes.set(normalized.x, new Map());
    }
    this.chestHexes.get(normalized.x)?.set(normalized.y, { id: occupierId, owner: 0n });

    const chest: ChestObject = {
      id: occupierId,
      col: normalized.x,
      row: normalized.y,
      owner: 0n,
      type: "chest",
    };
    this.addObject(chest);
  }

  public deleteChest(entityId: number): void {
    this.chestHexes.forEach((rowMap, col) => {
      rowMap.forEach((chestInfo, row) => {
        if (chestInfo.id === entityId) {
          rowMap.delete(row);
          if (rowMap.size === 0) {
            this.chestHexes.delete(col);
          }
        }
      });
    });

    this.removeObject(entityId);
  }

  public getChestHexes(): Map<number, Map<number, HexEntityInfo>> {
    return this.chestHexes;
  }

  public clearChestData(): void {
    this.chestHexes.clear();
  }

  public handleChestAction(explorerEntityId: number, actionPath: ActionPath[], store: any): void {
    const targetHex = actionPath[actionPath.length - 1].hex;
    store.openChestDrawer(explorerEntityId, { x: targetHex.col, y: targetHex.row });
  }

  public dispose(): void {
    this.labels.forEach((label) => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();
    this.labelAttachmentState.clear();
    this.clearChestData();

    this.objects.clear();
    this.renderer.dispose();
    this.selectedObjectId = null;
    this.visibleBounds = null;
  }
}
