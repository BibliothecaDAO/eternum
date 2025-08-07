import { useAccountStore } from "@/hooks/store/use-account-store";
import { ArmyModel } from "@/three/managers/army-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { GUIManager, LABEL_STYLES } from "@/three/utils/";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { Position } from "@/types/position";
import { COLORS } from "@/ui/features";
import { getBlockTimestamp } from "@/utils/timestamp";
import { Biome, configManager, StaminaManager } from "@bibliothecadao/eternum";
import {
  BiomeType,
  ContractAddress,
  HexEntityInfo,
  ID,
  orders,
  RelicEffect,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { MAP_DATA_REFRESH_INTERVAL } from "../constants/map-data";
import { ArmyData, ArmySystemUpdate, RenderChunkSize } from "../types";
import { getWorldPositionForHex, hashCoordinates } from "../utils";
import { createArmyLabel, updateArmyLabel } from "../utils/labels/label-factory";
import { applyLabelTransitions } from "../utils/labels/label-transitions";
import { findShortestPath } from "../utils/pathfinding";
import { FXManager } from "./fx-manager";
import { MapDataStore } from "./map-data-store";

interface PendingLabelUpdate {
  troopCount: number;
  stamina: number;
  updatedTick: number;
  owner: { address: bigint; ownerName: string; guildName: string };
}

export class ArmyManager {
  private scene: THREE.Scene;
  private armyModel: ArmyModel;
  private armies: Map<ID, ArmyData> = new Map();
  private scale: THREE.Vector3;
  private currentChunkKey: string | null = "190,170";
  private renderChunkSize: RenderChunkSize;
  private visibleArmies: ArmyData[] = [];
  private armyPaths: Map<ID, Position[]> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelsGroup: THREE.Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private armyRelicEffects: Map<
    ID,
    Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void; instance?: any } }>
  > = new Map();
  private applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>;
  private clearPendingRelicEffectsCallback?: (entityId: ID) => void;
  private mapDataStore: MapDataStore;
  private onMapDataRefresh = this.handleMapDataRefresh.bind(this);
  private pendingLabelUpdates: Map<ID, PendingLabelUpdate> = new Map();

  constructor(
    scene: THREE.Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: THREE.Group,
    hexagonScene?: HexagonScene,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
  ) {
    this.scene = scene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.armyModel = new ArmyModel(scene, labelsGroup, this.currentCameraView);
    this.scale = new THREE.Vector3(0.3, 0.3, 0.3);
    this.renderChunkSize = renderChunkSize;
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
    this.labelsGroup = labelsGroup || new THREE.Group();
    this.hexagonScene = hexagonScene;
    this.fxManager = new FXManager(scene, 1);
    this.applyPendingRelicEffectsCallback = applyPendingRelicEffectsCallback;
    this.clearPendingRelicEffectsCallback = clearPendingRelicEffectsCallback;

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    const createArmyFolder = GUIManager.addFolder("Create Army");
    const createArmyParams = { entityId: 0, col: 0, row: 0, isMine: false };

    createArmyFolder.add(createArmyParams, "entityId").name("Entity ID");
    createArmyFolder.add(createArmyParams, "col").name("Column");
    createArmyFolder.add(createArmyParams, "row").name("Row");
    createArmyFolder.add(createArmyParams, "isMine", [true, false]).name("Is Mine");
    createArmyFolder
      .add(
        {
          addArmy: () => {
            this.addArmy(
              createArmyParams.entityId,
              new Position({ x: createArmyParams.col, y: createArmyParams.row }),
              {
                address: createArmyParams.isMine
                  ? ContractAddress(useAccountStore.getState().account?.address || "0")
                  : 0n,
                // TODO: Add owner name and guild name
                ownerName: "Neutral",
                guildName: "None",
              },
              1,
              TroopType.Paladin,
              TroopTier.T1,
              false,
              false,
              10,
              10,
              100,
            );
          },
        },
        "addArmy",
      )
      .name("Add army");
    createArmyFolder.close();

    const deleteArmyFolder = GUIManager.addFolder("Delete Army");
    const deleteArmyParams = { entityId: 0 };

    deleteArmyFolder.add(deleteArmyParams, "entityId").name("Entity ID");
    deleteArmyFolder
      .add(
        {
          deleteArmy: () => {
            this.removeArmy(deleteArmyParams.entityId);
          },
        },
        "deleteArmy",
      )
      .name("Delete army");
    deleteArmyFolder.close();

    // Initialize MapDataStore as instance property
    this.mapDataStore = MapDataStore.getInstance(MAP_DATA_REFRESH_INTERVAL);
    this.mapDataStore.onRefresh(this.onMapDataRefresh);

    useAccountStore.subscribe(() => {
      this.recheckOwnership();
    });
  }

  public onMouseMove(raycaster: THREE.Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length > 0) {
      const { instanceId, mesh } = intersectResults[0];
      if (instanceId !== undefined && mesh.userData.entityIdMap) {
        return mesh.userData.entityIdMap.get(instanceId);
      }
    }
    return undefined;
  }

  public onRightClick(raycaster: THREE.Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length === 0) return;

    const { instanceId, mesh } = intersectResults[0];
    if (instanceId === undefined || !mesh.userData.entityIdMap) return;

    const entityId = mesh.userData.entityIdMap.get(instanceId);
    if (entityId && this.armies.get(entityId)?.isMine) {
      return entityId;
    }
  }

  async onUpdate(
    update: ArmySystemUpdate,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredTiles: Map<number, Map<number, BiomeType>>,
  ) {
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, owner, troopType, troopTier, order } = update;

    const newPosition = new Position({ x: hexCoords.col, y: hexCoords.row });
    const currentArmiesTick = getBlockTimestamp().currentArmiesTick;

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, newPosition, armyHexes, structureHexes, exploredTiles);
    } else {
      this.addArmy(
        entityId,
        newPosition,
        owner,
        order,
        troopType,
        troopTier,
        update.isDaydreamsAgent,
        update.isAlly,
        update.troopCount,
        update.currentStamina(currentArmiesTick),
        update.maxStamina,
      );
    }
    return false;
  }

  async updateChunk(chunkKey: string) {
    await this.armyModel.loadPromise;

    if (this.currentChunkKey === chunkKey) {
      return;
    }

    this.currentChunkKey = chunkKey;
    await this.renderVisibleArmies(chunkKey);
  }

  private async renderVisibleArmies(chunkKey: string) {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    this.visibleArmies = this.getVisibleArmiesForChunk(startRow, startCol);

    // Reset all model instances
    this.armyModel.resetInstanceCounts();

    let currentCount = 0;
    this.visibleArmies.forEach((army) => {
      const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(army.entityId, army.category, army.tier, biome);
      this.armyModel.assignModelToEntity(army.entityId, modelType);

      if (army.isDaydreamsAgent) {
        this.armyModel.setIsAgent(true);
      }

      const rotationSeed = hashCoordinates(x, y);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      // Update the specific model instance for this entity
      this.armyModel.updateInstance(
        army.entityId,
        currentCount,
        position,
        this.scale,
        new THREE.Euler(0, randomRotation, 0),
        new THREE.Color(army.color),
      );

      this.armies.set(army.entityId, { ...army, matrixIndex: currentCount });

      // Increment count and update all meshes
      currentCount++;
      this.armyModel.setVisibleCount(currentCount);

      // Add or update entity ID label
      if (this.entityIdLabels.has(army.entityId)) {
        const label = this.entityIdLabels.get(army.entityId)!;
        label.position.copy(position);
        label.position.y += 1.5;
      } else {
        this.addEntityIdLabel(army, position);
      }
    });

    // Remove labels for armies that are no longer visible
    this.entityIdLabels.forEach((label, entityId) => {
      if (!this.visibleArmies.find((army) => army.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // Update all model instances
    this.armyModel.updateAllInstances();
    this.armyModel.computeBoundingSphere();
  }

  private isArmyVisible(
    army: { entityId: ID; hexCoords: Position; isMine: boolean; color: string },
    startRow: number,
    startCol: number,
  ) {
    const { x, y } = army.hexCoords.getNormalized();
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
  }

  private getVisibleArmiesForChunk(startRow: number, startCol: number): Array<ArmyData> {
    const visibleArmies = Array.from(this.armies.entries())
      .filter(([_, army]) => {
        return this.isArmyVisible(army, startRow, startCol);
      })
      .map(([entityId, army], index) => ({
        entityId,
        hexCoords: army.hexCoords,
        isMine: army.isMine,
        color: army.color,
        matrixIndex: index,
        owner: army.owner,
        isAlly: army.isAlly,
        order: army.order,
        category: army.category,
        tier: army.tier,
        isDaydreamsAgent: army.isDaydreamsAgent,
        troopCount: army.troopCount,
        currentStamina: army.currentStamina,
        maxStamina: army.maxStamina,
      }));

    return visibleArmies;
  }

  public async addArmy(
    entityId: ID,
    hexCoords: Position,
    owner: { address: bigint | undefined; ownerName: string; guildName: string },
    order: number,
    category: TroopType,
    tier: TroopTier,
    isDaydreamsAgent: boolean,
    isAlly: boolean,
    troopCount: number,
    currentStamina: number,
    maxStamina: number,
  ) {
    if (this.armies.has(entityId)) return;

    const { x, y } = hexCoords.getContract();
    const biome = Biome.getBiome(x, y);
    const modelType = this.armyModel.getModelTypeForEntity(entityId, category, tier, biome);
    this.armyModel.assignModelToEntity(entityId, modelType);

    const orderData = orders.find((_order) => _order.orderId === order);
    let isMine = owner.address ? isAddressEqualToAccount(owner.address) : false;

    // Determine the color based on ownership (consistent with structure labels)
    let color: string;
    if (isDaydreamsAgent) {
      color = COLORS.SELECTED;
    } else if (isMine) {
      color = LABEL_STYLES.MINE.textColor || "#d9f99d";
    } else if (isAlly) {
      color = LABEL_STYLES.ALLY.textColor || "#bae6fd";
    } else {
      color = LABEL_STYLES.ENEMY.textColor || "#fecdd3";
    }

    // Check for pending label updates and apply them if they exist
    const pendingUpdate = this.pendingLabelUpdates.get(entityId);
    if (pendingUpdate) {
      console.log(`[PENDING LABEL UPDATE] Applying pending update for army ${entityId}`);

      isMine = isAddressEqualToAccount(pendingUpdate.owner.address);
      color = isMine
        ? LABEL_STYLES.MINE.textColor || "#d9f99d"
        : isAlly
          ? LABEL_STYLES.ALLY.textColor || "#bae6fd"
          : LABEL_STYLES.ENEMY.textColor || "#fecdd3";
      // Calculate current stamina using the pending update data
      const { currentArmiesTick } = getBlockTimestamp();
      const updatedStamina = Number(
        StaminaManager.getStamina(
          {
            category,
            tier,
            count: BigInt(pendingUpdate.troopCount),
            stamina: {
              amount: BigInt(pendingUpdate.stamina),
              updated_tick: BigInt(pendingUpdate.updatedTick),
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
          },
          currentArmiesTick,
        ).amount,
      );

      // Use pending update data instead of initial data
      troopCount = pendingUpdate.troopCount;
      currentStamina = updatedStamina;
      owner = pendingUpdate.owner;

      // Clear the pending update
      this.pendingLabelUpdates.delete(entityId);
    }

    this.armies.set(entityId, {
      entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords,
      isMine,
      isAlly,
      owner: {
        address: owner.address || 0n,
        ownerName: owner.ownerName,
        guildName: owner.guildName,
      },
      color,
      order: (orderData?.orderName ?? "") as string,
      category,
      tier,
      isDaydreamsAgent,
      // Enhanced data
      troopCount,
      currentStamina,
      maxStamina,
    });

    // Apply any pending relic effects for this army
    if (this.applyPendingRelicEffectsCallback) {
      try {
        await this.applyPendingRelicEffectsCallback(entityId);
      } catch (error) {
        console.error(`Failed to apply pending relic effects for army ${entityId}:`, error);
      }
    }

    await this.renderVisibleArmies(this.currentChunkKey!);
  }

  public async moveArmy(
    entityId: ID,
    hexCoords: Position,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredTiles: Map<number, Map<number, BiomeType>>,
  ) {
    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const startPos = armyData.hexCoords.getNormalized();
    const targetPos = hexCoords.getNormalized();

    if (startPos.x === targetPos.x && startPos.y === targetPos.y) return;

    // todo: currently taking max stamina of paladin as max stamina but need to refactor
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin, TroopTier.T3);
    const maxHex = Math.floor(Number(maxTroopStamina) / configManager.getMinTravelStaminaCost());

    const path = findShortestPath(armyData.hexCoords, hexCoords, exploredTiles, structureHexes, armyHexes, maxHex);

    if (!path || path.length === 0) {
      // If no path is found, just teleport the army to the target position
      this.armies.set(entityId, { ...armyData, hexCoords });
      return;
    }

    // Convert path to world positions
    const worldPath = path.map((pos) => this.getArmyWorldPosition(entityId, pos));

    // Update army position immediately to avoid starting from a "back" position
    this.armies.set(entityId, { ...armyData, hexCoords });
    this.armyPaths.set(entityId, path);

    // Don't remove relic effects during movement - they will follow the army
    // The updateRelicEffectPositions method will handle smooth positioning

    // Start movement in ArmyModel with troop information
    this.armyModel.startMovement(entityId, worldPath, armyData.matrixIndex, armyData.category, armyData.tier);
  }

  public async updateRelicEffects(entityId: ID, newRelicEffects: Array<{ relicNumber: number; effect: RelicEffect }>) {
    const army = this.armies.get(entityId);
    if (!army) return;

    const currentEffects = this.armyRelicEffects.get(entityId) || [];
    const currentRelicNumbers = new Set(currentEffects.map((e) => e.relicNumber));
    const newRelicNumbers = new Set(newRelicEffects.map((e) => e.relicNumber));

    // Remove effects that are no longer in the new list
    for (const currentEffect of currentEffects) {
      if (!newRelicNumbers.has(currentEffect.relicNumber)) {
        currentEffect.fx.end();
      }
    }

    // Add new effects that weren't previously active
    const effectsToAdd: Array<{ relicNumber: number; effect: RelicEffect; fx: { end: () => void; instance?: any } }> =
      [];
    for (const newEffect of newRelicEffects) {
      if (!currentRelicNumbers.has(newEffect.relicNumber)) {
        try {
          const position = this.getArmyWorldPosition(entityId, army.hexCoords);
          position.y += 1.5;

          // Register the relic FX if not already registered (wait for texture to load)
          await this.fxManager.registerRelicFX(newEffect.relicNumber);

          // Play the relic effect
          const fx = this.fxManager.playFxAtCoords(
            `relic_${newEffect.relicNumber}`,
            position.x,
            position.y,
            position.z,
            0.8,
            undefined,
            true,
          );

          effectsToAdd.push({ relicNumber: newEffect.relicNumber, effect: newEffect.effect, fx });
        } catch (error) {
          console.error(`Failed to add relic effect ${newEffect.relicNumber} for army ${entityId}:`, error);
        }
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
  }

  public removeArmy(entityId: ID) {
    if (!this.armies.has(entityId)) return;

    // Remove any relic effects
    this.updateRelicEffects(entityId, []);

    // Clear any pending relic effects
    if (this.clearPendingRelicEffectsCallback) {
      this.clearPendingRelicEffectsCallback(entityId);
    }

    // Clear any pending label updates for this army
    if (this.pendingLabelUpdates.has(entityId)) {
      console.log(`[PENDING LABEL UPDATE] Clearing pending update for removed army ${entityId}`);
      this.pendingLabelUpdates.delete(entityId);
    }

    const { promise } = this.fxManager.playFxAtCoords(
      "skull",
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).x,
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).y + 2,
      this.getArmyWorldPosition(entityId, this.armies.get(entityId)!.hexCoords).z,
      1,
      "Defeated!",
    );
    promise.then(async () => {
      this.armies.delete(entityId);
      this.armyModel.removeLabel(entityId);
      this.entityIdLabels.delete(entityId);
      await this.renderVisibleArmies(this.currentChunkKey!);
    });
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.armyModel.updateAnimations(deltaTime);

    // Update relic effect positions to follow moving armies
    this.updateRelicEffectPositions();
  }

  private getArmyWorldPosition = (_armyEntityId: ID, hexCoords: Position, isIntermediatePosition: boolean = false) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });

    if (isIntermediatePosition) return basePosition;

    return basePosition;
  };

  recheckOwnership() {
    this.armies.forEach((army) => {
      army.isMine = isAddressEqualToAccount(army.owner.address);
    });
  }

  private async addEntityIdLabel(army: ArmyData, position: THREE.Vector3) {
    // Create label using centralized function
    const labelDiv = createArmyLabel(army, this.currentCameraView);

    const label = new CSS2DObject(labelDiv);
    label.position.copy(position);
    label.position.y += 2.1;
    // Store entityId in userData for identification
    label.userData.entityId = army.entityId;

    // Store original renderOrder
    const originalRenderOrder = label.renderOrder;

    // Set renderOrder to Infinity on hover
    labelDiv.addEventListener("mouseenter", () => {
      label.renderOrder = Infinity;
    });

    // Restore original renderOrder when mouse leaves
    labelDiv.addEventListener("mouseleave", () => {
      label.renderOrder = originalRenderOrder;
    });

    this.entityIdLabels.set(army.entityId, label);
    this.armyModel.addLabel(army.entityId, label);
  }

  removeLabelsFromScene() {
    this.armyModel.removeLabelsFromScene();
  }

  addLabelsToScene() {
    this.armyModel.addLabelsToScene();
  }

  private removeEntityIdLabel(entityId: ID) {
    this.armyModel.removeLabel(entityId);
    this.entityIdLabels.delete(entityId);
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) return;
    this.currentCameraView = view;

    // Update the ArmyModel's camera view
    this.armyModel.setCurrentCameraView(view);

    // Apply label transitions using the centralized function
    applyLabelTransitions(this.entityIdLabels, view);
  };

  public hasArmy(entityId: ID): boolean {
    return this.armies.has(entityId);
  }

  public getArmyRelicEffects(entityId: ID): { relicId: number; effect: RelicEffect }[] {
    const effects = this.armyRelicEffects.get(entityId);
    return effects ? effects.map((effect) => ({ relicId: effect.relicNumber, effect: effect.effect })) : [];
  }

  private updateRelicEffectPositions() {
    // Update relic effect positions for armies that are currently moving
    this.armyRelicEffects.forEach((relicEffects, entityId) => {
      const army = this.armies.get(entityId);
      if (!army) return;

      // Get the current position of the army (might be interpolated during movement)
      const instanceData = this.armyModel["instanceData"]?.get(entityId);
      if (instanceData && instanceData.isMoving) {
        // Army is currently moving, update relic effects to follow the current interpolated position
        const currentPosition = instanceData.position.clone();
        currentPosition.y += 1.5; // Relic effects are positioned 1.5 units above the army

        relicEffects.forEach((relicEffect) => {
          // Update the position of each relic effect to follow the army
          if (relicEffect.fx.instance) {
            // Update the base position that the orbital animation uses
            relicEffect.fx.instance.initialX = currentPosition.x;
            relicEffect.fx.instance.initialY = currentPosition.y;
            relicEffect.fx.instance.initialZ = currentPosition.z;
          }
        });
      }
    });
  }

  /**
   * Update an army label with fresh data from MapDataStore
   */
  private updateArmyLabelData(entityId: ID, army: ArmyData, existingLabel: CSS2DObject): void {
    // Update the existing label content in-place
    updateArmyLabel(existingLabel.element, army);
  }

  /**
   * Update army label from system update (troop count/stamina changes)
   */
  public updateArmyLabelFromSystemUpdate(update: {
    entityId: ID;
    troopCount: number;
    stamina: number;
    updatedTick: number;
    owner: { address: bigint; ownerName: string; guildName: string };
  }): void {
    const army = this.armies.get(update.entityId);
    console.log("[UPDATING ARMY LABEL FROM SYSTEM UPDATE]", { army });

    // If army doesn't exist yet, store the update as pending
    if (!army) {
      console.log(`[PENDING LABEL UPDATE] Storing pending update for army ${update.entityId}`);
      this.pendingLabelUpdates.set(update.entityId, {
        troopCount: update.troopCount,
        stamina: update.stamina,
        updatedTick: update.updatedTick,
        owner: update.owner,
      });
      return;
    }

    // Update cached army data
    army.troopCount = update.troopCount;

    // Calculate current stamina using StaminaManager
    const { currentArmiesTick } = getBlockTimestamp();
    army.currentStamina = Number(
      StaminaManager.getStamina(
        {
          category: army.category,
          tier: army.tier,
          count: BigInt(update.troopCount),
          stamina: {
            amount: BigInt(update.stamina),
            updated_tick: BigInt(update.updatedTick),
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
        },
        currentArmiesTick,
      ).amount,
    );

    army.troopCount = update.troopCount;
    army.owner = update.owner;
    army.isMine = isAddressEqualToAccount(update.owner.address);

    // Update the label if it exists
    const label = this.entityIdLabels.get(update.entityId);
    if (label) {
      this.updateArmyLabelData(update.entityId, army, label);
    }
  }

  public destroy() {
    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up MapDataStore refresh callback
    this.mapDataStore.offRefresh(this.onMapDataRefresh);

    // Clean up relic effects
    for (const [entityId] of this.armyRelicEffects) {
      this.updateRelicEffects(entityId, []);
    }
    // Clean up any other resources...
  }
}
