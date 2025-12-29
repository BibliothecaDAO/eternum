import { useAccountStore } from "@/hooks/store/use-account-store";
import { ArmyModel } from "@/three/managers/army-model";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playerColorManager, PlayerColorProfile } from "@/three/systems/player-colors";
import { ModelType } from "@/three/types/army";
import { GUIManager } from "@/three/utils/";
import { FrustumManager } from "@/three/utils/frustum-manager";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import type { SetupResult } from "@bibliothecadao/dojo";
import { Position } from "@bibliothecadao/eternum";

import { ExplorerTroopsSystemUpdate, ExplorerTroopsTileSystemUpdate, getBlockTimestamp } from "@bibliothecadao/eternum";

import { gameWorkerManager } from "@/managers/game-worker-manager";
import { Biome, configManager, StaminaManager } from "@bibliothecadao/eternum";
import { ClientComponents, ContractAddress, ID, RelicEffect, TroopTier, TroopType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { shortString } from "starknet";
import * as THREE from "three";
import { Color, Euler, Group, Raycaster, Scene, Vector3 } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { env } from "../../../env";
import type { AttachmentTransform, CosmeticAttachmentTemplate } from "../cosmetics";
import {
  CosmeticAttachmentManager,
  playerCosmeticsStore,
  resolveArmyCosmetic,
  resolveArmyMountTransforms,
} from "../cosmetics";
import { ArmyData, RenderChunkSize } from "../types";
import { getHexForWorldPosition, getWorldPositionForHex, hashCoordinates } from "../utils";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getBattleTimerLeft, getCombatAngles } from "../utils/combat-directions";
import { createArmyLabel, updateArmyLabel } from "../utils/labels/label-factory";
import { LabelPool } from "../utils/labels/label-pool";
import { applyLabelTransitions } from "../utils/labels/label-transitions";
import { MemoryMonitor } from "../utils/memory-monitor";
import { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { FXManager } from "./fx-manager";
import { PathRenderer } from "./path-renderer";
import { PointsLabelRenderer } from "./points-label-renderer";

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
  private visibleArmyOrder: ID[] = [];
  private visibleArmyIndices: Map<ID, number> = new Map();
  private renderQueuePromise: Promise<void> | null = null;
  private renderQueueActive = false;
  private pendingRenderChunkKey: string | null = null;
  private pendingRenderOptions: { force?: boolean } | null = null;
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
  private lastLabelVisibilityUpdate = 0;
  private labelVisibilityIntervalMs = 66;
  private unsubscribeFrustum?: () => void;
  private visibilityManager?: CentralizedVisibilityManager;
  private unsubscribeVisibility?: () => void;
  private pendingExplorerTroopsUpdate: Map<ID, PendingExplorerTroopsUpdate> = new Map();
  private lastKnownArmiesTick: number = 0;
  private tickCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private memoryMonitor?: MemoryMonitor;
  private unsubscribeAccountStore?: () => void;
  private attachmentManager: CosmeticAttachmentManager;
  private armyAttachmentSignatures: Map<number, string> = new Map();
  private activeArmyAttachmentEntities: Set<number> = new Set();
  private armyAttachmentTransformScratch = new Map<string, AttachmentTransform>();
  private chunkToArmies: Map<string, Set<ID>> = new Map();
  private chunkStride: number;
  private needsSpatialReindex = false;
  // Track source buckets for moving armies to keep them visible during animation
  private movingArmySourceBuckets: Map<ID, string> = new Map();

  // Path visualization
  private pathRenderer: PathRenderer;
  private selectedArmyForPath: ID | null = null;

  // Reusable objects for memory optimization
  private readonly tempPosition: Vector3 = new Vector3();
  private readonly tempCosmeticPosition: Vector3 = new Vector3();
  private readonly tempIconPosition: Vector3 = new Vector3();

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    dojoContext?: SetupResult,
    applyPendingRelicEffectsCallback?: (entityId: ID) => Promise<void>,
    clearPendingRelicEffectsCallback?: (entityId: ID) => void,
    frustumManager?: FrustumManager,
    visibilityManager?: CentralizedVisibilityManager,
    chunkStride?: number,
  ) {
    this.scene = scene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.armyModel = new ArmyModel(scene, labelsGroup, this.currentCameraView);
    this.scale = new Vector3(0.3, 0.3, 0.3);
    this.renderChunkSize = renderChunkSize;
    // Keep chunk stride aligned with world chunk size so visibility/fetch math matches.
    this.chunkStride = Math.max(1, chunkStride ?? Math.floor(this.renderChunkSize.width / 2));
    this.needsSpatialReindex = true;
    this.frustumManager = frustumManager;
    this.visibilityManager = visibilityManager;
    if (this.frustumManager) {
      this.frustumVisibilityDirty = true;
      this.unsubscribeFrustum = this.frustumManager.onChange(() => {
        this.frustumVisibilityDirty = true;
      });
    }
    if (this.visibilityManager) {
      this.frustumVisibilityDirty = true;
      this.unsubscribeVisibility = this.visibilityManager.onChange(() => {
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
      });
    }

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    // Initialize points-based icon renderers
    this.initializePointsRenderers();

    // Initialize path renderer for movement visualization
    this.pathRenderer = PathRenderer.getInstance();
    this.pathRenderer.initialize(scene);

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

    // Debug Army Spawner - for performance testing
    this.setupDebugArmySpawner();

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

      // Schedule next cleanup
      this.cleanupTimeout = setTimeout(cleanup, 60000);
    };

    // Start initial cleanup after 60 seconds
    this.cleanupTimeout = setTimeout(cleanup, 60000);
  }

  // Debug army spawner state
  private debugArmyEntityIdCounter = 900000; // Start high to avoid collisions with real armies
  private debugSpawnedArmyIds: Set<ID> = new Set();

  /**
   * Setup debug GUI for spawning multiple armies for performance testing
   */
  private setupDebugArmySpawner(): void {
    const debugFolder = GUIManager.addFolder("Debug Army Spawner");

    const spawnParams = {
      count: 20,
      spread: 10,
      troopType: "Paladin" as "Knight" | "Crossbowman" | "Paladin",
      troopTier: "T1" as "T1" | "T2" | "T3",
      mixTypes: true,
      mixTiers: false,
      isMine: false,
    };

    debugFolder.add(spawnParams, "count", 1, 100, 1).name("Army Count");
    debugFolder.add(spawnParams, "spread", 1, 30, 1).name("Spread (hexes)");
    debugFolder.add(spawnParams, "troopType", ["Knight", "Crossbowman", "Paladin"]).name("Troop Type");
    debugFolder.add(spawnParams, "troopTier", ["T1", "T2", "T3"]).name("Troop Tier");
    debugFolder.add(spawnParams, "mixTypes").name("Mix Types");
    debugFolder.add(spawnParams, "mixTiers").name("Mix Tiers");
    debugFolder.add(spawnParams, "isMine").name("Is Mine");

    debugFolder
      .add(
        {
          spawnArmies: () => {
            this.spawnDebugArmies(spawnParams);
          },
        },
        "spawnArmies",
      )
      .name("Spawn Armies");

    debugFolder
      .add(
        {
          clearDebugArmies: () => {
            this.clearDebugArmies();
          },
        },
        "clearDebugArmies",
      )
      .name("Clear Debug Armies");

    // Stats display (read-only) - use closure to capture `this`
    const self = this;
    const statsParams = {
      debugArmyCount: "Debug: 0",
      totalArmyCount: "Total: 0",
      visibleArmyCount: "Visible: 0",
    };

    // Update stats periodically
    const updateStats = () => {
      statsParams.debugArmyCount = `Debug: ${self.debugSpawnedArmyIds?.size ?? 0}`;
      statsParams.totalArmyCount = `Total: ${self.armies?.size ?? 0}`;
      statsParams.visibleArmyCount = `Visible: ${self.visibleArmyOrder?.length ?? 0}`;
    };
    setInterval(updateStats, 500);

    const statsFolder = debugFolder.addFolder("Stats");
    statsFolder.add(statsParams, "debugArmyCount").name("Debug Armies").listen();
    statsFolder.add(statsParams, "totalArmyCount").name("Total Armies").listen();
    statsFolder.add(statsParams, "visibleArmyCount").name("Visible Armies").listen();
    statsFolder.open();

    debugFolder.close();
  }

  /**
   * Spawn multiple debug armies around the current view center
   */
  private spawnDebugArmies(params: {
    count: number;
    spread: number;
    troopType: "Knight" | "Crossbowman" | "Paladin";
    troopTier: "T1" | "T2" | "T3";
    mixTypes: boolean;
    mixTiers: boolean;
    isMine: boolean;
  }): void {
    if (!this.currentChunkKey) {
      console.warn("[Debug Spawner] No current chunk key available");
      return;
    }

    // Parse current chunk to get center position
    const [startRow, startCol] = this.currentChunkKey.split(",").map(Number);
    const bounds = this.getChunkBounds(startRow, startCol);
    const centerCol = Math.floor((bounds.minCol + bounds.maxCol) / 2);
    const centerRow = Math.floor((bounds.minRow + bounds.maxRow) / 2);

    const troopTypes: TroopType[] = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin];
    const troopTiers: TroopTier[] = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

    const getTroopType = (index: number): TroopType => {
      if (params.mixTypes) {
        return troopTypes[index % troopTypes.length];
      }
      return TroopType[params.troopType as keyof typeof TroopType];
    };

    const getTroopTier = (index: number): TroopTier => {
      if (params.mixTiers) {
        return troopTiers[index % troopTiers.length];
      }
      return TroopTier[params.troopTier as keyof typeof TroopTier];
    };

    console.log(
      `[Debug Spawner] Spawning ${params.count} armies around (${centerCol}, ${centerRow}) with spread ${params.spread}`,
    );

    // Spawn armies in a spiral pattern for even distribution
    for (let i = 0; i < params.count; i++) {
      const entityId = this.debugArmyEntityIdCounter++;

      // Spiral placement for even distribution
      const angle = i * 2.4; // Golden angle approximation for good distribution
      const radius = Math.sqrt(i) * (params.spread / Math.sqrt(params.count));
      const offsetCol = Math.round(Math.cos(angle) * radius);
      const offsetRow = Math.round(Math.sin(angle) * radius);

      const col = centerCol + offsetCol;
      const row = centerRow + offsetRow;

      const category = getTroopType(i);
      const tier = getTroopTier(i);

      this.debugSpawnedArmyIds.add(entityId);

      this.addArmy({
        entityId,
        hexCoords: new Position({ x: col, y: row }),
        owner: {
          address: params.isMine ? ContractAddress(useAccountStore.getState().account?.address || "0") : BigInt(i + 1),
          ownerName: `Debug Army ${i + 1}`,
          guildName: "Debug Guild",
        },
        category,
        tier,
        isDaydreamsAgent: false,
        troopCount: Math.floor(Math.random() * 100) + 10,
        currentStamina: Math.floor(Math.random() * 100),
        onChainStamina: {
          amount: 100n,
          updatedTick: getBlockTimestamp().currentArmiesTick,
        },
        maxStamina: 100,
      });
    }

    console.log(
      `[Debug Spawner] Spawned ${params.count} armies. Total debug armies: ${this.debugSpawnedArmyIds.size}, Total armies: ${this.armies.size}`,
    );
  }

  /**
   * Clear all debug-spawned armies
   */
  private clearDebugArmies(): void {
    const count = this.debugSpawnedArmyIds.size;
    console.log(`[Debug Spawner] Clearing ${count} debug armies...`);

    for (const entityId of this.debugSpawnedArmyIds) {
      this.removeArmy(entityId, { playDefeatFx: false });
    }

    this.debugSpawnedArmyIds.clear();
    console.log(`[Debug Spawner] Cleared ${count} debug armies. Total armies remaining: ${this.armies.size}`);
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

  async onTileUpdate(update: ExplorerTroopsTileSystemUpdate) {
    await this.armyModel.loadPromise;
    const { entityId, hexCoords, ownerAddress, ownerName, guildName, troopType, troopTier, battleData } = update;
    console.log("[ArmyManager] onTileUpdate for", entityId, "at", hexCoords);

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
      this.moveArmy(entityId, newPosition);
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

  async updateChunk(chunkKey: string, options?: { force?: boolean }) {
    const force = options?.force ?? false;
    await this.armyModel.loadPromise;

    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    // Wait for any ongoing chunk switch to complete first
    if (this.chunkSwitchPromise) {
      // console.log(`[CHUNK SYNC] Waiting for previous chunk switch to complete before switching to ${chunkKey}`);
      try {
        await this.chunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous chunk switch failed:`, error);
      }
    }

    // Check again if chunk key is still different (might have changed while waiting)
    if (!force && this.currentChunkKey === chunkKey) {
      return;
    }

    const previousChunkKey = this.currentChunkKey;
    const chunkChanged = previousChunkKey !== chunkKey;

    if (chunkChanged) {
      // console.log(`[CHUNK SYNC] Switching army chunk from ${this.currentChunkKey} to ${chunkKey}`);
      this.currentChunkKey = chunkKey;
    }

    // Create and track the chunk switch promise
    const renderOptions = { force: force || chunkChanged };
    this.chunkSwitchPromise = this.renderVisibleArmies(chunkKey, renderOptions);

    try {
      await this.chunkSwitchPromise;
    } finally {
      this.chunkSwitchPromise = null;
    }
  }

  private renderVisibleArmies(chunkKey: string, options?: { force?: boolean }): Promise<void> {
    if (!chunkKey) {
      return Promise.resolve();
    }

    this.pendingRenderChunkKey = chunkKey;
    this.pendingRenderOptions = options ?? null;
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
          const renderOptions = this.pendingRenderOptions;
          this.pendingRenderChunkKey = null;
          this.pendingRenderOptions = null;
          if (chunkKey) {
            await this.executeRenderForChunk(chunkKey, renderOptions ?? undefined);
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
      const numericId = this.toNumericId(army.entityId);
      const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);
      modelTypesByEntity.set(army.entityId, modelType);
      requiredModelTypes.add(modelType);
    });

    return { modelTypesByEntity, requiredModelTypes };
  }

  private addVisibleArmy(army: ArmyData, modelType: ModelType): void {
    const numericId = this.toNumericId(army.entityId);
    const slot = this.armyModel.allocateInstanceSlot(numericId);
    this.visibleArmyIndices.set(army.entityId, slot);
    if (!this.visibleArmyOrder.includes(army.entityId)) {
      this.visibleArmyOrder.push(army.entityId);
    }
    this.refreshArmyInstance(army, slot, modelType);
  }

  private refreshArmyInstance(army: ArmyData, slot: number, modelType: ModelType, reResolveCosmetics?: boolean): void {
    const numericId = this.toNumericId(army.entityId);
    const path = this.armyPaths.get(army.entityId);

    let sourceHex = army.hexCoords;
    if (path && path.length > 0) {
      sourceHex = path[0];
    }

    const isMoving = this.armyModel.isEntityMoving(numericId);
    let position: Vector3;
    if (isMoving) {
      position =
        this.armyModel.getEntityWorldPosition(numericId)?.clone() ??
        this.getArmyWorldPosition(army.entityId, sourceHex);
    } else {
      position = this.getArmyWorldPosition(army.entityId, sourceHex);
    }

    this.armyModel.assignModelToEntity(numericId, modelType);

    if (army.isDaydreamsAgent) {
      this.armyModel.setIsAgent(true);
    }

    // Handle cosmetic model assignment
    let cosmeticId = army.cosmeticId;
    let cosmeticAssetPaths = army.cosmeticAssetPaths;

    // Re-resolve cosmetics if requested (for debug mode)
    if (reResolveCosmetics) {
      const cosmetic = resolveArmyCosmetic({
        owner: army.owner.address,
        troopType: army.category,
        tier: army.tier,
        defaultModelType: modelType,
      });
      cosmeticId = cosmetic.cosmeticId;
      cosmeticAssetPaths = cosmetic.registryEntry?.assetPaths;

      // Update army data with new cosmetic info
      army.cosmeticId = cosmeticId;
      army.cosmeticAssetPaths = cosmeticAssetPaths;
      army.attachments = cosmetic.attachments;
    }

    // Check if this is a custom cosmetic skin (not base/default)
    const hasCosmeticSkin =
      cosmeticAssetPaths &&
      cosmeticAssetPaths.length > 0 &&
      cosmeticId &&
      !cosmeticId.endsWith(":base") &&
      !cosmeticId.endsWith(":default");

    if (hasCosmeticSkin) {
      this.armyModel.assignCosmeticToEntity(numericId, cosmeticId!, cosmeticAssetPaths![0]);
    } else {
      // Clear any existing cosmetic assignment
      this.armyModel.clearCosmeticForEntity(numericId);
    }

    const { x, y } = army.hexCoords.getContract();
    const rotationSeed = hashCoordinates(x, y);
    const rotationIndex = Math.floor(rotationSeed * 6);
    const randomRotation = (rotationIndex * Math.PI) / 3;

    this.armyModel.updateInstance(
      numericId,
      slot,
      position,
      this.scale,
      new Euler(0, randomRotation, 0),
      new Color(army.color),
    );

    this.recordLastKnownHexFromWorld(army.entityId, position);

    const activeLabel = this.entityIdLabels.get(army.entityId);
    if (activeLabel) {
      activeLabel.position.copy(position);
      activeLabel.position.y += 1.5;
    }

    this.updateArmyPointIcon(army, position);

    const updatedArmy = { ...army, matrixIndex: slot };
    this.armies.set(army.entityId, updatedArmy);
    this.armyModel.rebindMovementMatrixIndex(numericId, slot);
  }

  private removeVisibleArmy(entityId: ID): number | null {
    const slot = this.visibleArmyIndices.get(entityId);
    if (slot === undefined) {
      return null;
    }

    this.visibleArmyIndices.delete(entityId);
    const orderIndex = this.visibleArmyOrder.indexOf(entityId);
    if (orderIndex !== -1) {
      this.visibleArmyOrder.splice(orderIndex, 1);
    }

    const storedArmy = this.armies.get(entityId);
    if (storedArmy) {
      this.armies.set(entityId, { ...storedArmy, matrixIndex: undefined });
    }

    this.armyPaths.delete(entityId);
    this.lastKnownVisibleHexes.delete(entityId);
    this.removeArmyPointIcon(entityId);
    this.removeEntityIdLabel(entityId);

    const numericId = this.toNumericId(entityId);
    if (this.activeArmyAttachmentEntities.has(numericId)) {
      this.attachmentManager.removeAttachments(numericId);
      this.activeArmyAttachmentEntities.delete(numericId);
      this.armyAttachmentSignatures.delete(numericId);
    }

    this.armyModel.freeInstanceSlot(numericId, slot);
    return slot;
  }

  private updateArmyPointIcon(army: ArmyData, position: Vector3): void {
    if (!this.pointsRenderers) {
      return;
    }

    const iconPosition = this.tempIconPosition.copy(position);
    iconPosition.y += 2.1; // Match CSS2D label height
    const renderer = army.isDaydreamsAgent
      ? this.pointsRenderers.agent
      : army.isMine
        ? this.pointsRenderers.player
        : this.pointsRenderers.enemy;
    renderer.setPoint({
      entityId: army.entityId,
      position: iconPosition,
    });
  }

  private removeArmyPointIcon(entityId: ID): void {
    if (!this.pointsRenderers) {
      return;
    }

    [
      this.pointsRenderers.player,
      this.pointsRenderers.enemy,
      this.pointsRenderers.ally,
      this.pointsRenderers.agent,
    ].forEach((renderer) => {
      if (renderer.hasPoint(entityId)) {
        renderer.removePoint(entityId);
      }
    });
  }

  private syncVisibleSlots(): void {
    this.armyModel.setVisibleSlots(this.visibleArmyIndices.values());
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
      const entityId = this.toNumericId(army.entityId);

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

    this.visibleArmies.forEach((army) => {
      const entityId = this.toNumericId(army.entityId);
      if (!this.activeArmyAttachmentEntities.has(entityId)) {
        return;
      }

      const instanceData = this.armyModel.getInstanceData(entityId);
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

  private async executeRenderForChunk(chunkKey: string, options?: { force?: boolean }): Promise<void> {
    // Ensure centralized visibility state is refreshed when invoked outside the render loop
    this.visibilityManager?.beginFrame();

    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const computeVisibleArmies = () => this.getVisibleArmiesForChunk(startRow, startCol);

    let visibleArmies = computeVisibleArmies();
    let { modelTypesByEntity, requiredModelTypes } = this.collectModelInfo(visibleArmies);

    // Preload all required models once
    if (requiredModelTypes.size > 0) {
      await this.armyModel.preloadModels(requiredModelTypes);
    }

    // Recompute after async work to capture any armies added during preload
    visibleArmies = computeVisibleArmies();
    visibleArmies.sort((a, b) => this.toNumericId(a.entityId) - this.toNumericId(b.entityId));
    ({ modelTypesByEntity } = this.collectModelInfo(visibleArmies));

    let buffersDirty = false;

    const desiredOrder = visibleArmies.map((army) => army.entityId);
    const desiredIds = new Set(desiredOrder);
    const toRemove = this.visibleArmyOrder
      .filter((entityId) => !desiredIds.has(entityId))
      .sort((a, b) => {
        const aNum = this.toNumericId(a);
        const bNum = this.toNumericId(b);
        return aNum - bNum;
      });

    toRemove.forEach((entityId) => {
      const removalResult = this.removeVisibleArmy(entityId);
      if (removalResult !== null) {
        buffersDirty = true;
      }
    });

    visibleArmies
      .filter((army) => !this.visibleArmyIndices.has(army.entityId))
      .forEach((army) => {
        const modelType = modelTypesByEntity.get(army.entityId);
        if (!modelType) {
          return;
        }
        this.addVisibleArmy(army, modelType);
        buffersDirty = true;
      });

    if (options?.force) {
      visibleArmies.forEach((army) => {
        const slot = this.visibleArmyIndices.get(army.entityId);
        const modelType = modelTypesByEntity.get(army.entityId);
        if (slot !== undefined && modelType) {
          // Re-resolve cosmetics on force refresh to pick up debug override changes
          this.refreshArmyInstance(army, slot, modelType, true);
          buffersDirty = true;
        }
      });
    }

    const visibleArmySet = new Set(this.visibleArmyOrder);
    this.entityIdLabels.forEach((_, entityId) => {
      if (!visibleArmySet.has(entityId)) {
        this.removeEntityIdLabel(entityId);
      }
    });

    this.visibleArmyOrder = desiredOrder.filter((id) => this.visibleArmyIndices.has(id));
    this.visibleArmies = this.visibleArmyOrder
      .map((entityId) => this.armies.get(entityId))
      .filter((army): army is ArmyData => Boolean(army));

    this.syncVisibleArmyAttachments(this.visibleArmies);
    this.updateArmyAttachmentTransforms();

    this.syncVisibleSlots();

    if (buffersDirty) {
      this.armyModel.updateAllInstances();
      this.armyModel.computeBoundingSphere();
      this.frustumVisibilityDirty = true;
    }
  }

  private isArmyVisible(army: ArmyData, bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }) {
    const entityIdNumber = this.toNumericId(army.entityId);
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
        // Use destination hex as primary position
        const normalized = army.hexCoords.getNormalized();
        x = normalized.x;
        y = normalized.y;
      }
    }

    // Check if destination position is in bounds
    const destInBounds = x >= bounds.minCol && x <= bounds.maxCol && y >= bounds.minRow && y <= bounds.maxRow;

    // For moving armies, also check if source position is in bounds
    // This ensures armies remain visible throughout their movement across chunk boundaries
    let sourceInBounds = false;
    const sourceBucketKey = this.movingArmySourceBuckets.get(army.entityId);
    if (sourceBucketKey && !destInBounds) {
      // Parse source bucket key to get approximate source position
      const [bucketX, bucketY] = sourceBucketKey.split(",").map(Number);
      // Use bucket center as approximate source position
      const sourceX = (bucketX + 0.5) * this.chunkStride;
      const sourceY = (bucketY + 0.5) * this.chunkStride;
      sourceInBounds =
        sourceX >= bounds.minCol && sourceX <= bounds.maxCol && sourceY >= bounds.minRow && sourceY <= bounds.maxRow;
    }

    if (!destInBounds && !sourceInBounds) {
      return false;
    }

    // Skip frustum culling during chunk updates - bounds check is sufficient.
    // Frustum culling can fail when the camera is still animating to the new chunk position,
    // causing armies to not appear until the next frame/click.
    // The bounds check already ensures we only render armies in the current chunk area.
    return true;
  }

  private getSpatialKey(col: number, row: number): string {
    const bucketX = Math.floor(col / this.chunkStride);
    const bucketY = Math.floor(row / this.chunkStride);
    return `${bucketX},${bucketY}`;
  }

  private getChunkBounds(startRow: number, startCol: number) {
    return getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkStride);
  }

  private updateSpatialIndex(entityId: ID, oldHex: Position | undefined, newHex: Position) {
    if (oldHex) {
      const oldNorm = oldHex.getNormalized();
      const oldKey = this.getSpatialKey(oldNorm.x, oldNorm.y);
      const newNorm = newHex.getNormalized();
      const newKey = this.getSpatialKey(newNorm.x, newNorm.y);

      if (oldKey === newKey) return;

      const oldSet = this.chunkToArmies.get(oldKey);
      if (oldSet) {
        oldSet.delete(entityId);
        if (oldSet.size === 0) {
          this.chunkToArmies.delete(oldKey);
        }
      }
    }

    const newNorm = newHex.getNormalized();
    const newKey = this.getSpatialKey(newNorm.x, newNorm.y);
    let newSet = this.chunkToArmies.get(newKey);
    if (!newSet) {
      newSet = new Set();
      this.chunkToArmies.set(newKey, newSet);
    }
    newSet.add(entityId);
  }

  /**
   * Add an army to a spatial bucket without removing from existing buckets.
   * Used during movement to keep army in both source and destination buckets.
   */
  private addToSpatialBucket(entityId: ID, hex: Position) {
    const norm = hex.getNormalized();
    const key = this.getSpatialKey(norm.x, norm.y);
    let bucket = this.chunkToArmies.get(key);
    if (!bucket) {
      bucket = new Set();
      this.chunkToArmies.set(key, bucket);
    }
    bucket.add(entityId);
  }

  /**
   * Remove army from its tracked source bucket after movement completes.
   */
  private cleanupMovementSourceBucket(entityId: ID) {
    const sourceBucketKey = this.movingArmySourceBuckets.get(entityId);
    if (!sourceBucketKey) {
      return;
    }
    this.movingArmySourceBuckets.delete(entityId);

    const bucket = this.chunkToArmies.get(sourceBucketKey);
    if (bucket) {
      bucket.delete(entityId);
      if (bucket.size === 0) {
        this.chunkToArmies.delete(sourceBucketKey);
      }
    }
  }

  private getVisibleArmiesForChunk(startRow: number, startCol: number): Array<ArmyData> {
    if (this.needsSpatialReindex) {
      this.rebuildSpatialIndex();
    }
    const visibleArmies: ArmyData[] = [];
    const bounds = this.getChunkBounds(startRow, startCol);

    const minCol = bounds.minCol;
    const maxCol = bounds.maxCol;
    const minRow = bounds.minRow;
    const maxRow = bounds.maxRow;

    const startBucketX = Math.floor(minCol / this.chunkStride);
    const endBucketX = Math.floor(maxCol / this.chunkStride);
    const startBucketY = Math.floor(minRow / this.chunkStride);
    const endBucketY = Math.floor(maxRow / this.chunkStride);

    for (let bx = startBucketX; bx <= endBucketX; bx++) {
      for (let by = startBucketY; by <= endBucketY; by++) {
        const key = `${bx},${by}`;
        const armyIds = this.chunkToArmies.get(key);
        if (armyIds) {
          for (const id of armyIds) {
            const army = this.armies.get(id);
            // Double check visibility using the precise check
            if (army && this.isArmyVisible(army, bounds)) {
              visibleArmies.push(army);
            }
          }
        }
      }
    }

    return visibleArmies;
  }

  private rebuildSpatialIndex() {
    this.chunkToArmies.clear();
    this.armies.forEach((army) => {
      this.updateSpatialIndex(army.entityId, undefined, army.hexCoords);
    });
    // Re-add source buckets for armies that are currently moving
    this.movingArmySourceBuckets.forEach((sourceBucketKey, entityId) => {
      let bucket = this.chunkToArmies.get(sourceBucketKey);
      if (!bucket) {
        bucket = new Set();
        this.chunkToArmies.set(sourceBucketKey, bucket);
      }
      bucket.add(entityId);
    });
    this.needsSpatialReindex = false;
  }

  public async addArmy(params: AddArmyParams) {
    if (this.armies.has(params.entityId)) return;

    // Monitor memory usage before adding army
    this.memoryMonitor?.getCurrentStats(`addArmy-${params.entityId}`);
    const numericEntityId = this.toNumericId(params.entityId);

    const { x, y } = params.hexCoords.getContract();
    const biome = Biome.getBiome(x, y);
    const baseModelType = this.armyModel.getModelTypeForEntity(numericEntityId, params.category, params.tier, biome);

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

    // Check for pending label updates and apply them if they exist
    const pendingUpdate = this.pendingExplorerTroopsUpdate.get(params.entityId);
    if (pendingUpdate) {
      // Check if pending update is not too old (max 30 seconds)
      const isPendingStale = Date.now() - pendingUpdate.timestamp > 30000;

      if (isPendingStale) {
        this.pendingExplorerTroopsUpdate.delete(params.entityId);
      } else {
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

    // Extract cosmetic asset paths for potential custom model
    const cosmeticAssetPaths = cosmetic.registryEntry?.assetPaths;
    const hasCosmeticSkin =
      cosmeticAssetPaths &&
      cosmeticAssetPaths.length > 0 &&
      cosmetic.cosmeticId &&
      !cosmetic.cosmeticId.endsWith(":base") &&
      !cosmetic.cosmeticId.endsWith(":default");

    await this.armyModel.preloadModels([resolvedModelType]);
    this.armyModel.assignModelToEntity(numericEntityId, resolvedModelType);

    // If there's a custom cosmetic skin, assign it to the entity
    if (hasCosmeticSkin) {
      this.armyModel.assignCosmeticToEntity(numericEntityId, cosmetic.cosmeticId, cosmeticAssetPaths[0]);
    }

    const isMine = finalOwnerAddress ? isAddressEqualToAccount(finalOwnerAddress) : false;

    // Determine the color based on ownership using the centralized player color system
    // This ensures each unique player gets a distinct, consistent color across the game
    const color = this.getArmyColor({
      isMine,
      isDaydreamsAgent: params.isDaydreamsAgent,
      owner: { address: finalOwnerAddress || 0n },
    });

    this.armies.set(params.entityId, {
      entityId: params.entityId,
      hexCoords: params.hexCoords,
      isMine,
      owningStructureId: finalOwningStructureId,
      owner: {
        address: finalOwnerAddress || 0n,
        ownerName: finalOwnerName,
        guildName: finalGuildName,
      },
      cosmeticId: cosmetic.cosmeticId,
      cosmeticAssetPaths,
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

    this.updateSpatialIndex(params.entityId, undefined, params.hexCoords);

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

  public async moveArmy(entityId: ID, hexCoords: Position) {
    console.log("[ArmyManager] moveArmy called for", entityId, "to", hexCoords);
    // Monitor memory usage before army movement
    this.memoryMonitor?.getCurrentStats(`moveArmy-start-${entityId}`);

    const armyData = this.armies.get(entityId);
    if (!armyData) return;

    const numericEntityId = this.toNumericId(entityId);
    const startPos = armyData.hexCoords.getNormalized();
    const targetPos = hexCoords.getNormalized();

    if (startPos.x === targetPos.x && startPos.y === targetPos.y) return;

    // todo: currently taking max stamina of paladin as max stamina but need to refactor
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin, TroopTier.T3);
    const staminaMax = Number(maxTroopStamina?.staminaMax ?? 0);
    const minTravelCost = configManager.getMinTravelStaminaCost();
    const maxHex = Math.max(0, Math.floor(staminaMax / Math.max(minTravelCost, 1)));

    const path = await gameWorkerManager.findPath(armyData.hexCoords, hexCoords, maxHex);

    if (!path || path.length === 0) {
      // If no path is found, just teleport the army to the target position
      this.armies.set(entityId, { ...armyData, hexCoords });
      return;
    }

    if (path.length < 2) {
      this.armies.set(entityId, { ...armyData, hexCoords });
      this.armyPaths.delete(entityId);
      this.armyModel.setMovementCompleteCallback(numericEntityId, undefined);
      return;
    }

    // Convert path to world positions
    const worldPath = path.map((pos) => this.getArmyWorldPosition(entityId, pos));

    // Track source bucket so army remains visible during movement animation.
    // The spatial index will have the army in BOTH source and destination buckets
    // until movement completes.
    const sourceNorm = armyData.hexCoords.getNormalized();
    const sourceBucketKey = this.getSpatialKey(sourceNorm.x, sourceNorm.y);
    const destNorm = hexCoords.getNormalized();
    const destBucketKey = this.getSpatialKey(destNorm.x, destNorm.y);

    // Only track source if buckets are different
    if (sourceBucketKey !== destBucketKey) {
      this.movingArmySourceBuckets.set(entityId, sourceBucketKey);
    }

    // Add to destination bucket (keep in source bucket too - updateSpatialIndex modified below)
    this.addToSpatialBucket(entityId, hexCoords);
    this.armies.set(entityId, { ...armyData, hexCoords });

    const matrixIndex = armyData.matrixIndex;
    if (matrixIndex === undefined) {
      this.armyPaths.delete(entityId);
      this.armyModel.setMovementCompleteCallback(numericEntityId, undefined);
      // Clean up source bucket tracking since movement won't actually happen
      this.cleanupMovementSourceBucket(entityId);
      return;
    }

    this.armyPaths.set(entityId, path);

    this.armyModel.setMovementCompleteCallback(numericEntityId, () => {
      this.armyPaths.delete(entityId);
      // Remove from source bucket now that movement is complete
      this.cleanupMovementSourceBucket(entityId);
      // Remove path visualization
      this.pathRenderer.removePath(numericEntityId);
    });

    // Don't remove relic effects during movement - they will follow the army
    // The updateRelicEffectPositions method will handle smooth positioning

    // Start movement in ArmyModel with troop information
    this.armyModel.startMovement(numericEntityId, worldPath, matrixIndex, armyData.category, armyData.tier);

    // Create path visualization with player-specific color
    const colorProfile = this.getArmyColorProfile(armyData);
    const displayState = this.selectedArmyForPath === entityId ? "selected" : "moving";
    this.pathRenderer.createPath(numericEntityId, worldPath, colorProfile.primary, displayState);

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

    const numericEntityId = this.toNumericId(entityId);
    if (this.activeArmyAttachmentEntities.has(numericEntityId)) {
      this.attachmentManager.removeAttachments(numericEntityId);
      this.activeArmyAttachmentEntities.delete(numericEntityId);
    }
    this.armyAttachmentSignatures.delete(numericEntityId);

    // Monitor memory usage before removing army
    this.memoryMonitor?.getCurrentStats(`removeArmy-${entityId}`);

    // console.debug(`[ArmyManager] removeArmy invoked for entity ${entityId}`);

    this.armyPaths.delete(entityId);
    this.armyModel.setMovementCompleteCallback(numericEntityId, undefined);
    this.lastKnownVisibleHexes.delete(entityId);

    // Remove path visualization
    this.pathRenderer.removePath(numericEntityId);
    if (this.selectedArmyForPath === entityId) {
      this.selectedArmyForPath = null;
    }

    // Remove any relic effects
    this.updateRelicEffects(entityId, []);

    // Clean up movement source bucket tracking if army was mid-movement
    this.cleanupMovementSourceBucket(entityId);

    // Update spatial index (remove from destination bucket)
    if (this.armies.has(entityId)) {
      const army = this.armies.get(entityId)!;
      const { x, y } = army.hexCoords.getNormalized();
      const key = this.getSpatialKey(x, y);
      const set = this.chunkToArmies.get(key);
      if (set) {
        set.delete(entityId);
        if (set.size === 0) {
          this.chunkToArmies.delete(key);
        }
      }
    }

    // Clear any pending relic effects
    if (this.clearPendingRelicEffectsCallback) {
      this.clearPendingRelicEffectsCallback(entityId);
    }

    // Clear any pending label updates for this army
    if (this.pendingExplorerTroopsUpdate.has(entityId)) {
      // console.log(`[PENDING LABEL UPDATE] Clearing pending update for removed army ${entityId}`);
      this.pendingExplorerTroopsUpdate.delete(entityId);
    }

    const army = this.armies.get(entityId);
    if (!army) {
      // console.warn(`[ArmyManager] removeArmy called for missing entity ${entityId}`);
      return;
    }

    // console.debug(`[ArmyManager] Preparing world cleanup for entity ${entityId}`);
    const worldPosition = this.getArmyWorldPosition(entityId, army.hexCoords);

    const removedSlot = this.removeVisibleArmy(entityId);
    if (removedSlot === null) {
      this.removeArmyPointIcon(entityId);
      this.removeEntityIdLabel(entityId);
    }

    this.armies.delete(entityId);

    if (removedSlot !== null) {
      this.visibleArmies = this.visibleArmyOrder
        .map((visibleId) => this.armies.get(visibleId))
        .filter((visible): visible is ArmyData => Boolean(visible));
      this.syncVisibleSlots();
      this.armyModel.updateAllInstances();
      this.frustumVisibilityDirty = true;
    }

    this.armyModel.releaseEntity(numericEntityId);

    if (!playDefeatFx) {
      return;
    }

    // console.debug(`[ArmyManager] Playing defeat FX for entity ${entityId}`);
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

  public getVisibleCount(): number {
    return this.visibleArmyOrder.length;
  }

  /**
   * Set the selected army for path visualization
   * Shows the full path for the selected army, hides others or shows them as "moving"
   */
  public setSelectedArmyPath(entityId: ID | null): void {
    const previousSelected = this.selectedArmyForPath;
    this.selectedArmyForPath = entityId;

    // Update display states for paths
    if (previousSelected !== null && previousSelected !== entityId) {
      const numericId = this.toNumericId(previousSelected);
      if (this.pathRenderer.hasPath(numericId)) {
        this.pathRenderer.setPathDisplayState(numericId, "moving");
      }
    }

    if (entityId !== null) {
      const numericId = this.toNumericId(entityId);
      if (this.pathRenderer.hasPath(numericId)) {
        this.pathRenderer.setSelectedPath(numericId);
      }
    } else {
      this.pathRenderer.setSelectedPath(null);
    }
  }

  /**
   * Get the selected army for path visualization
   */
  public getSelectedArmyForPath(): ID | null {
    return this.selectedArmyForPath;
  }

  update(deltaTime: number) {
    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.armyModel.updateAnimations(deltaTime);

    // Update FX
    this.fxManager.update(deltaTime);

    // Update path visualization animation
    this.pathRenderer.update(deltaTime);

    // Update path progress for selected army
    if (this.selectedArmyForPath !== null) {
      const numericId = this.toNumericId(this.selectedArmyForPath);
      const progress = this.armyModel.getMovementProgress(numericId);
      if (progress !== undefined) {
        this.pathRenderer.updateProgress(numericId, progress);
      }
    }

    // Batch update: single pass over visible armies for all per-frame operations
    // This consolidates point icons, attachment transforms, and relic effects
    this.updateVisibleArmiesBatched();

    if (this.frustumVisibilityDirty) {
      const now = performance.now();
      if (now - this.lastLabelVisibilityUpdate >= this.labelVisibilityIntervalMs) {
        this.applyFrustumVisibilityToLabels();
        this.frustumVisibilityDirty = false;
        this.lastLabelVisibilityUpdate = now;
      }
    }

    // Flush batched label pool operations to minimize layout thrashing
    this.labelPool.flushBatch();
  }

  /**
   * Batched update for all visible army per-frame operations.
   * Consolidates point icon updates, attachment transforms, and relic effect positions
   * into a single iteration over visibleArmies to reduce iteration overhead.
   */
  private updateVisibleArmiesBatched() {
    const hasPointsRenderers = this.pointsRenderers !== undefined;
    const hasActiveAttachments = this.activeArmyAttachmentEntities.size > 0;
    const hasRelicEffects = this.armyRelicEffects.size > 0;

    // Early exit if nothing to update
    if (!hasPointsRenderers && !hasActiveAttachments && !hasRelicEffects) {
      return;
    }

    // Single pass over visible armies
    for (let i = 0; i < this.visibleArmies.length; i++) {
      const army = this.visibleArmies[i];
      const numericEntityId = this.toNumericId(army.entityId);
      const instanceData = this.armyModel.getInstanceData(numericEntityId);

      // 1. Update point icon positions for moving armies
      if (hasPointsRenderers && instanceData?.isMoving) {
        const iconPosition = this.tempIconPosition.copy(instanceData.position);
        iconPosition.y += 2.1; // Match CSS2D label height

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

      // 2. Update attachment transforms
      if (hasActiveAttachments && this.activeArmyAttachmentEntities.has(numericEntityId)) {
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
        const modelType = this.armyModel.getModelTypeForEntity(numericEntityId, army.category, army.tier, biome);

        const mountTransforms = resolveArmyMountTransforms(
          modelType,
          baseTransform,
          this.armyAttachmentTransformScratch,
        );

        this.attachmentManager.updateAttachmentTransforms(numericEntityId, baseTransform, mountTransforms);
      }

      // 3. Update relic effect positions for moving armies
      if (hasRelicEffects && instanceData?.isMoving) {
        const relicEffects = this.armyRelicEffects.get(army.entityId);
        if (relicEffects) {
          this.tempPosition.copy(instanceData.position);
          this.tempPosition.y += 1.5; // Relic effects are positioned 1.5 units above the army

          for (let j = 0; j < relicEffects.length; j++) {
            const relicEffect = relicEffects[j];
            if (relicEffect.fx.instance) {
              relicEffect.fx.instance.initialX = this.tempPosition.x;
              relicEffect.fx.instance.initialY = this.tempPosition.y;
              relicEffect.fx.instance.initialZ = this.tempPosition.z;
            }
          }
        }
      }
    }
  }

  private applyFrustumVisibilityToLabels() {
    this.entityIdLabels.forEach((label) => {
      const isVisible = this.visibilityManager
        ? this.visibilityManager.isPointVisible(label.position)
        : (this.frustumManager?.isPointVisible(label.position) ?? true);
      if (isVisible) {
        if (label.parent !== this.labelsGroup) {
          this.labelsGroup.add(label);
          label.element.style.display = "";

          // Force update data when showing again to ensure it's fresh
          const entityId = label.userData.entityId;
          const army = this.armies.get(entityId);
          if (army) {
            // Use the internal update function directly to avoid the visibility check in the wrapper
            updateArmyLabel(label.element, army, this.currentCameraView);
          }
        }
      } else {
        if (label.parent === this.labelsGroup) {
          this.labelsGroup.remove(label);
          label.element.style.display = "none";
        }
      }
    });
  }

  private getArmyWorldPosition = (_armyEntityId: ID, hexCoords: Position) => {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    const basePosition = getWorldPositionForHex({ col: hexCoordsX, row: hexCoordsY });
    return basePosition;
  };

  private toNumericId(entityId: ID): number {
    return typeof entityId === "number" ? entityId : Number(entityId ?? 0);
  }

  /**
   * Get the color profile for an army based on ownership
   * Uses the centralized PlayerColorManager for consistent colors across the game
   */
  private getArmyColorProfile(army: {
    isMine: boolean;
    isAlly?: boolean;
    isDaydreamsAgent: boolean;
    owner?: { address: bigint };
  }): PlayerColorProfile {
    return playerColorManager.getProfileForUnit(
      army.isMine,
      army.isAlly ?? false,
      army.isDaydreamsAgent,
      army.owner?.address,
    );
  }

  /**
   * Get the primary color hex string for an army (backward compatible)
   */
  private getArmyColor(army: {
    isMine: boolean;
    isAlly?: boolean;
    isDaydreamsAgent: boolean;
    owner?: { address: bigint };
  }): string {
    const profile = this.getArmyColorProfile(army);
    return `#${profile.primary.getHexString()}`;
  }

  private recordLastKnownHexFromWorld(entityId: ID, worldPosition: Vector3) {
    const { col, row } = getHexForWorldPosition(worldPosition);
    const normalized = new Position({ x: col, y: row }).getNormalized();
    this.lastKnownVisibleHexes.set(entityId, { col: normalized.x, row: normalized.y });
  }

  recheckOwnership() {
    const updatedVisible: ArmyData[] = [];

    this.armies.forEach((army, entityId) => {
      const nextIsMine = isAddressEqualToAccount(army.owner.address);
      const nextColor = this.getArmyColor({
        isMine: nextIsMine,
        isDaydreamsAgent: army.isDaydreamsAgent,
        owner: army.owner,
      });

      if (army.isMine === nextIsMine && army.color === nextColor) {
        return;
      }

      army.isMine = nextIsMine;
      army.color = nextColor;
      this.armies.set(entityId, army);

      const label = this.entityIdLabels.get(entityId);
      if (label) {
        this.updateArmyLabelData(entityId, army, label);
      }

      if (this.visibleArmyIndices.has(entityId)) {
        updatedVisible.push(army);
      }
    });

    if (updatedVisible.length === 0) {
      return;
    }

    updatedVisible.forEach((army) => {
      const slot = this.visibleArmyIndices.get(army.entityId);
      if (slot === undefined) {
        return;
      }
      const numericId = this.toNumericId(army.entityId);
      const { x, y } = army.hexCoords.getContract();
      const biome = Biome.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);
      this.refreshArmyInstance(army, slot, modelType);
    });

    this.visibleArmies = this.visibleArmyOrder
      .map((id) => this.armies.get(id))
      .filter((army): army is ArmyData => Boolean(army));

    this.armyModel.updateAllInstances();
    this.syncVisibleSlots();
    this.frustumVisibilityDirty = true;
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
    // Clear stale lastDataKey from pool recycling to ensure fresh DOM update
    label.userData.lastDataKey = null;

    this.configureArmyLabelInteractions(label);

    this.entityIdLabels.set(army.entityId, label);
    this.armyModel.addLabel(this.toNumericId(army.entityId), label);

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
    this.armyModel.removeLabelsExcept(entityId ? this.toNumericId(entityId) : undefined);
  }

  addLabelsToScene() {
    this.armyModel.addLabelsToScene();
  }

  private removeEntityIdLabel(entityId: ID) {
    const label = this.entityIdLabels.get(entityId);
    if (!label) {
      return;
    }

    this.armyModel.removeLabel(this.toNumericId(entityId));
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
            const scaledPointSize = 5 * 0.5;
            // Use player texture for agent as fallback
            this.pointsRenderers = {
              player: new PointsLabelRenderer(
                this.scene,
                loadedTextures.player!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              enemy: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemy!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              ally: new PointsLabelRenderer(
                this.scene,
                loadedTextures.ally!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
              agent: new PointsLabelRenderer(
                this.scene,
                loadedTextures.player!,
                1000,
                scaledPointSize,
                0,
                1.3,
                true,
                this.frustumManager,
              ),
            };

            // Re-render visible armies to populate points
            if (this.currentChunkKey) {
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
    const qualityShadowsEnabled = this.hexagonScene?.getShadowsEnabledByQuality() ?? true;
    const enableRealShadows = view === CameraView.Close && qualityShadowsEnabled;

    // Keep shadow flags in sync even if view is unchanged (quality can toggle shadows dynamically).
    this.armyModel.setShadowsEnabled(enableRealShadows);
    this.armyModel.setContactShadowsEnabled(!enableRealShadows);

    if (this.currentCameraView === view) {
      return;
    }
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

    // Check if army is in the visible armies list (O(1) lookup vs O(n) scan)
    return this.visibleArmyIndices.has(entityId);
  }

  public hasArmy(entityId: ID): boolean {
    return this.armies.has(entityId) && this.isArmySelectable(entityId);
  }

  /**
   * Debug method to test material sharing effectiveness
   */
  public logMaterialSharingStats(): void {
    if (!import.meta.env.DEV) return;

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
      const instanceData = this.armyModel.getInstanceData(this.toNumericId(entityId));
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
    // Build data key from fields that affect label appearance
    const dataKey = `${army.troopCount}-${army.currentStamina}-${army.battleTimerLeft ?? 0}-${army.isMine}-${army.owner.ownerName}-${army.attackedFromDegrees ?? ""}-${army.attackedTowardDegrees ?? ""}`;

    // Skip DOM update if data hasn't changed (dirty-flag pattern for performance)
    // Only skip if label is currently visible - culled labels need update when shown
    const isVisible = existingLabel.parent === this.labelsGroup;
    if (isVisible && existingLabel.userData.lastDataKey === dataKey) {
      return;
    }

    // If label is culled, mark it dirty so it updates when becoming visible
    if (!isVisible) {
      existingLabel.userData.lastDataKey = null; // Force update on next show
      return;
    }

    // Update the existing label content in-place with correct camera view
    existingLabel.userData.lastDataKey = dataKey;
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
    // console.log("[UPDATING ARMY LABEL FROM SYSTEM UPDATE]", { army });

    // If army doesn't exist yet, store the update as pending
    if (!army) {
      const currentTime = Date.now();
      const currentTick = update.onChainStamina.updatedTick;

      // Check if we already have a pending update for this entity
      const existingPending = this.pendingExplorerTroopsUpdate.get(update.entityId);

      // Only store if this is newer than the existing pending update
      if (!existingPending || currentTick >= existingPending.updateTick) {
        // console.log(`[PENDING LABEL UPDATE] Storing pending update for army ${update.entityId} (tick: ${currentTick})`);
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
      }
      return;
    }

    // Log troop count diff and play visual FX for battle damage/healing
    const previousCount = army.troopCount;
    const newCount = update.troopCount;
    if (previousCount !== newCount) {
      const diff = newCount - previousCount;
      const diffSign = diff > 0 ? "+" : "";
      console.log(
        `[TroopCountDiff] Army #${update.entityId} | Previous: ${previousCount} | Current: ${newCount} | Diff: ${diffSign}${diff}`,
      );

      // Play floating damage/heal FX at the army's position
      const normalizedHex = army.hexCoords.getNormalized();
      const worldPos = getWorldPositionForHex({ col: normalizedHex.x, row: normalizedHex.y });
      this.fxManager.playTroopDiffFx(diff, worldPos.x, worldPos.y + 3, worldPos.z);
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
    // Update color to reflect new ownership
    army.color = this.getArmyColor({
      isMine: army.isMine,
      isDaydreamsAgent: army.isDaydreamsAgent,
      owner: { address: resolvedOwnerAddress },
    });
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

    // Update point icon to reflect ownership change (e.g., player vs enemy)
    this.removeArmyPointIcon(update.entityId);
    const position = this.getArmyWorldPosition(update.entityId, army.hexCoords);
    this.updateArmyPointIcon(army, position);
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
      this.pendingExplorerTroopsUpdate.clear();
    }

    // Clean up relic effects
    for (const [entityId] of this.armyRelicEffects) {
      this.updateRelicEffects(entityId, []);
    }

    this.entityIdLabels.forEach((label, entityId) => {
      this.armyModel.removeLabel(this.toNumericId(entityId));
      this.labelPool.release(label);
    });
    this.entityIdLabels.clear();

    this.armyPaths.clear();
    this.movingArmySourceBuckets.clear();
    this.chunkToArmies.clear();

    // Clear path visualization
    this.pathRenderer.clearAll();
    this.selectedArmyForPath = null;

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

    if (this.unsubscribeVisibility) {
      this.unsubscribeVisibility();
      this.unsubscribeVisibility = undefined;
    }

    // Clean up any other resources...
  }
}
