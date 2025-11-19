import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  configManager,
  ExplorerTroopsSystemUpdate,
  ExplorerTroopsTileSystemUpdate,
  getBlockTimestamp,
  getFeltCenterOffset,
  Position,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { DojoResult } from "@bibliothecadao/react";
import { HexEntityInfo, RelicEffect, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { UnitTilePosition, UnitTileRenderer } from "../tiles/unit-tile-renderer";
import { ArmyLabelData, ArmyLabelType } from "../utils/labels/label-factory";
import { findShortestPath } from "../utils/pathfinding";
import { getWorldPositionForHex, HEX_SIZE, loggedInAccount } from "../utils/utils";
import { EntityManager } from "./entity-manager";
import { ArmyObject } from "./types";

export class ArmyManager extends EntityManager<ArmyObject> {
  private labels: Map<number, CSS2DObject> = new Map();
  private movingObjects: Set<number> = new Set();
  private labelAttachmentState: Map<number, boolean> = new Map();

  // Relic effects storage - holds active relic effects for each army
  private armyRelicEffects: Map<
    number,
    Array<{ relicNumber: number; effect: RelicEffect; fx?: { end: () => void; instance?: any } }>
  > = new Map();

  protected renderer: UnitTileRenderer;

  // Army tracking data
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  private armiesPositions: Map<number, { col: number; row: number }> = new Map();
  private pendingArmyMovements: Set<number> = new Set();
  private exploredTiles: Map<number, Map<number, any>> = new Map();

  // Dependencies
  private dojo: DojoResult | null = null;
  private fxManager: any = null;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.renderer = new UnitTileRenderer(scene);
  }

  public setDependencies(dojo: DojoResult, fxManager: any, exploredTiles: Map<number, Map<number, any>>): void {
    this.dojo = dojo;
    this.fxManager = fxManager;
    this.exploredTiles = exploredTiles;
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
      // If currently moving, update the object data but don't start another movement animation
      if (this.movingObjects.has(object.id)) {
        // Update the object data to keep it in sync, but don't trigger visual movement
        this.objects.set(object.id, object);
        this.updateLabelContent(object);
        return;
      }

      // Start movement animation from current position to new position
      this.moveObject(object.id, object.col, object.row, 1000);
    } else {
      // Just update properties without position change
      this.objects.set(object.id, object);
      this.updateLabelContent(object);
      this.syncUnitTile(object);

      // Update army position tracking only if position changed
      const oldPosition = this.armiesPositions.get(object.id);
      const newPosition = { col: object.col, row: object.row };

      if (!oldPosition || oldPosition.col !== newPosition.col || oldPosition.row !== newPosition.row) {
        this.armiesPositions.set(object.id, newPosition);
      }
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
      this.renderer.removeTile(army.col, army.row);
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
      this.renderer.addObjectToTileGroup(army.col, army.row, label);
      this.labelAttachmentState.set(army.id, true);
    } else {
      this.labelAttachmentState.set(army.id, false);
    }
  }

  private syncUnitTile(army: ArmyObject): void {
    this.renderer.addTile(army.col, army.row, army.troopType, army.troopTier, false, true);
  }

  private removeLabel(armyId: number): void {
    const label = this.labels.get(armyId);
    const army = this.objects.get(armyId);
    if (label && army) {
      const isAttached = this.labelAttachmentState.get(armyId) ?? false;
      if (isAttached) {
        this.renderer.removeObjectFromTileGroup(army.col, army.row, label);
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

    // Get relic effects count for display
    const relicEffects = this.armyRelicEffects.get(army.id) || [];
    const activeRelicCount = relicEffects.length;

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
      // Add relic effects info if any are active
      ...(activeRelicCount > 0 && { relicEffectsCount: activeRelicCount }),
    };
  }

  public setVisibleBounds(bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }): void {
    this.visibleBounds = bounds;
    this.renderer.setVisibleBounds(bounds);
    this.updateLabelVisibility();
  }

  public getUnitTileRenderer(): UnitTileRenderer {
    return this.renderer;
  }

  private updateLabelVisibility(): void {
    this.labels.forEach((label, armyId) => {
      const army = this.objects.get(armyId);
      if (army) {
        const shouldBeVisible = this.isHexVisible(army.col, army.row);
        const isCurrentlyAttached = this.labelAttachmentState.get(armyId) ?? false;

        if (shouldBeVisible && !isCurrentlyAttached) {
          this.renderer.addObjectToTileGroup(army.col, army.row, label);
          this.labelAttachmentState.set(armyId, true);
        } else if (!shouldBeVisible && isCurrentlyAttached) {
          this.renderer.removeObjectFromTileGroup(army.col, army.row, label);
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

    this.renderer.updateTilesForHexes(unitTilePositions);
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
      this.renderer.removeTile(oldArmy.col, oldArmy.row);

      const label = this.labels.get(objectId);
      if (label) {
        const wasAttached = this.labelAttachmentState.get(objectId) ?? false;
        if (wasAttached) {
          this.renderer.removeObjectFromTileGroup(oldArmy.col, oldArmy.row, label);
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
          this.renderer.addObjectToTileGroup(col, row, label);
          this.labelAttachmentState.set(objectId, true);
        } else {
          this.labelAttachmentState.set(objectId, false);
        }
      }

      // Update army position tracking
      this.armiesPositions.set(objectId, { col, row });
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
      this.renderer.selectTile(army.col, army.row);
    }
  }

  public deselectObject(): void {
    this.renderer.deselectTile();
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

    return this.renderer.moveTile(startCol, startRow, targetCol, targetRow, duration).then(() => {
      // Update army position after movement completes
      army.col = targetCol;
      army.row = targetRow;

      // Update army position tracking
      this.armiesPositions.set(objectId, { col: targetCol, row: targetRow });

      // Note: Don't update label content here - wait for system update with fresh stamina data

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

    return this.renderer.moveTileAlongPath(startCol, startRow, path, stepDuration).then(() => {
      // Update army position after movement completes
      army.col = finalHex.col;
      army.row = finalHex.row;

      // Update army position tracking
      this.armiesPositions.set(objectId, { col: finalHex.col, row: finalHex.row });

      // Note: Don't update label content here - wait for system update with fresh stamina data

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

      // Mark as no longer moving
      this.movingObjects.delete(objectId);
    });
  }

  public isObjectMoving(objectId: number): boolean {
    return this.movingObjects.has(objectId);
  }

  /**
   * Update army relic effects (for compatibility with desktop version)
   */
  public async updateRelicEffects(
    entityId: number,
    newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>,
  ) {
    const army = this.objects.get(entityId);
    if (!army) {
      console.warn(`Army ${entityId} not found for relic effects update`);
      return;
    }

    const currentEffects = this.armyRelicEffects.get(entityId) || [];
    const currentRelicNumbers = new Set(currentEffects.map((e) => e.relicNumber));
    const newRelicNumbers = new Set(newRelicEffects.map((e) => e.relicNumber));

    // Remove effects that are no longer in the new list
    for (const currentEffect of currentEffects) {
      if (!newRelicNumbers.has(currentEffect.relicNumber)) {
        if (currentEffect.fx) {
          currentEffect.fx.end();
        }
      }
    }

    // Add new effects that weren't previously active
    const effectsToAdd: Array<{ relicNumber: number; effect: RelicEffect; fx?: { end: () => void; instance?: any } }> =
      [];
    for (const newEffect of newRelicEffects) {
      if (!currentRelicNumbers.has(newEffect.relicNumber)) {
        // For mobile, we don't create visual FX here - that's handled by the HexagonMap
        // We just store the effect data for label updates and validation
        effectsToAdd.push({
          relicNumber: newEffect.relicNumber,
          effect: newEffect.effect,
        });
      }
    }

    // Update the stored effects
    if (newRelicEffects.length === 0) {
      this.armyRelicEffects.delete(entityId);
    } else {
      // Keep existing effects that are still in the new list, add new ones
      const updatedEffects = currentEffects.filter((e) => newRelicNumbers.has(e.relicNumber)).concat(effectsToAdd);
      this.armyRelicEffects.set(entityId, updatedEffects);
    }

    // Update the army label to show relic effects count
    this.updateLabelContent(army);
  }

  /**
   * Get army relic effects for external access
   */
  public getArmyRelicEffects(entityId: number): { relicId: number; effect: RelicEffect }[] {
    const effects = this.armyRelicEffects.get(entityId);
    return effects ? effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })) : [];
  }

  // Army-specific methods moved from HexagonMap
  public async handleSystemUpdate(update: ExplorerTroopsTileSystemUpdate): Promise<void> {
    const {
      hexCoords: { col, row },
      ownerAddress,
      ownerName,
      guildName,
      entityId,
      troopType,
      troopTier,
      isDaydreamsAgent,
      troopCount,
      currentStamina,
      maxStamina,
      onChainStamina,
    } = update;

    if (ownerAddress === undefined) return;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    this.armiesPositions.set(entityId, newPos);

    const existingArmy = this.getObject(entityId);
    const isNewArmy = !existingArmy;

    if (isNewArmy) {
      let finalMaxStamina = maxStamina || 0;
      if (!finalMaxStamina && troopType && troopTier) {
        try {
          finalMaxStamina = Number(configManager.getTroopStaminaConfig(troopType, troopTier));
        } catch (error) {
          console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
        }
      }

      const army: ArmyObject = {
        id: entityId,
        col: newPos.col,
        row: newPos.row,
        owner: ownerAddress,
        type: "army",
        troopType,
        troopTier,
        ownerName,
        guildName,
        isDaydreamsAgent,
        isAlly: false,
        troopCount: troopCount || 0,
        currentStamina: currentStamina || 0,
        maxStamina: finalMaxStamina,
        onChainStamina: onChainStamina,
      };

      this.addObject(army);
      this.updateArmyHexTracking(entityId, newPos, newPos);
    } else {
      const hasMoved = oldPos && (oldPos.col !== newPos.col || oldPos.row !== newPos.row);

      if (hasMoved) {
        let finalMaxStamina = maxStamina || existingArmy.maxStamina || 0;
        if (!finalMaxStamina && troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;
            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            finalMaxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
          }
        }

        const updatedArmy: ArmyObject = {
          ...existingArmy,
          owner: ownerAddress,
          troopType,
          troopTier,
          ownerName,
          guildName,
          isDaydreamsAgent,
          isAlly: false,
          troopCount: troopCount ?? existingArmy.troopCount ?? 0,
          currentStamina: existingArmy.currentStamina ?? 0,
          maxStamina: existingArmy.maxStamina ?? 0,
          onChainStamina: existingArmy.onChainStamina,
        };
        this.updateObject(updatedArmy);
        this.startSmoothArmyMovement(entityId, oldPos, newPos);
      } else {
        this.updateArmyHexTracking(entityId, newPos, newPos);

        let finalMaxStamina = maxStamina || existingArmy.maxStamina || 0;
        if (!finalMaxStamina && troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;
            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            finalMaxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            console.warn(`Failed to get max stamina config for ${troopType} ${troopTier}:`, error);
          }
        }

        const updatedArmy: ArmyObject = {
          ...existingArmy,
          col: newPos.col,
          row: newPos.row,
          owner: ownerAddress,
          troopType,
          troopTier,
          ownerName,
          guildName,
          isDaydreamsAgent,
          isAlly: false,
          troopCount: troopCount ?? existingArmy.troopCount ?? 0,
          currentStamina: existingArmy.currentStamina ?? 0,
          maxStamina: existingArmy.maxStamina ?? 0,
          onChainStamina: existingArmy.onChainStamina,
        };

        this.updateObject(updatedArmy);
      }
    }

    this.pendingArmyMovements.delete(entityId);
  }

  public handleExplorerTroopsUpdate(update: ExplorerTroopsSystemUpdate): void {
    const armyObject = this.getObject(update.entityId);

    if (!armyObject) {
      // console.log(
      //   `[ArmyManager] Army ${update.entityId} not found in renderer - update will be applied when army loads`,
      // );
      return;
    }

    const { currentArmiesTick } = getBlockTimestamp();
    let currentStamina = armyObject.currentStamina || 0;
    let maxStamina = armyObject.maxStamina || 0;

    if (armyObject.troopType && armyObject.troopTier) {
      try {
        const staminaResult = StaminaManager.getStamina(
          {
            category: armyObject.troopType,
            tier: armyObject.troopTier,
            count: BigInt(update.troopCount),
            stamina: {
              amount: BigInt(update.onChainStamina.amount),
              updated_tick: BigInt(update.onChainStamina.updatedTick),
            },
            boosts: {
              incr_stamina_regen_percent_num: 0,
              incr_stamina_regen_tick_count: 0,
              incr_explore_reward_percent_num: 0,
              incr_explore_reward_end_tick: 0,
              incr_damage_dealt_percent_num: 0,
              incr_damage_dealt_end_tick: 0,
              decr_damage_gotten_percent_num: 0,
              decr_damage_gotten_end_tick: 0,
            },
            battle_cooldown_end: 0,
          },
          currentArmiesTick,
        );

        currentStamina = Number(staminaResult.amount);

        let troopType = armyObject.troopType;
        let troopTier = armyObject.troopTier;

        if (troopType && troopTier) {
          try {
            const troopTypeEnum =
              typeof troopType === "string" ? TroopType[troopType as keyof typeof TroopType] : troopType;
            const troopTierEnum =
              typeof troopTier === "string" ? TroopTier[troopTier as keyof typeof TroopTier] : troopTier;

            const staminaConfig = configManager.getTroopStaminaConfig(troopTypeEnum, troopTierEnum);
            maxStamina = Number(staminaConfig.staminaMax);
          } catch (error) {
            // console.warn(`[ArmyManager] Failed to calculate maxStamina for ${troopType} ${troopTier}:`, error);
            maxStamina = armyObject.maxStamina || 0;
          }
        } else {
          // console.warn(`[ArmyManager] Missing troopType or troopTier for army ${update.entityId}:`, {
          //   armyObjectTroopType: armyObject.troopType,
          //   armyObjectTroopTier: armyObject.troopTier,
          // });
          maxStamina = armyObject.maxStamina || 0;
        }
      } catch (error) {
        console.warn(`Failed to calculate stamina for army ${update.entityId}:`, error);
      }
    }

    const updatedArmy = {
      ...armyObject,
      troopCount: update.troopCount,
      currentStamina,
      maxStamina,
      ownerName: update.ownerName,
      owner: update.ownerAddress,
      onChainStamina: update.onChainStamina,
    };

    this.updateObject(updatedArmy);

    const position = this.armiesPositions.get(update.entityId);
    if (position) {
      this.updateArmyHexTracking(update.entityId, position, position);
    }
  }

  public async handleArmyMovement(armyId: number, actionPath: ActionPath[]): Promise<void> {
    if (!this.dojo || !this.fxManager) {
      console.error("Dependencies not set for army movement");
      return;
    }

    const army = this.getObject(armyId);
    if (!army || actionPath.length < 2) return;

    const FELT_CENTER = getFeltCenterOffset();
    const targetHex = actionPath[actionPath.length - 1].hex;
    const targetCol = targetHex.col - FELT_CENTER;
    const targetRow = targetHex.row - FELT_CENTER;

    getWorldPositionForHex({ col: targetCol, row: targetRow }, true, this.tempVector3);
    const targetWorldPos = this.tempVector3.clone();

    const actionType = ActionPaths.getActionType(actionPath);
    const isExplored = actionType === ActionType.Move;

    const effectType = isExplored ? "travel" : "compass";
    const effectLabel = isExplored ? "Traveling" : "Exploring";

    const effect = this.fxManager.playFxAtCoords(
      effectType,
      targetWorldPos.x,
      targetWorldPos.y + 1,
      targetWorldPos.z - 1,
      2,
      effectLabel,
      true,
    );

    this.pendingArmyMovements.add(armyId);

    const account = this.dojo.account.account;
    if (!account) {
      console.error("No account available for army movement");
      effect.end();
      this.pendingArmyMovements.delete(armyId);
      return;
    }

    try {
      const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);
      const { currentArmiesTick } = getBlockTimestamp();
      await armyActionManager.moveArmy(account, actionPath, isExplored, currentArmiesTick);
      effect.end();
      console.log(
        `Army ${armyId} ${isExplored ? "moved" : "explored"} from (${army.col}, ${army.row}) to (${targetCol}, ${targetRow})`,
      );
    } catch (error) {
      console.error("Army movement failed:", error);
      effect.end();
      this.pendingArmyMovements.delete(armyId);
      throw error;
    }
  }

  private startSmoothArmyMovement(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    this.updateArmyHexTracking(entityId, oldPos, newPos);

    const oldPosition = new Position({ x: oldPos.col, y: oldPos.row });
    const newPosition = new Position({ x: newPos.col, y: newPos.row });

    const maxDistance = 50;

    const path = findShortestPath(
      oldPosition,
      newPosition,
      this.exploredTiles,
      new Map(), // structureHexes - will be passed from parent
      this.armyHexes,
      maxDistance,
    );

    if (path && path.length > 0) {
      const movementPath = path.map((pos) => {
        const normalized = pos.getNormalized();
        return { col: normalized.x, row: normalized.y };
      });

      this.moveObjectAlongPath(entityId, movementPath, 300);
    } else {
      this.updateObjectPosition(entityId, newPos.col, newPos.row);
    }
  }

  private updateArmyHexTracking(
    entityId: number,
    oldPos: { col: number; row: number },
    newPos: { col: number; row: number },
  ) {
    if (oldPos !== newPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
    }

    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }

    const army = this.getObject(entityId);
    if (army) {
      this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: army.owner || 0n });
    }
  }

  public getArmyHexes(): Map<number, Map<number, HexEntityInfo>> {
    return this.armyHexes;
  }

  public getArmyPosition(entityId: number): { col: number; row: number } | undefined {
    return this.armiesPositions.get(entityId);
  }

  public isPendingMovement(armyId: number): boolean {
    return this.pendingArmyMovements.has(armyId);
  }

  public isArmySelectable(armyId: number): boolean {
    return !this.pendingArmyMovements.has(armyId) && !this.isObjectMoving(armyId);
  }

  public selectArmy(
    armyId: number,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    questHexes: Map<number, Map<number, HexEntityInfo>>,
    chestHexes: Map<number, Map<number, HexEntityInfo>>,
  ): ActionPaths | null {
    if (!this.dojo) {
      console.error("Dependencies not set for army selection");
      return null;
    }

    if (this.pendingArmyMovements.has(armyId)) {
      return null;
    }

    if (this.isObjectMoving(armyId)) {
      // console.log(`[ArmyManager] Cannot select army ${armyId} - it is currently moving`);
      return null;
    }

    const army = this.getObject(armyId);
    if (!army) return null;

    this.selectObject(armyId);

    const armyActionManager = new ArmyActionManager(this.dojo.setup.components, this.dojo.setup.systemCalls, armyId);
    const playerAddress = loggedInAccount();
    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      structureHexes,
      this.armyHexes,
      this.exploredTiles,
      questHexes,
      chestHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    return actionPaths;
  }

  public deleteArmy(entityId: number, clearRelicEffectsCallback?: (entityId: number) => void): void {
    // Clear any relic effects for this army if callback provided
    if (clearRelicEffectsCallback) {
      clearRelicEffectsCallback(entityId);
    }

    // Clear relic effects stored in this manager
    this.updateRelicEffects(entityId, []);

    this.removeObject(entityId);
  }

  public clearArmyData(): void {
    this.armyHexes.clear();
    this.armiesPositions.clear();
    this.pendingArmyMovements.clear();
  }

  public handleHexClick(
    armyId: number,
    col: number,
    row: number,
    store: any,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    questHexes: Map<number, Map<number, HexEntityInfo>>,
    chestHexes: Map<number, Map<number, HexEntityInfo>>,
  ): { shouldSelect: boolean; actionPaths?: ActionPaths } {
    const isDoubleClick = store.handleObjectClick(armyId, "army", col, row);

    if (isDoubleClick) {
      return { shouldSelect: false };
    }

    const actionPaths = this.selectArmy(armyId, structureHexes, questHexes, chestHexes);
    return { shouldSelect: true, actionPaths: actionPaths || undefined };
  }

  public dispose(): void {
    // Clean up relic effects
    for (const [entityId] of this.armyRelicEffects) {
      this.updateRelicEffects(entityId, []);
    }
    this.armyRelicEffects.clear();

    this.labels.forEach((label) => {
      if (label.element && label.element.parentNode) {
        label.element.parentNode.removeChild(label.element);
      }
    });
    this.labels.clear();
    this.movingObjects.clear();
    this.labelAttachmentState.clear();
    this.clearArmyData();

    this.renderer.dispose();
  }
}
