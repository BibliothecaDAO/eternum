import { useAccountStore } from "@/hooks/store/use-account-store";
import { ArmyModel } from "@/three/managers/army-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { ModelType } from "@/three/types/army";
import { GUIManager, LABEL_STYLES } from "@/three/utils/";
import { FrustumManager } from "@/three/utils/frustum-manager";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import type { SetupResult } from "@bibliothecadao/dojo";
import { Position } from "@bibliothecadao/eternum";

import { COLORS } from "@/ui/features";
import { ExplorerTroopsSystemUpdate, ExplorerTroopsTileSystemUpdate, getBlockTimestamp } from "@bibliothecadao/eternum";

import { Biome, configManager, StaminaManager } from "@bibliothecadao/eternum";
import {
  BiomeType,
  ClientComponents,
  ContractAddress,
  HexEntityInfo,
  ID,
  RelicEffect,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { Color, Euler, Group, Raycaster, Scene, Vector3 } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { AttachmentTransform, CosmeticAttachmentTemplate } from "../cosmetics";
import {
  CosmeticAttachmentManager,
  playerCosmeticsStore,
  resolveArmyCosmetic,
  resolveArmyMountTransforms,
} from "../cosmetics";
import { ArmyData, RenderChunkSize } from "../types";
import type { ArmyInstanceData } from "../types/army";
import { getHexForWorldPosition, getWorldPositionForHex, hashCoordinates } from "../utils";
import { getBattleTimerLeft, getCombatAngles } from "../utils/combat-directions";
import { createArmyLabel, updateArmyLabel } from "../utils/labels/label-factory";
import { LabelPool } from "../utils/labels/label-pool";
import { applyLabelTransitions } from "../utils/labels/label-transitions";
import { env } from "../../../env";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import { MemoryMonitor } from "../utils/memory-monitor";
import { findShortestPath } from "../utils/pathfinding";
import { FXManager } from "./fx-manager";
import { PointsLabelRenderer } from "./points-label-renderer";
import * as THREE from "three";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;

interface PendingExplorerTroopsUpdate {
  troopCount: number;
  onChainStamina: { amount: bigint; updatedTick: number };
  ownerAddress: bigint;
  ownerName: string;
  timestamp: number; // When this update was received
  updateTick: number; // Game tick when this update occurred
  ownerStructureId?: ID | null;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
}

interface AddArmyParams {
  entityId: ID;
  hexCoords: Position;
  owner: { address: bigint | undefined; ownerName: string; guildName: string };
  owningStructureId?: ID | null;
  category: TroopType;
  tier: TroopTier;
  isDaydreamsAgent: boolean;
  troopCount?: number;
  currentStamina?: number;
  onChainStamina?: { amount: bigint; updatedTick: number };
  maxStamina?: number;
  attackedFromDegrees?: number;
  attackedTowardDegrees?: number;
  battleCooldownEnd?: number;
  battleTimerLeft?: number;
  latestAttackerId?: number;
  latestDefenderId?: number;
  latestAttackerCoordX?: number;
  latestAttackerCoordY?: number;
  latestDefenderCoordX?: number;
  latestDefenderCoordY?: number;
}

type RelicFxHandle = {
  end: () => void;
  instance?: {
    initialX: number;
    initialY: number;
    initialZ: number;
    [key: string]: unknown;
  };
};

export class ArmyManager {
  private scene: Scene;
  private armyModel: ArmyModel;
  private armies: Map<ID, ArmyData> = new Map();
  private scale: Vector3;
  private currentChunkKey: string | null = "190,170";
  private renderChunkSize: RenderChunkSize;
  private visibleArmies: ArmyData[] = [];
  private renderQueuePromise: Promise<void> | null = null;
  private renderQueueActive = false;
  private pendingRenderChunkKey: string | null = null;
  private armyPaths: Map<ID, Position[]> = new Map();
  private lastKnownVisibleHexes: Map<ID, { col: number; row: number }> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelPool = new LabelPool();
  private labelsGroup: Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private components?: ClientComponents;
  private armyRelicEffects: Map<ID, Array<{ relicNumber: number; effect: RelicEffect; fx: RelicFxHandle }>> = new Map();
  private applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>;
  private clearPendingRelicEffectsCallback?: (entityId: ID) => void;
  private pointsRenderers?: {
    player: PointsLabelRenderer;
    enemy: PointsLabelRenderer;
    ally: PointsLabelRenderer;
    agent: PointsLabelRenderer;
  };
  private frustumManager?: FrustumManager;
  private frustumVisibilityDirty = false;
  private unsubscribeFrustum?: () => void;
  private pendingExplorerTroopsUpdate: Map<ID, PendingExplorerTroopsUpdate> = new Map();
  private lastKnownArmiesTick: number = 0;
  private tickCheckTimeout: NodeJS.Timeout | null = null;
  private cleanupTimeout: NodeJS.Timeout | null = null;
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private memoryMonitor?: MemoryMonitor;
  private unsubscribeAccountStore?: () => void;
  private attachmentManager: CosmeticAttachmentManager;
  private armyAttachmentSignatures: Map<number, string> = new Map();
  private activeArmyAttachmentEntities: Set<number> = new Set();
  private readonly armyAttachmentTransformScratch = new Map<string, AttachmentTransform>();

  // Reusable objects for memory optimization
  private readonly tempPosition: Vector3 = new Vector3();
  private readonly tempCosmeticPosition: Vector3 = new Vector3();

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    dojoContext?: SetupResult,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
    frustumManager?: FrustumManager,
  ) {
    this.scene = scene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.armyModel = new ArmyModel(scene, labelsGroup, this.currentCameraView);
    this.scale = new Vector3(0.3, 0.3, 0.3);
    this.renderChunkSize = renderChunkSize;
    this.frustumManager = frustumManager;
    if (this.frustumManager) {
      this.frustumVisibilityDirty = true;
      this.unsubscribeFrustum = this.frustumManager.onChange(() => {
        this.frustumVisibilityDirty = true;
      });
    }
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
    this.labelsGroup = labelsGroup || new Group();
    this.hexagonScene = hexagonScene;
    this.fxManager = new FXManager(scene, 1);
    this.attachmentManager = new CosmeticAttachmentManager(scene);
    this.components = dojoContext?.components as ClientComponents | undefined;
    this.applyPendingRelicEffectsCallback = applyPendingRelicEffectsCallback;
    this.clearPendingRelicEffectsCallback = clearPendingRelicEffectsCallback;

    // Initialize memory monitor for tracking army operations
    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 25, // Lower threshold for army operations
        onMemorySpike: (spike) => {
          console.warn(`🎖️  Army Manager Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
        },
      });
    }

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    // Initialize points-based icon renderers
    this.initializePointsRenderers();

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
            this.addArmy({
              entityId: createArmyParams.entityId,
              hexCoords: new Position({ x: createArmyParams.col, y: createArmyParams.row }),
              owner: {
                address: createArmyParams.isMine
                  ? ContractAddress(useAccountStore.getState().account?.address || "0")
                  : 0n,
                // TODO: Add owner name and guild name
                ownerName: "Neutral",
                guildName: "None",
              },
              category: TroopType.Paladin,
              tier: TroopTier.T1,
              isDaydreamsAgent: false,
              troopCount: 10,
              currentStamina: 10,
              onChainStamina: {
                amount: 100n,
                updatedTick: getBlockTimestamp().currentArmiesTick,
              },
              maxStamina: 100,
            });
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

    this.unsubscribeAccountStore = useAccountStore.subscribe(() => {
      this.recheckOwnership();
    });

    // Initialize the last known armies tick to current tick
    this.lastKnownArmiesTick = getBlockTimestamp().currentArmiesTick;

    // Start checking for tick changes every second
    this.scheduleTickCheck();

    // Start periodic cleanup of stale pending updates every 60 seconds
    this.startPendingUpdatesCleanup();
  }

  private scheduleTickCheck() {
    this.tickCheckTimeout = setTimeout(() => {
      const { currentArmiesTick } = getBlockTimestamp();
      if (currentArmiesTick > this.lastKnownArmiesTick) {
        this.lastKnownArmiesTick = currentArmiesTick;
        this.recomputeStaminaForAllArmies();
      }
      // Update battle timers every second
      this.recomputeBattleTimersForAllArmies();
      // Schedule the next check
      this.scheduleTickCheck();
    }, 1000);
  }

  private startPendingUpdatesCleanup() {
    const cleanup = () => {
      const now = Date.now();
      const maxAge = 60000; // 60 seconds
      let cleanedCount = 0;

      for (const [entityId, pendingUpdate] of this.pendingExplorerTroopsUpdate.entries()) {
        if (now - pendingUpdate.timestamp > maxAge) {
          this.pendingExplorerTroopsUpdate.delete(entityId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`[PENDING UPDATES CLEANUP] Removed ${cleanedCount} stale pending updates`);
      }

      // Schedule next cleanup
      this.cleanupTimeout = setTimeout(cleanup, 60000);
    };

    // Start initial cleanup after 60 seconds
    this.cleanupTimeout = setTimeout(cleanup, 60000);
  }

  public onMouseMove(raycaster: Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length > 0) {
      const { instanceId, mesh } = intersectResults[0];
      if (instanceId !== undefined && mesh.userData.entityIdMap) {
        return mesh.userData.entityIdMap.get(instanceId);
      }
    }
    return undefined;
  }

  public onRightClick(raycaster: Raycaster) {
    const intersectResults = this.armyModel.raycastAll(raycaster);
    if (intersectResults.length === 0) return;

    const { instanceId, mesh } = intersectResults[0];
    if (instanceId === undefined || !mesh.userData.entityIdMap) return;

    const entityId = mesh.userData.entityIdMap.get(instanceId);
    if (entityId && this.armies.get(entityId)?.isMine) {
      return entityId;
    }
  }

  async onTileUpdate(
    update: ExplorerTroopsTileSystemUpdate,
    armyHexes: Map<number, Map<number, HexEntityInfo>>,
    structureHexes: Map<number, Map<number, HexEntityInfo>>,
    exploredTiles: Map<number, Map<number, BiomeType>>,
  ) {
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, ownerAddress, ownerName, guildName, troopType, troopTier, battleData } = update;

    const {
      battleCooldownEnd,
      latestAttackerId,
      latestDefenderId,
      latestAttackerCoordX,
      latestAttackerCoordY,
      latestDefenderCoordX,
      latestDefenderCoordY,
    } = battleData || {};

    // Calculate battle timer left
    const battleTimerLeft = getBattleTimerLeft(battleCooldownEnd);

    const newPosition = new Position({ x: hexCoords.col, y: hexCoords.row });

    if (this.armies.has(entityId)) {
      this.moveArmy(entityId, newPosition, armyHexes, structureHexes, exploredTiles);
    } else {
      this.addArmy({
        entityId,
        hexCoords: newPosition,
        owner: {
          address: ownerAddress,
          ownerName,
          guildName,
        },
        owningStructureId: update.ownerStructureId,
        category: troopType,
        tier: troopTier,
        isDaydreamsAgent: update.isDaydreamsAgent,
        troopCount: update.troopCount,
        currentStamina: update.currentStamina,
        onChainStamina: update.onChainStamina,
        maxStamina: update.maxStamina,
        latestAttackerCoordX: latestAttackerCoordX ?? undefined,
        latestAttackerCoordY: latestAttackerCoordY ?? undefined,
        latestDefenderCoordX: latestDefenderCoordX ?? undefined,
        latestDefenderCoordY: latestDefenderCoordY ?? undefined,
        latestAttackerId: latestAttackerId ?? undefined,
        latestDefenderId: latestDefenderId ?? undefined,
        battleCooldownEnd,
        battleTimerLeft,
      });
    }
    return false;
  }

  async updateChunk(chunkKey: string) {
    await this.armyModel.loadPromise;

    if (this.currentChunkKey === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      console.log(`[CHUNK SYNC] Waiting for previous chunk switch to complete before switching to ${chunkKey}`);
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (this.currentChunkKey === chunkKey) {
      return;
    }

    console.log(`[CHUNK SYNC] Switching army chunk from ${this.currentChunkKey} to ${chunkKey}`);
    this.currentChunkKey = chunkKey;

    // Create and track the chunk switch promise
    this.chunkSwitchPromise = this.renderVisibleArmies(chunkKey);

    try {
      await this.chunkSwitchPromise;
      console.log(`[CHUNK SYNC] Army chunk switch to ${chunkKey} completed`);
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  private renderVisibleArmies(chunkKey: string): Promise<void> {
    if (!chunkKey) {
      return Promise.resolve();
    }

    this.pendingRenderChunkKey = chunkKey;
    return this.processRenderQueue();
  }

  private processRenderQueue(): Promise<void> {
    if (this.renderQueueActive) {
      return this.renderQueuePromise ?? Promise.resolve();
    }

    this.renderQueueActive = true;
    this.renderQueuePromise = (async () => {
      try {
        while (this.pendingRenderChunkKey) {
          const chunkKey = this.pendingRenderChunkKey;
          this.pendingRenderChunkKey = null;
          if (chunkKey) {
            await this.executeRenderForChunk(chunkKey);
          }
        }
      } finally {
        this.renderQueueActive = false;
        this.renderQueuePromise = null;
      }

      // If new work was queued while we were resetting state, process it now
      if (this.pendingRenderChunkKey) {
        return this.processRenderQueue();
      }
    })();

    return this.renderQueuePromise;
  }

  private collectModelInfo(armies: ArmyData[]): {
    modelTypesByEntity: Map<ID, ModelType>;
    requiredModelTypes: Set<ModelType>;
  } {
    const modelTypesByEntity = new Map<ID, ModelType>();
    const requiredModelTypes = new Set<ModelType>();

    armies.forEach((army) => {
      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(army.entityId, army.category, army.tier, biome);
      modelTypesByEntity.set(army.entityId, modelType);
      requiredModelTypes.add(modelType);
    });

    return { modelTypesByEntity, requiredModelTypes };
  }

  private getAttachmentSignature(templates: CosmeticAttachmentTemplate[]): string {
    if (templates.length === 0) {
      return "";
    }
    return templates
      .map((template) => `${template.id}:${template.slot ?? ""}`)
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .join("|");
  }

  private syncVisibleArmyAttachments(visibleArmies: ArmyData[]): void {
    const retain = new Set<number>();

    visibleArmies.forEach((army) => {
      const templates = army.attachments ?? [];
      const entityId = Number(army.entityId);

      if (templates.length === 0) {
        if (this.activeArmyAttachmentEntities.has(entityId)) {
          this.attachmentManager.removeAttachments(entityId);
          this.activeArmyAttachmentEntities.delete(entityId);
        }
        this.armyAttachmentSignatures.delete(entityId);
        return;
      }

      retain.add(entityId);
      const signature = this.getAttachmentSignature(templates);
      const isActive = this.activeArmyAttachmentEntities.has(entityId);

      if (!isActive || this.armyAttachmentSignatures.get(entityId) !== signature) {
        this.attachmentManager.spawnAttachments(entityId, templates);
        this.armyAttachmentSignatures.set(entityId, signature);
        this.activeArmyAttachmentEntities.add(entityId);
      }
    });

    if (this.activeArmyAttachmentEntities.size === 0) {
      return;
    }

    const toRemove: number[] = [];
    this.activeArmyAttachmentEntities.forEach((entityId) => {
      if (!retain.has(entityId)) {
        toRemove.push(entityId);
      }
    });

    toRemove.forEach((entityId) => {
      this.attachmentManager.removeAttachments(entityId);
      this.activeArmyAttachmentEntities.delete(entityId);
      this.armyAttachmentSignatures.delete(entityId);
    });
  }

  private updateArmyAttachmentTransforms() {
    if (this.activeArmyAttachmentEntities.size === 0) {
      return;
    }

    const instanceDataMap = (this.armyModel as unknown as { instanceData?: Map<number, ArmyInstanceData> })
      .instanceData as Map<number, ArmyInstanceData> | undefined;

    this.visibleArmies.forEach((army) => {
      const entityId = Number(army.entityId);
      if (!this.activeArmyAttachmentEntities.has(entityId)) {
        return;
      }

      const instanceData = instanceDataMap?.get(entityId);
      if (instanceData?.position) {
        this.tempCosmeticPosition.copy(instanceData.position);
      } else {
        const worldPosition = this.getArmyWorldPosition(army.entityId, army.hexCoords);
        this.tempCosmeticPosition.copy(worldPosition);
      }

      const baseTransform = {
        position: this.tempCosmeticPosition,
        rotation: instanceData?.rotation,
        scale: instanceData?.scale ?? this.scale,
      };

      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(entityId, army.category, army.tier, biome);

      const mountTransforms = resolveArmyMountTransforms(modelType, baseTransform, this.armyAttachmentTransformScratch);

      this.attachmentManager.updateAttachmentTransforms(entityId, baseTransform, mountTransforms);
    });
  }

  private async executeRenderForChunk(chunkKey: string): Promise<void> {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const computeVisibleArmies = () => this.getVisibleArmiesForChunk(startRow, startCol);

    let visibleArmies = computeVisibleArmies();
    let { modelTypesByEntity, requiredModelTypes } = this.collectModelInfo(visibleArmies);

    if (requiredModelTypes.size > 0) {
      await this.armyModel.preloadModels(requiredModelTypes);
    }

    // Recompute after any async work to capture the latest data
    visibleArmies = computeVisibleArmies();
    ({ modelTypesByEntity, requiredModelTypes } = this.collectModelInfo(visibleArmies));

    if (requiredModelTypes.size > 0) {
      await this.armyModel.preloadModels(requiredModelTypes);
    }

    // Reset all model instances before applying the latest snapshot
    this.armyModel.resetInstanceCounts();

    const updatedVisibleArmies: ArmyData[] = [];
    let currentCount = 0;

    visibleArmies.forEach((army) => {
      const numericId = Number(army.entityId);

      const path = this.armyPaths.get(army.entityId);

      let sourceHex = army.hexCoords;
      if (path && path.length > 0) {
        sourceHex = path[0];
      }

      let position = this.armyModel.getEntityWorldPosition(numericId);

      if (!position) {
        position = this.getArmyWorldPosition(army.entityId, sourceHex);
      }

      const { x, y } = army.hexCoords.getContract();
      const modelType = modelTypesByEntity.get(army.entityId);

      if (!modelType) {
        return;
      }

      this.armyModel.assignModelToEntity(army.entityId, modelType);

      if (army.isDaydreamsAgent) {
        this.armyModel.setIsAgent(true);
      }

      const rotationSeed = hashCoordinates(x, y);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;

      this.armyModel.updateInstance(
        army.entityId,
        currentCount,
        position,
        this.scale,
        new Euler(0, randomRotation, 0),
        new Color(army.color),
      );

      this.recordLastKnownHexFromWorld(army.entityId, position);

      const updatedArmy = { ...army, matrixIndex: currentCount };
      updatedVisibleArmies.push(updatedArmy);
      this.armies.set(army.entityId, updatedArmy);
      this.armyModel.rebindMovementMatrixIndex(army.entityId, currentCount);

      const activeLabel = this.entityIdLabels.get(army.entityId);
      if (activeLabel) {
        activeLabel.position.copy(position);
        activeLabel.position.y += 1.5;
      }

      // Add point icon for this army (always visible)
      if (this.pointsRenderers) {
        const iconPosition = position.clone();
        iconPosition.y += 2.1; // Match CSS2D label height
        const renderer = army.isDaydreamsAgent
          ? this.pointsRenderers.agent
          : army.isMine
            ? this.pointsRenderers.player
            : this.pointsRenderers.enemy; // TODO: Add ally check when implemented
        renderer.setPoint({
          entityId: army.entityId,
          position: iconPosition,
        });
        console.log(
          `[ArmyManager] Added point icon for army ${army.entityId} at position`,
          iconPosition,
          `renderer type: ${army.isDaydreamsAgent ? "agent" : army.isMine ? "player" : "enemy"}, count: ${renderer.getCount()}`,
        );
      } else {
        console.warn(`[ArmyManager] pointsRenderers not initialized yet for army ${army.entityId}`);
      }

      currentCount++;
    });

    this.armyModel.setVisibleCount(currentCount);

    this.entityIdLabels.forEach((label, entityId) => {
      if (!updatedVisibleArmies.some((army) => army.entityId === entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    // Remove points for armies no longer visible
    if (this.pointsRenderers) {
      const visibleArmyIds = new Set(updatedVisibleArmies.map((a) => a.entityId));
      [
        this.pointsRenderers.player,
        this.pointsRenderers.enemy,
        this.pointsRenderers.ally,
        this.pointsRenderers.agent,
      ].forEach((renderer) => {
        this.armies.forEach((_, entityId) => {
          if (!visibleArmyIds.has(entityId) && renderer.hasPoint(entityId)) {
            renderer.removePoint(entityId);
          }
        });
      });
    }

    this.visibleArmies = updatedVisibleArmies;
    this.syncVisibleArmyAttachments(updatedVisibleArmies);
    this.updateArmyAttachmentTransforms();

    // Update all model instances
    this.armyModel.updateAllInstances();
    this.armyModel.computeBoundingSphere();
    this.frustumVisibilityDirty = true;
  }

  private isArmyVisible(
    army: { entityId: ID; hexCoords: Position; isMine: boolean; color: string },
    startRow: number,
    startCol: number,
  ) {
    const entityIdNumber = Number(army.entityId);
    const worldPos = this.armyModel.getEntityWorldPosition(entityIdNumber);

    let x: number;
    let y: number;

    if (worldPos) {
      this.recordLastKnownHexFromWorld(army.entityId, worldPos);
      const lastKnown = this.lastKnownVisibleHexes.get(army.entityId)!;
      x = lastKnown.col;
      y = lastKnown.row;
    } else {
      const lastKnown = this.lastKnownVisibleHexes.get(army.entityId);
      if (lastKnown) {
        x = lastKnown.col;
        y = lastKnown.row;
      } else {
        const path = this.armyPaths.get(army.entityId);
        const fallback = path && path.length > 0 ? path[0] : army.hexCoords;
        const normalized = fallback.getNormalized();
        x = normalized.x;
        y = normalized.y;
        this.lastKnownVisibleHexes.set(army.entityId, { col: normalized.x, row: normalized.y });
        console.debug(
          `[ArmyManager] Using fallback hex for visibility of entity ${army.entityId} (pathFallback=${
            path && path.length > 0
          })`,
        );
      }
    }
    const isVisible =
      x >= startCol - this.renderChunkSize.width / 2 &&
      x <= startCol + this.renderChunkSize.width / 2 &&
      y >= startRow - this.renderChunkSize.height / 2 &&
      y <= startRow + this.renderChunkSize.height / 2;
    return isVisible;
  }

  private getVisibleArmiesForChunk(startRow: number, startCol: number): Array<ArmyData> {
    const visibleArmies: ArmyData[] = Array.from(this.armies.values()).filter((army) => {
      return this.isArmyVisible(army, startRow, startCol);
    });

    return visibleArmies;
  }

  public async addArmy(params: AddArmyParams) {
    if (this.armies.has(params.entityId)) return;

    // Monitor memory usage before adding army
    this.memoryMonitor?.getCurrentStats(`addArmy-${params.entityId}`);

    const { x, y } = params.hexCoords.getContract();
    const biome = Biome.getBiome(x, y);
    const baseModelType = this.armyModel.getModelTypeForEntity(params.entityId, params.category, params.tier, biome);

    // Variables to hold the final values
    let finalTroopCount = params.troopCount || 0;
    let finalCurrentStamina = params.currentStamina || 0;
    let finalOnChainStamina = params.onChainStamina || { amount: 0n, updatedTick: 0 };
    const finalMaxStamina = params.maxStamina || 0;
    let finalOwnerAddress = params.owner.address;
    let finalOwnerName = params.owner.ownerName;
    const finalGuildName = params.owner.guildName;
    let finalOwningStructureId = params.owningStructureId ?? null;

    let finalBattleCooldownEnd = params.battleCooldownEnd;
    let finalBattleTimerLeft = getBattleTimerLeft(params.battleCooldownEnd);

    let { attackedFromDegrees, attackTowardDegrees } = getCombatAngles(
      { col: x, row: y },
      params.latestAttackerId ?? undefined,
      params.latestAttackerCoordX && params.latestAttackerCoordY
        ? { x: params.latestAttackerCoordX, y: params.latestAttackerCoordY }
        : undefined,
      params.latestDefenderId ?? undefined,
      params.latestDefenderCoordX && params.latestDefenderCoordY
        ? { x: params.latestDefenderCoordX, y: params.latestDefenderCoordY }
        : undefined,
    );

    console.log("[ADD ARMY] Combat degrees:", {
      attackedFromDegrees: attackedFromDegrees,
      attackedTowardDegrees: attackTowardDegrees,
      pos: { x, y },
      latestAttackerId: params.latestAttackerId,
      latestAttackerCoordX: params.latestAttackerCoordX,
      latestAttackerCoordY: params.latestAttackerCoordY,
      latestDefenderId: params.latestDefenderId,
      latestDefenderCoordX: params.latestDefenderCoordX,
      latestDefenderCoordY: params.latestDefenderCoordY,
    });

    // Check for pending label updates and apply them if they exist
    const pendingUpdate = this.pendingExplorerTroopsUpdate.get(params.entityId);
    if (pendingUpdate) {
      // Check if pending update is not too old (max 30 seconds)
      const isPendingStale = Date.now() - pendingUpdate.timestamp > 30000;

      if (isPendingStale) {
        console.warn(
          `[PENDING LABEL UPDATE] Discarding stale pending update for army ${params.entityId} (age: ${Date.now() - pendingUpdate.timestamp}ms)`,
        );
        this.pendingExplorerTroopsUpdate.delete(params.entityId);
      } else {
        console.log(
          `[PENDING LABEL UPDATE] Applying pending update for army ${params.entityId} (tick: ${pendingUpdate.updateTick})`,
        );
        finalOnChainStamina = pendingUpdate.onChainStamina;

        // Apply any pending battle degrees data
        if (pendingUpdate.attackedFromDegrees !== undefined) {
          attackedFromDegrees = pendingUpdate.attackedFromDegrees;
        }
        if (pendingUpdate.attackedTowardDegrees !== undefined) {
          attackTowardDegrees = pendingUpdate.attackedTowardDegrees;
        }

        // Calculate current stamina using the pending update data
        const { currentArmiesTick } = getBlockTimestamp();
        const updatedStamina = Number(
          StaminaManager.getStamina(
            {
              category: params.category,
              tier: params.tier,
              count: BigInt(pendingUpdate.troopCount),
              stamina: {
                amount: BigInt(pendingUpdate.onChainStamina.amount),
                updated_tick: BigInt(pendingUpdate.onChainStamina.updatedTick),
              },
              // todo: add boosts
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
          ).amount,
        );

        // Use pending update data instead of initial data
        finalTroopCount = pendingUpdate.troopCount;
        finalCurrentStamina = updatedStamina;
        finalOwnerAddress = pendingUpdate.ownerAddress;
        finalOnChainStamina = pendingUpdate.onChainStamina;
        finalOwnerName = pendingUpdate.ownerName;
        finalBattleCooldownEnd = pendingUpdate.battleCooldownEnd;
        finalBattleTimerLeft = pendingUpdate.battleTimerLeft;
        if (pendingUpdate.ownerStructureId !== undefined && pendingUpdate.ownerStructureId !== null) {
          finalOwningStructureId = pendingUpdate.ownerStructureId;
        }

        // Clear the pending update
        this.pendingExplorerTroopsUpdate.delete(params.entityId);
      }
    }

    const structureIdForOwner =
      finalOwningStructureId !== null && finalOwningStructureId !== undefined
        ? finalOwningStructureId
        : (params.owningStructureId ?? null);

    if (structureIdForOwner !== null && this.components?.Structure) {
      try {
        const structureEntityId = getEntityIdFromKeys([BigInt(structureIdForOwner)]);
        const liveStructure = getComponentValue(this.components.Structure, structureEntityId);

        if (liveStructure) {
          const liveOwnerRaw = liveStructure.owner;
          if (liveOwnerRaw !== undefined && liveOwnerRaw !== null) {
            const normalizedOwnerAddress = typeof liveOwnerRaw === "bigint" ? liveOwnerRaw : BigInt(liveOwnerRaw ?? 0);

            finalOwnerAddress = normalizedOwnerAddress;

            let resolvedOwnerName = finalOwnerName;
            if (this.components.AddressName) {
              const addressName = getComponentValue(
                this.components.AddressName,
                getEntityIdFromKeys([normalizedOwnerAddress]),
              );

              if (addressName?.name) {
                try {
                  resolvedOwnerName = shortString.decodeShortString(addressName.name.toString());
                } catch (error) {
                  console.warn(`[ArmyManager] Failed to decode owner name for army ${params.entityId}:`, error);
                }
              }
            }

            if (!resolvedOwnerName || resolvedOwnerName.length === 0) {
              resolvedOwnerName = `0x${normalizedOwnerAddress.toString(16)}`;
            }

            finalOwnerName = resolvedOwnerName;
          }
        }
      } catch (error) {
        console.warn(
          `[ArmyManager] Failed to resolve owner from Structure component for army ${params.entityId}:`,
          error,
        );
      }
    }

    finalOwningStructureId = structureIdForOwner ?? finalOwningStructureId;

    const ownerForCosmetics = finalOwnerAddress ?? 0n;
    if (this.components && ownerForCosmetics !== 0n) {
      playerCosmeticsStore.hydrateFromBlitzComponent(this.components, ownerForCosmetics);
    }
    const cosmetic = resolveArmyCosmetic({
      owner: ownerForCosmetics,
      troopType: params.category,
      tier: params.tier,
      defaultModelType: baseModelType,
    });
    const resolvedModelType = cosmetic.modelType ?? baseModelType;

    await this.armyModel.preloadModels([resolvedModelType]);
    this.armyModel.assignModelToEntity(params.entityId, resolvedModelType);

    const isMine = finalOwnerAddress ? isAddressEqualToAccount(finalOwnerAddress) : false;

    // Determine the color based on ownership (consistent with structure labels)
    let color: string;
    if (params.isDaydreamsAgent) {
      color = COLORS.SELECTED;
    } else if (isMine) {
      color = LABEL_STYLES.MINE.textColor || "#d9f99d";
    } else {
      color = LABEL_STYLES.ENEMY.textColor || "#fecdd3";
    }

    this.armies.set(params.entityId, {
      entityId: params.entityId,
      matrixIndex: this.armies.size - 1,
      hexCoords: params.hexCoords,
      isMine,
      owningStructureId: finalOwningStructureId,
      owner: {
        address: finalOwnerAddress || 0n,
        ownerName: finalOwnerName,
        guildName: finalGuildName,
      },
      cosmeticId: cosmetic.cosmeticId,
      attachments: cosmetic.attachments,
      color,
      category: params.category,
      tier: params.tier,
      isDaydreamsAgent: params.isDaydreamsAgent,
      // Enhanced data
      troopCount: finalTroopCount,
      currentStamina: finalCurrentStamina,
      maxStamina: finalMaxStamina,
      // we need to check if there's any pending before we set it because onchain stamina might be 0 from the map data store in the system-manager
      onChainStamina: finalOnChainStamina,
      attackedFromDegrees: attackedFromDegrees ?? undefined,
      attackedTowardDegrees: attackTowardDegrees ?? undefined,
      battleCooldownEnd: finalBattleCooldownEnd,
      battleTimerLeft: finalBattleTimerLeft,
    });

    // Apply any pending relic effects for this army
    if (this.applyPendingRelicEffectsCallback) {
      try {
        await this.applyPendingRelicEffectsCallback(params.entityId);
      } catch (error) {
        console.error(`Failed to apply pending relic effects for army ${params.entityId}:`, error);
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
    // Monitor memory usage before army movement
    this.memoryMonitor?.getCurrentStats(`moveArmy-start-${entityId}`);

    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const startPos = armyData.hexCoords.getNormalized();
    const targetPos = hexCoords.getNormalized();

    if (startPos.x === targetPos.x && startPos.y === targetPos.y) return;

    // todo: currently taking max stamina of paladin as max stamina but need to refactor
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin, TroopTier.T3);
    const staminaMax = Number(maxTroopStamina?.staminaMax ?? 0);
    const minTravelCost = configManager.getMinTravelStaminaCost();
    const maxHex = Math.max(0, Math.floor(staminaMax / Math.max(minTravelCost, 1)));

    const path = findShortestPath(armyData.hexCoords, hexCoords, exploredTiles, structureHexes, armyHexes, maxHex);

    if (!path || path.length === 0) {
      // If no path is found, just teleport the army to the target position
      this.armies.set(entityId, { ...armyData, hexCoords });
      return;
    }

    if (path.length < 2) {
      this.armies.set(entityId, { ...armyData, hexCoords });
      this.armyPaths.delete(entityId);
      this.armyModel.setMovementCompleteCallback(Number(entityId), undefined);
      return;
    }

    // Convert path to world positions
    const worldPath = path.map((pos) => this.getArmyWorldPosition(entityId, pos));

    // Update army position immediately to avoid starting from a "back" position
    this.armies.set(entityId, { ...armyData, hexCoords });
    this.armyPaths.set(entityId, path);

    this.armyModel.setMovementCompleteCallback(entityId, () => {
      this.armyPaths.delete(entityId);
    });

    // Don't remove relic effects during movement - they will follow the army
    // The updateRelicEffectPositions method will handle smooth positioning

    // Start movement in ArmyModel with troop information
    this.armyModel.startMovement(entityId, worldPath, armyData.matrixIndex, armyData.category, armyData.tier);

    // Monitor memory usage after army movement setup
    this.memoryMonitor?.getCurrentStats(`moveArmy-complete-${entityId}`);
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
    const effectsToAdd: Array<{ relicNumber: number; effect: RelicEffect; fx: RelicFxHandle }> = [];
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

          effectsToAdd.push({ relicNumber: newEffect.relicNumber, effect: newEffect.effect, fx: fx as RelicFxHandle });
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

  public removeArmy(entityId: ID, options: { playDefeatFx?: boolean } = {}) {
    const { playDefeatFx = true } = options;

    if (!this.armies.has(entityId)) return;

    const numericEntityId = Number(entityId);
    if (this.activeArmyAttachmentEntities.has(numericEntityId)) {
      this.attachmentManager.removeAttachments(numericEntityId);
      this.activeArmyAttachmentEntities.delete(numericEntityId);
    }
    this.armyAttachmentSignatures.delete(numericEntityId);

    // Monitor memory usage before removing army
    this.memoryMonitor?.getCurrentStats(`removeArmy-${entityId}`);

    console.debug(`[ArmyManager] removeArmy invoked for entity ${entityId}`);

    this.armyPaths.delete(entityId);
    this.armyModel.setMovementCompleteCallback(Number(entityId), undefined);
    this.lastKnownVisibleHexes.delete(entityId);

    // Remove any relic effects
    this.updateRelicEffects(entityId, []);

    // Clear any pending relic effects
    if (this.clearPendingRelicEffectsCallback) {
      this.clearPendingRelicEffectsCallback(entityId);
    }

    // Clear any pending label updates for this army
    if (this.pendingExplorerTroopsUpdate.has(entityId)) {
      console.log(`[PENDING LABEL UPDATE] Clearing pending update for removed army ${entityId}`);
      this.pendingExplorerTroopsUpdate.delete(entityId);
    }

    const army = this.armies.get(entityId);
    if (!army) {
      console.warn(`[ArmyManager] removeArmy called for missing entity ${entityId}`);
      return;
    }

    console.debug(`[ArmyManager] Preparing world cleanup for entity ${entityId}`);
    const worldPosition = this.getArmyWorldPosition(entityId, army.hexCoords);

    this.armies.delete(entityId);
    this.armyModel.removeLabel(entityId);
    this.entityIdLabels.delete(entityId);
    console.debug(`[ArmyManager] Removed entity ${entityId} from caches and labels`);

    if (this.currentChunkKey) {
      console.debug(`[ArmyManager] Rendering visible armies after removing entity ${entityId}`);
      void this.renderVisibleArmies(this.currentChunkKey)
        .then(() => {
          console.debug(`[ArmyManager] Render complete after removing entity ${entityId}`);
        })
        .catch((error) => {
          console.error(`[ArmyManager] Failed to finalize removal for army ${entityId}:`, error);
        });
    } else {
      console.warn(`[ArmyManager] Removal invoked with no active chunk for entity ${entityId}`);
    }

    if (!playDefeatFx) {
      return;
    }

    console.debug(`[ArmyManager] Playing defeat FX for entity ${entityId}`);
    const { promise, instance } = this.fxManager.playFxAtCoords(
      "skull",
      worldPosition.x,
      worldPosition.y + 2,
      worldPosition.z,
      1,
      "Defeated!",
    );

    if (!instance) {
      promise.catch((error) => {
        console.warn(`[ArmyManager] Defeat FX rejected for army ${entityId}:`, error);
      });
      return;
    }

    promise.catch((error) => {
      console.warn(`[ArmyManager] Failed to play defeat FX for army ${entityId}:`, error);
    });
  }

  public getArmies() {
    return Array.from(this.armies.values());
  }

  update(deltaTime: number) {
    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.armyModel.updateAnimations(deltaTime);

    // Update point icon positions for moving armies
    if (this.pointsRenderers) {
      const instanceDataMap = (this.armyModel as unknown as { instanceData?: Map<number, ArmyInstanceData> })
        .instanceData as Map<number, ArmyInstanceData> | undefined;

      if (instanceDataMap) {
        this.visibleArmies.forEach((army) => {
          const instanceData = instanceDataMap.get(army.entityId);
          if (instanceData && instanceData.isMoving) {
            // Get current interpolated position
            const iconPosition = instanceData.position.clone();
            iconPosition.y += 2.1; // Match CSS2D label height

            // Update point in appropriate renderer
            const renderer = army.isDaydreamsAgent
              ? this.pointsRenderers!.agent
              : army.isMine
                ? this.pointsRenderers!.player
                : this.pointsRenderers!.enemy;
            renderer.setPoint({
              entityId: army.entityId,
              position: iconPosition,
            });
          }
        });
      }
    }

    // Update relic effect positions to follow moving armies
    this.updateArmyAttachmentTransforms();
    this.updateRelicEffectPositions();

    if (this.frustumVisibilityDirty) {
      this.applyFrustumVisibilityToLabels();
      this.frustumVisibilityDirty = false;
    }
  }

  private applyFrustumVisibilityToLabels() {
    if (!this.frustumManager) {
      return;
    }

    this.entityIdLabels.forEach((label) => {
      const isVisible = this.frustumManager!.isPointVisible(label.position);
      label.element.style.display = isVisible ? "" : "none";
    });
  }

  private getArmyWorldPosition = (_armyEntityId: ID, hexCoords: Position, isIntermediatePosition: boolean = false) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });

    if (isIntermediatePosition) return basePosition;

    return basePosition;
  };

  private recordLastKnownHexFromWorld(entityId: ID, worldPosition: Vector3) {
    const { col, row } = getHexForWorldPosition(worldPosition);
    const normalized = new Position({ x: col, y: row }).getNormalized();
    this.lastKnownVisibleHexes.set(entityId, { col: normalized.x, row: normalized.y });
  }

  recheckOwnership() {
    this.armies.forEach((army) => {
      army.isMine = isAddressEqualToAccount(army.owner.address);
    });
  }

  private async addEntityIdLabel(army: ArmyData, position: Vector3) {
    const { label } = this.labelPool.acquire(() => {
      const element = createArmyLabel(army, this.currentCameraView);
      const cssLabel = new CSS2DObject(element);
      cssLabel.userData.baseRenderOrder = cssLabel.renderOrder;
      return cssLabel;
    });

    label.position.copy(position);
    label.position.y += 2.1;
    label.userData.entityId = army.entityId;

    this.configureArmyLabelInteractions(label);

    this.entityIdLabels.set(army.entityId, label);
    this.armyModel.addLabel(army.entityId, label);

    this.updateArmyLabelData(army.entityId, army, label);
    this.frustumVisibilityDirty = true;
  }

  public showLabel(entityId: ID): void {
    const army = this.armies.get(entityId);
    if (!army) {
      return;
    }

    const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
    if (this.entityIdLabels.has(army.entityId)) {
      const label = this.entityIdLabels.get(army.entityId)!;
      label.position.copy(position);
      label.position.y += 1.5;
      this.updateArmyLabelData(entityId, army, label);

      // Highlight point icon on hover
      if (this.pointsRenderers) {
        const renderer = army.isDaydreamsAgent
          ? this.pointsRenderers.agent
          : army.isMine
            ? this.pointsRenderers.player
            : this.pointsRenderers.enemy;
        renderer.setHover(entityId);
      }
      return;
    }

    this.addEntityIdLabel(army, position);

    // Highlight point icon on hover
    if (this.pointsRenderers) {
      const renderer = army.isDaydreamsAgent
        ? this.pointsRenderers.agent
        : army.isMine
          ? this.pointsRenderers.player
          : this.pointsRenderers.enemy;
      renderer.setHover(entityId);
    }
    this.frustumVisibilityDirty = true;
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);

    // Remove hover highlight from point icon
    if (this.pointsRenderers) {
      [
        this.pointsRenderers.player,
        this.pointsRenderers.enemy,
        this.pointsRenderers.ally,
        this.pointsRenderers.agent,
      ].forEach((renderer) => renderer.clearHover());
    }
    this.frustumVisibilityDirty = true;
  }

  public hideAllLabels(): void {
    Array.from(this.entityIdLabels.keys()).forEach((armyId) => this.removeEntityIdLabel(armyId));

    // Clear hover highlight from all points
    if (this.pointsRenderers) {
      [
        this.pointsRenderers.player,
        this.pointsRenderers.enemy,
        this.pointsRenderers.ally,
        this.pointsRenderers.agent,
      ].forEach((renderer) => renderer.clearHover());
    }
    this.frustumVisibilityDirty = true;
  }

  removeLabelsFromScene() {
    this.armyModel.removeLabelsFromScene();
  }

  removeLabelsExcept(entityId?: ID) {
    this.armyModel.removeLabelsExcept(entityId ? Number(entityId) : undefined);
  }

  addLabelsToScene() {
    this.armyModel.addLabelsToScene();
  }

  private removeEntityIdLabel(entityId: ID) {
    const label = this.entityIdLabels.get(entityId);
    if (!label) {
      return;
    }

    this.armyModel.removeLabel(Number(entityId));
    this.labelPool.release(label);
    this.entityIdLabels.delete(entityId);
    this.frustumVisibilityDirty = true;
  }

  private configureArmyLabelInteractions(label: CSS2DObject): void {
    const element = label.element as HTMLElement;
    const baseRenderOrder = (label.userData.baseRenderOrder as number | undefined) ?? label.renderOrder;
    label.userData.baseRenderOrder = baseRenderOrder;

    element.onmouseenter = () => {
      label.renderOrder = Infinity;
    };

    element.onmouseleave = () => {
      label.renderOrder = baseRenderOrder;
    };
  }

  private initializePointsRenderers(): void {
    const textureLoader = new THREE.TextureLoader();

    // Load all 3 army icon textures (agent uses player texture as fallback)
    const texturePaths = {
      player: "/images/labels/army.png",
      enemy: "/images/labels/enemy_army.png",
      ally: "/images/labels/allies_army.png",
    };

    const loadedTextures: Partial<Record<keyof typeof texturePaths, THREE.Texture>> = {};
    let loadedCount = 0;
    const totalTextures = Object.keys(texturePaths).length;

    Object.entries(texturePaths).forEach(([key, path]) => {
      textureLoader.load(
        path,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;

          loadedTextures[key as keyof typeof texturePaths] = texture;
          loadedCount++;

          // When all textures are loaded, create the renderers
          if (loadedCount === totalTextures) {
            // Use player texture for agent as fallback
            this.pointsRenderers = {
              player: new PointsLabelRenderer(this.scene, loadedTextures.player!, 1000, 5, 0, 1.3, true, this.frustumManager),
              enemy: new PointsLabelRenderer(this.scene, loadedTextures.enemy!, 1000, 5, 0, 1.3, true, this.frustumManager),
              ally: new PointsLabelRenderer(this.scene, loadedTextures.ally!, 1000, 5, 0, 1.3, true, this.frustumManager),
              agent: new PointsLabelRenderer(this.scene, loadedTextures.player!, 1000, 5, 0, 1.3, true, this.frustumManager),
            };

            console.log("[ArmyManager] Points-based icon renderers initialized with params:", {
              maxPoints: 1000,
              pointSize: 5,
              hoverScale: 0,
              hoverBrightness: 1.3,
              sizeAttenuation: true,
            });

            // Re-render visible armies to populate points
            if (this.currentChunkKey) {
              console.log("[ArmyManager] Re-rendering armies after points renderer init, chunk:", this.currentChunkKey);
              this.renderVisibleArmies(this.currentChunkKey);
            }
          }
        },
        undefined,
        (error) => {
          console.error(`[ArmyManager] Failed to load army icon texture (${key}):`, error);
        },
      );
    });
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) return;
    this.currentCameraView = view;

    // Update the ArmyModel's camera view
    this.armyModel.setCurrentCameraView(view);

    // Apply label transitions using the centralized function
    applyLabelTransitions(this.entityIdLabels, view);
  };

  public isArmySelectable(entityId: ID): boolean {
    // Check if army exists in our data
    if (!this.armies.has(entityId)) {
      return false;
    }

    // Check if we're currently switching chunks
    if (this.chunkSwitchPromise) {
      return false;
    }

    // Check if army is in the visible armies list
    return this.visibleArmies.some((army) => army.entityId === entityId);
  }

  public hasArmy(entityId: ID): boolean {
    return this.armies.has(entityId) && this.isArmySelectable(entityId);
  }

  /**
   * Debug method to test material sharing effectiveness
   */
  public logMaterialSharingStats(): void {
    const stats = this.armyModel.getMaterialSharingStats();
    const efficiency = stats.materialPoolStats.totalReferences / Math.max(stats.materialPoolStats.uniqueMaterials, 1);
    const theoreticalWaste = stats.totalMeshes - stats.materialPoolStats.uniqueMaterials;

    console.log(`
🎨 MATERIAL SHARING TEST RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Model Stats:
   • Loaded Models: ${stats.loadedModels}
   • Total Meshes: ${stats.totalMeshes}

🎯 Material Pool Stats:
   • Unique Materials: ${stats.materialPoolStats.uniqueMaterials}
   • Total References: ${stats.materialPoolStats.totalReferences}
   • Sharing Efficiency: ${efficiency.toFixed(1)}:1
   • Memory Saved: ~${stats.materialPoolStats.memoryEstimateMB}MB

💾 Theoretical Comparison:
   • Without Sharing: ${stats.totalMeshes} materials
   • With Sharing: ${stats.materialPoolStats.uniqueMaterials} materials
   • Materials Saved: ${theoreticalWaste} (${((theoreticalWaste / stats.totalMeshes) * 100).toFixed(1)}%)
   • Est. Memory Saved: ${(theoreticalWaste * 0.005).toFixed(1)}MB

${
  efficiency > 5
    ? "✅ EXCELLENT sharing efficiency!"
    : efficiency > 2
      ? "✅ GOOD sharing efficiency"
      : "⚠️  Low sharing efficiency - check for duplicate materials"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
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
        // Use reusable vector to avoid cloning every frame
        this.tempPosition.copy(instanceData.position);
        this.tempPosition.y += 1.5; // Relic effects are positioned 1.5 units above the army

        relicEffects.forEach((relicEffect) => {
          // Update the position of each relic effect to follow the army
          if (relicEffect.fx.instance) {
            // Update the base position that the orbital animation uses
            relicEffect.fx.instance.initialX = this.tempPosition.x;
            relicEffect.fx.instance.initialY = this.tempPosition.y;
            relicEffect.fx.instance.initialZ = this.tempPosition.z;
          }
        });
      }
    });
  }

  /**
   * Recompute stamina for all armies and update visible labels when armies tick changes
   */
  private recomputeStaminaForAllArmies(): void {
    const { currentArmiesTick } = getBlockTimestamp();

    // Update all army data in cache
    this.armies.forEach((army, entityId) => {
      // Calculate current stamina using StaminaManager with the last known stamina values
      const updatedStamina = Number(
        StaminaManager.getStamina(
          {
            category: army.category,
            tier: army.tier,
            count: BigInt(army.troopCount),
            stamina: {
              amount: BigInt(army.onChainStamina.amount),
              updated_tick: BigInt(army.onChainStamina.updatedTick),
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
        ).amount,
      );

      // Update cached army data with new stamina
      army.currentStamina = updatedStamina;

      // Update visible label if it exists
      const label = this.entityIdLabels.get(entityId);
      if (label) {
        this.updateArmyLabelData(entityId, army, label);
      }
    });
  }

  /**
   * Recompute battle timers for all armies and update visible labels every second
   */
  private recomputeBattleTimersForAllArmies(): void {
    // Update all army data with active battle timers
    this.armies.forEach((army, entityId) => {
      if (army.battleCooldownEnd) {
        const newBattleTimerLeft = getBattleTimerLeft(army.battleCooldownEnd);

        // Only update if timer has changed or expired
        if (army.battleTimerLeft !== newBattleTimerLeft) {
          army.battleTimerLeft = newBattleTimerLeft;

          // Update visible label if it exists
          const label = this.entityIdLabels.get(entityId);
          if (label) {
            this.updateArmyLabelData(entityId, army, label);
          }
        }
      }
    });
  }

  /**
   * Update an army label with fresh data
   */
  private updateArmyLabelData(_entityId: ID, army: ArmyData, existingLabel: CSS2DObject): void {
    // Update the existing label content in-place with correct camera view
    updateArmyLabel(existingLabel.element, army, this.currentCameraView);
  }

  /**
   * Update army battle direction and label
   */
  public updateBattleDirection(entityId: ID, degrees: number | undefined, role: "attacker" | "defender"): void {
    const army = this.armies.get(entityId);
    if (!army) return;

    // Update degrees based on role
    if (role === "attacker") {
      army.attackedTowardDegrees = degrees;
    } else {
      army.attackedFromDegrees = degrees;
    }

    // Update label
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.updateArmyLabelData(entityId, army, label);
    }
  }

  /**
   * Update army label from system update (troop count/stamina changes)
   */
  public updateArmyFromExplorerTroopsUpdate(update: ExplorerTroopsSystemUpdate): void {
    const army = this.armies.get(update.entityId);
    console.log("[UPDATING ARMY LABEL FROM SYSTEM UPDATE]", { army });

    // If army doesn't exist yet, store the update as pending
    if (!army) {
      const currentTime = Date.now();
      const currentTick = update.onChainStamina.updatedTick;

      // Check if we already have a pending update for this entity
      const existingPending = this.pendingExplorerTroopsUpdate.get(update.entityId);

      // Only store if this is newer than the existing pending update
      if (!existingPending || currentTick >= existingPending.updateTick) {
        console.log(`[PENDING LABEL UPDATE] Storing pending update for army ${update.entityId} (tick: ${currentTick})`);
        const ownerStructureId = (update as { ownerStructureId?: ID | null }).ownerStructureId ?? null;
        this.pendingExplorerTroopsUpdate.set(update.entityId, {
          troopCount: update.troopCount,
          onChainStamina: update.onChainStamina,
          ownerAddress: update.ownerAddress,
          ownerName: update.ownerName,
          timestamp: currentTime,
          updateTick: currentTick,
          ownerStructureId,
          // Note: ExplorerTroopsSystemUpdate doesn't have battle degrees data
          // Degrees would need to come from tile updates
          attackedFromDegrees: undefined,
          attackedTowardDegrees: undefined,
          battleCooldownEnd: update.battleCooldownEnd,
          battleTimerLeft: getBattleTimerLeft(update.battleCooldownEnd),
        });
      } else {
        console.log(
          `[PENDING LABEL UPDATE] Ignoring older pending update for army ${update.entityId} (tick: ${currentTick} vs ${existingPending.updateTick})`,
        );
      }
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
      ).amount,
    );

    army.troopCount = update.troopCount;

    let resolvedOwnerAddress =
      typeof update.ownerAddress === "bigint" ? update.ownerAddress : BigInt(update.ownerAddress ?? 0);
    let resolvedOwnerName = update.ownerName;

    if (update.ownerStructureId !== null && update.ownerStructureId !== undefined && this.components?.Structure) {
      try {
        const structureEntityId = getEntityIdFromKeys([BigInt(update.ownerStructureId)]);
        const liveStructure = getComponentValue(this.components.Structure, structureEntityId);

        if (liveStructure) {
          const liveOwnerRaw = liveStructure.owner;
          if (liveOwnerRaw !== undefined && liveOwnerRaw !== null) {
            resolvedOwnerAddress = typeof liveOwnerRaw === "bigint" ? liveOwnerRaw : BigInt(liveOwnerRaw ?? 0);

            if (this.components.AddressName) {
              const addressName = getComponentValue(
                this.components.AddressName,
                getEntityIdFromKeys([resolvedOwnerAddress]),
              );

              if (addressName?.name) {
                try {
                  resolvedOwnerName = shortString.decodeShortString(addressName.name.toString());
                } catch (error) {
                  console.warn(
                    `[ArmyManager] Failed to decode owner name during explorer update for army ${update.entityId}:`,
                    error,
                  );
                }
              }
            }

            if (!resolvedOwnerName || resolvedOwnerName.length === 0) {
              resolvedOwnerName = `0x${resolvedOwnerAddress.toString(16)}`;
            }
          }
        }
      } catch (error) {
        console.warn(
          `[ArmyManager] Failed to resolve owner from Structure component during explorer update for army ${update.entityId}:`,
          error,
        );
      }
    }

    army.owner.address = resolvedOwnerAddress;
    army.owner.ownerName = resolvedOwnerName;
    army.owningStructureId = update.ownerStructureId;
    // Update ownership status - this ensures armies are correctly marked as owned when the user's account
    // becomes available after initial load, since tile updates may occur before account authentication
    army.isMine = isAddressEqualToAccount(resolvedOwnerAddress);
    army.onChainStamina = update.onChainStamina;
    army.battleCooldownEnd = update.battleCooldownEnd;
    army.battleTimerLeft = getBattleTimerLeft(update.battleCooldownEnd);
    const ownerStructureId = (update as { ownerStructureId?: ID | null }).ownerStructureId ?? null;
    if (ownerStructureId) {
      army.owningStructureId = ownerStructureId;
    }

    // Update the label if it exists
    const label = this.entityIdLabels.get(update.entityId);
    if (label) {
      this.updateArmyLabelData(update.entityId, army, label);
    }
  }

  public destroy() {
    if (this.unsubscribeFrustum) {
      this.unsubscribeFrustum();
      this.unsubscribeFrustum = undefined;
    }

    if (this.unsubscribeAccountStore) {
      this.unsubscribeAccountStore();
      this.unsubscribeAccountStore = undefined;
    }

    // Clean up camera view listener
    if (this.hexagonScene) {
      this.hexagonScene.removeCameraViewListener(this.handleCameraViewChange);
    }

    // Clean up tick check timeout
    if (this.tickCheckTimeout) {
      clearTimeout(this.tickCheckTimeout);
      this.tickCheckTimeout = null;
    }

    // Clean up pending updates cleanup timeout
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // Clear any remaining pending updates
    if (this.pendingExplorerTroopsUpdate.size > 0) {
      console.log(
        `[PENDING UPDATES CLEANUP] Clearing ${this.pendingExplorerTroopsUpdate.size} remaining pending updates on destroy`,
      );
      this.pendingExplorerTroopsUpdate.clear();
    }

    // Clean up relic effects
    for (const [entityId] of this.armyRelicEffects) {
      this.updateRelicEffects(entityId, []);
    }

    this.entityIdLabels.forEach((label, entityId) => {
      this.armyModel.removeLabel(Number(entityId));
      this.labelPool.release(label);
    });
    this.entityIdLabels.clear();

    this.armyPaths.clear();

    // Dispose army model resources including shared materials
    this.armyModel.dispose();

    // Tear down FX to avoid lingering RAF loops and textures
    this.fxManager.destroy();

    // Clear label pool storage after dispose ensures detached DOM
    this.labelPool.clear();

    this.attachmentManager.clear();
    this.activeArmyAttachmentEntities.clear();
    this.armyAttachmentSignatures.clear();

    // Clean up points renderers
    if (this.pointsRenderers) {
      this.pointsRenderers.player.dispose();
      this.pointsRenderers.enemy.dispose();
      this.pointsRenderers.ally.dispose();
      this.pointsRenderers.agent.dispose();
    }

    // Clean up any other resources...
  }
}
