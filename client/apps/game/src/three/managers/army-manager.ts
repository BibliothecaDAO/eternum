import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { gameWorkerManager } from "@/managers/game-worker-manager";
import type { ProceduralMeleeContactEvent, ProceduralRangedReleaseEvent } from "@/three/characters";
import type { ArrowImpactEvent } from "@/three/projectiles/arrow-projectile-system";
import type { ProceduralImpactAuthority } from "@/three/characters/collision/procedural-impact";
import { createProceduralCollisionBudget } from "@/three/characters/collision/procedural-collision-profile";
import type { RenderMode } from "@/three/render-profile";
import type { ProjectileSweepHit, ProjectileSweepRequest } from "@/three/projectiles/projectile-hit-query";
import {
  ProceduralArmyCharacterLayer,
  type ProceduralArmyCharacterLayerStats,
  type ProceduralArmyCharacterPresentation,
} from "@/three/characters/procedural-army-character-layer";
import {
  PROCEDURAL_CHARACTER_ATTACHMENT_SLOTS,
  reconcileProceduralArmyRepresentations,
  shouldPresentArmyProcedurally,
} from "@/three/characters/procedural-army-representation";
import { resolveArmyOwnerState } from "@/three/managers/army-owner-resolution";
import { ArmyModel } from "@/three/managers/army-model";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
  setWorldmapRenderGauge,
} from "@/three/perf/worldmap-render-diagnostics";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playerColorManager, PlayerColorProfile } from "@/three/systems/player-colors";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain } from "@/three/terrain/terrain-surface";
import type { AnimationVisibilityContext } from "@/three/types/animation";
import { isAnimationPositionVisible } from "@/three/utils/animation-visibility";
import { ModelType } from "@/three/types/army";
import { FrustumManager } from "@/three/utils/frustum-manager";
import { GRAPHICS_DEV_GUI_ENABLED, createGuiFolder } from "@/three/utils/gui-manager";
import { isAddressEqualToAccount } from "@/three/utils/utils";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import type { SetupResult } from "@bibliothecadao/dojo";
import {
  FELT_CENTER,
  Position,
  StaminaManager,
  configManager,
  divideByPrecision,
  getBlockTimestamp,
  recordArmyMovementLatencyPhase,
} from "@bibliothecadao/eternum";
import type {
  ArmySpatialProjectionChange,
  ArmySpatialRenderable,
  WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { ClientComponents, ContractAddress, HexPosition, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { getComponentValue, type ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import * as THREE from "three";
import { Color, Euler, Group, Object3D, Raycaster, Scene, Vector3 } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { env } from "../../../env";
import type { AttachmentTransform, CosmeticAttachmentTemplate, ResolvedCosmeticSkin } from "../cosmetics";
import {
  CosmeticAttachmentManager,
  findCosmeticById,
  playerCosmeticsStore,
  resolveArmyCosmetic,
  resolveArmyMountTransforms,
} from "../cosmetics";
import { ArmyData, RenderChunkSize } from "../types";
import {
  getHexForWorldPosition,
  getWorldPositionForHex,
  getWorldPositionForHexCoordsInto,
  hashCoordinates,
} from "../utils";
import { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { getRenderBounds } from "../utils/chunk-geometry";
import { trackGuiFolder, type TrackableGuiFolder } from "../utils/gui-folder-lifecycle";
import { getBattleTimerLeft, getCombatAngles } from "../utils/combat-directions";
import { createArmyLabel, updateArmyLabel } from "../utils/labels/label-factory";
import { updateStaminaBar } from "../utils/labels/label-components";
import { LabelPool } from "../utils/labels/label-pool";
import { applyLabelTransitions } from "../utils/labels/label-transitions";
import { MemoryMonitor } from "../utils/memory-monitor";
import type { HoverLabelShowResult } from "./hover-label-show-result";
import { removeArmyAttachmentsIfTracked, syncArmyAttachmentState } from "./army-attachment-state";
import { syncArmyAttachmentTransformState } from "./army-attachment-transforms";
import { destroyArmyManagerOwnedResources } from "./army-manager-ownership-lifecycle";
import { refreshVisibleArmyCosmeticsByOwner } from "./army-cosmetics-refresh";
import { FXManager } from "./fx-manager";
import {
  buildArmyLabelLayoutDataKey,
  buildArmyLabelStaminaDataKey,
  syncArmyLabelContentState,
} from "./army-label-content";
import {
  configureArmyLabelHoverPriority,
  initializeArmyLabelState,
  revealArmyLabelState,
} from "./army-label-lifecycle";
import { syncArmyLabelPresentationState } from "./army-label-presentation";
import { removeArmyLabels, syncArmyLabelVisibility } from "./army-label-visibility";
import { PathRenderer } from "./path-renderer";
import { resolveArmyCosmeticPresentation, resolveArmyPresentationPosition } from "./army-instance-presentation";
import { resolveArmyPointLabelSize } from "./army-point-label-policy";
import {
  clearArmyPointHoverState,
  removeArmyPointIconState,
  resolveArmyPointRendererKey,
  setArmyPointHoverState,
  syncArmyPointIconState,
} from "./army-point-visuals";
import { CompactEntityLabelRenderer } from "./compact-entity-label-renderer";
import { resolveArmyCompactEntityLabel, resolveCompactEntityLabelVariant } from "./compact-entity-label-policy";
import { createArmyRecord } from "./army-record";
import { resolveArmyStaminaTickRefresh } from "./army-stamina-tick-policy";
import { finalizeArmyChunkTransition } from "./army-chunk-transition-finalizer";
import { reconcileVisibleArmySet } from "./army-visible-set-reconciler";
import { createManagerVisibilityDiff } from "./manager-visibility-diff";
import { resolvePointLabelTextureFlipY } from "./point-label-texture-policy";
import { PointsLabelRenderer } from "./points-label-renderer";
import { resolveArmySlotCompactionPlan } from "./army-slot-compaction";
import {
  auditArmyRenderIntegrity,
  auditArmySlots,
  type ArmySlotAuditEntry,
  type DrawnSlotPositionEntry,
} from "./army-slot-auditor";
import { reportArmyIntegrityHealOnce } from "./army-integrity-diagnostics";
import { resolveMovementPath } from "./army-move-path";
import { shouldUseWorkerPathForArmy } from "./army-movement-path-strategy";
import { addVisibleArmyOrderEntry, removeVisibleArmyOrderEntry, replaceVisibleArmyOrder } from "./army-visible-order";
import { resolveArmyVisibilityBoundsDecision } from "./army-visibility";
import {
  bindManagerChunkRuntimeState,
  recoverManagerChunkRuntimeAfterStall,
  type RecoverManagerChunkRuntimeAfterStallInput,
  type ManagerChunkUpdateOptions,
  runManagerChunkUpdateRuntime,
} from "./manager-chunk-runtime";
import {
  isCommittedManagerChunk,
  MANAGER_UNCOMMITTED_CHUNK,
  shouldAcceptManagerChunkRequest,
  shouldRunManagerChunkUpdate,
  waitForVisualSettle,
} from "./manager-update-convergence";
import { getRendererDiagnosticActiveMode, snapshotRendererDiagnostics } from "../renderer-diagnostics";
import {
  isFrameBudgetWorkQueueDisposedError,
  scheduleFrameBudgetWork,
  type FrameBudgetWorkScheduler,
} from "../frame-budget-work-queue";
import { gameEntityKey } from "@/dojo/game-scope";

const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;

interface MovingArmySourceState {
  col: number;
  row: number;
}

export interface ArmyMovementPlan {
  entityId: ID;
  numericEntityId: number;
  sourceNormalized: { x: number; y: number };
  targetNormalized: { x: number; y: number };
  targetHexCoords: Position;
  path: Position[];
  worldPath: Vector3[];
  armyCategory: TroopType;
  armyTier: TroopTier;
}

export interface PendingCreationGhostSource {
  armyColor: string;
  sourceScene: Object3D;
}

export interface ProceduralArmyProductionStats extends ProceduralArmyCharacterLayerStats {
  activeRepresentationCount: number;
  fallbackRepresentationCount: number;
  visibleLandArmyCount: number;
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

type ExplorerTroopsComponentValue = ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>;

export class ArmyManager {
  private scene: Scene;
  private armyModel: ArmyModel;
  /** Bounded render and animation resources. Authoritative existence and location live in the projection. */
  private armyPresentations: Map<ID, ArmyData> = new Map();
  private readonly worldSpatialProjection: WorldSpatialProjection;
  private scale: Vector3;
  private currentChunkKey: string | null = MANAGER_UNCOMMITTED_CHUNK;
  private renderChunkSize: RenderChunkSize;
  private visibleArmies: ArmyData[] = [];
  private visibleArmyOrder: ID[] = [];
  private visibleArmyOrderIndices: Map<ID, number> = new Map();
  private visibleArmyIndices: Map<ID, number> = new Map();
  private visibleArmyPresentationDirty = false;
  private visibleArmyBuffersDirty = false;
  private renderQueuePromise: Promise<void> | null = null;
  private renderQueueActive = false;
  private pendingRenderChunkKey: string | null = null;
  private pendingRenderOptions: ManagerChunkUpdateOptions | null = null;
  private armyPaths: Map<ID, Position[]> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelPool = new LabelPool();
  private labelsGroup: Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private components?: ClientComponents;
  private movementStartListeners: Map<number, Set<() => void>> = new Map();
  private movementCompleteListeners: Map<number, Set<() => void>> = new Map();
  private movementVisualCancelListeners: Map<number, Set<() => void>> = new Map();
  private pointsRenderers?: {
    player: PointsLabelRenderer;
    enemy: PointsLabelRenderer;
    ally: PointsLabelRenderer;
    agent: PointsLabelRenderer;
  };
  private compactLabelRenderer: CompactEntityLabelRenderer;
  private frustumManager?: FrustumManager;
  private frustumVisibilityDirty = false;
  private labelRenderDistance = Infinity;
  private lastLabelVisibilityUpdate = 0;
  private labelVisibilityIntervalMs = 66;
  // Keep moving-army culling bounds fresh without paying a full recompute every frame.
  private lastMovingBoundsRefreshAt = Number.NEGATIVE_INFINITY;
  private readonly movingBoundsRefreshIntervalMs = 1000 / 20;
  private hadMovingArmiesLastFrame = false;
  private unsubscribeFrustum?: () => void;
  private visibilityManager?: CentralizedVisibilityManager;
  private unsubscribeVisibility?: () => void;
  private lastKnownArmiesTick: number = 0;
  private unsubscribeChainTime?: () => void;
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private latestTransitionToken = 0;
  private transitionChunkByToken: Map<number, string> = new Map();
  private memoryMonitor?: MemoryMonitor;
  private debugStatsIntervalId?: ReturnType<typeof setInterval>;
  private unsubscribeAccountStore?: () => void;
  private readonly unsubscribeArmyProjection: () => void;
  private unsubscribeExplorerTroopsPresentation?: () => void;
  private readonly armyProjectionSyncs = new Map<ID, Promise<void>>();
  private attachmentManager: CosmeticAttachmentManager;
  private readonly proceduralArmyCharacterLayer: ProceduralArmyCharacterLayer;
  private readonly activeProceduralArmyEntityIds = new Set<number>();
  private readonly desiredProceduralArmyEntityIds = new Set<number>();
  private readonly readyProceduralArmyEntityIds = new Set<number>();
  private readonly proceduralArmyPresentations = new Map<number, ProceduralArmyCharacterPresentation>();
  private readonly proceduralArmyPresentationBuffer: ProceduralArmyCharacterPresentation[] = [];
  private proceduralCharacterPreviewEntityId: ID | null = null;
  private armyAttachmentSignatures: Map<number, string> = new Map();
  private activeArmyAttachmentEntities: Set<number> = new Set();
  private armyAttachmentTransformScratch = new Map<string, AttachmentTransform>();
  private chunkStride: number;
  private isDestroyed = false;
  private isArmyChunkTransitioning = false;
  private deferredArmyQueue: Set<ID> = new Set();
  // Armies that arrived before any chunk was committed — drained on first executeRenderForChunk
  private preCommitArmyQueue: Set<ID> = new Set();
  // Track source buckets for moving armies to keep them visible during animation
  private movingArmySourceBuckets: Map<ID, MovingArmySourceState> = new Map();
  // Armies that have been visually hidden but not yet fully removed — all rendering
  // paths must skip these to prevent ghost units from reappearing during chunk transitions

  // Path visualization
  private pathRenderer: PathRenderer;
  private selectedArmyForPath: ID | null = null;
  private guiFolders: TrackableGuiFolder[] = [];

  // Reusable objects for memory optimization
  private readonly tempCosmeticPosition: Vector3 = new Vector3();
  private readonly tempIconPosition: Vector3 = new Vector3();
  private readonly tempWorldPosition: Vector3 = new Vector3();
  private readonly setProceduralFallbackAttachmentVisibility = (entityId: number, visible: boolean) =>
    this.attachmentManager.setAttachmentSlotsVisible(entityId, PROCEDURAL_CHARACTER_ATTACHMENT_SLOTS, visible);
  private readonly setProceduralFallbackModelVisibility = (entityId: number, visible: boolean) =>
    this.armyModel.setEntityRepresentationVisible(entityId, visible);

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    worldSpatialProjection: WorldSpatialProjection,
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    dojoContext?: SetupResult,
    frustumManager?: FrustumManager,
    visibilityManager?: CentralizedVisibilityManager,
    chunkStride?: number,
    private readonly chunkWorkScheduler?: FrameBudgetWorkScheduler,
  ) {
    this.scene = scene;
    this.worldSpatialProjection = worldSpatialProjection;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.armyModel = new ArmyModel(scene, labelsGroup, this.currentCameraView);
    this.proceduralArmyCharacterLayer = new ProceduralArmyCharacterLayer(scene);
    this.proceduralArmyCharacterLayer.setShadowsEnabled(
      this.currentCameraView === CameraView.Close && (hexagonScene?.getShadowsEnabled() ?? true),
    );
    // Warm boat model up to avoid first shoreline transition rendering as a ghost while GLTF loads.
    void this.armyModel.preloadModels([ModelType.Boat]);
    this.scale = new Vector3(0.3, 0.3, 0.3);
    this.renderChunkSize = renderChunkSize;
    // Keep chunk stride aligned with world chunk size so visibility/fetch math matches.
    this.chunkStride = Math.max(1, chunkStride ?? Math.floor(this.renderChunkSize.width / 2));
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
    this.unsubscribeArmyProjection = worldSpatialProjection.subscribeArmies((changes) => {
      this.handleArmyProjectionChanges(changes);
    });
    this.subscribeToExplorerTroopsPresentation();

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
    this.compactLabelRenderer = new CompactEntityLabelRenderer(scene);

    // Initialize path renderer for movement visualization
    this.pathRenderer = new PathRenderer();
    this.pathRenderer.initialize(scene);
    this.pathRenderer.setVisibilityManager(this.visibilityManager);

    this.setupDebugArmyControls();

    this.unsubscribeAccountStore = useAccountStore.subscribe(() => {
      this.recheckOwnership();
    });

    // Initialize the last known armies tick to current tick
    this.lastKnownArmiesTick = getBlockTimestamp().currentArmiesTick;
    this.unsubscribeChainTime = useChainTimeStore.subscribe(() => this.handleChainTimeAdvanceSafely());
  }

  private subscribeToExplorerTroopsPresentation(): void {
    if (!this.components) return;

    const subscription = this.components.ExplorerTroops.update$.subscribe(({ value }) => {
      const [current] = value as [ExplorerTroopsComponentValue | undefined, ExplorerTroopsComponentValue | undefined];
      if (!current || current.troops.count <= 0n) return;
      this.applyExplorerTroopsPresentationUpdate(current);
    });
    this.unsubscribeExplorerTroopsPresentation = () => subscription.unsubscribe();
  }

  private handleArmyProjectionChanges(changes: readonly ArmySpatialProjectionChange[]): void {
    changes.forEach(({ entityId }) => this.queueArmyProjectionSync(entityId));
  }

  private queueArmyProjectionSync(entityId: ID): void {
    const previous = this.armyProjectionSyncs.get(entityId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => this.preloadMissingProjectedArmyModelsForEntity(entityId))
      .then(() =>
        scheduleFrameBudgetWork(
          this.chunkWorkScheduler,
          "visible",
          () => this.synchronizeArmyProjectionEntity(entityId),
          "manager:army-projection",
        ),
      )
      .catch((error) => {
        if (isFrameBudgetWorkQueueDisposedError(error)) {
          return;
        }
        console.error(`[ArmyManager] Failed to synchronize projected army ${entityId}`, error);
      })
      .finally(() => {
        if (this.armyProjectionSyncs.get(entityId) === current) {
          this.armyProjectionSyncs.delete(entityId);
        }
      });
    this.armyProjectionSyncs.set(entityId, current);
  }

  private async synchronizeArmyProjectionEntity(entityId: ID): Promise<void> {
    const renderable = this.worldSpatialProjection.getArmy(entityId);
    if (!renderable) {
      const explorerTroops = this.resolveLiveExplorerTroopsComponent(entityId);
      const wasDefeated = !explorerTroops || explorerTroops.troops.count <= 0n;
      this.removeArmy(entityId, { playDefeatFx: wasDefeated });
      return;
    }

    const existing = this.armyPresentations.get(entityId);
    if (!existing && !this.isProjectedArmyInCurrentChunk(renderable)) return;

    await this.ensureArmyPresentation(renderable);
  }

  private async ensureArmyPresentation(renderable: ArmySpatialRenderable): Promise<void> {
    const explorerTroops = this.resolveLiveExplorerTroopsComponent(renderable.entityId);
    if (!explorerTroops || explorerTroops.troops.count <= 0n || explorerTroops.coord.alt) return;

    const existing = this.armyPresentations.get(renderable.entityId);
    if (!existing) {
      await this.addArmy(this.buildProjectedArmyPresentation(renderable, explorerTroops));
      return;
    }

    const variantChanged = existing.category !== renderable.troopCategory || existing.tier !== renderable.troopTier;
    existing.category = renderable.troopCategory;
    existing.tier = renderable.troopTier;
    this.applyExplorerTroopsPresentationUpdate(explorerTroops);
    if (variantChanged) this.refreshArmyPositionPresentation(existing);

    const projectedPosition = new Position({ x: renderable.hexCoords.col, y: renderable.hexCoords.row });
    const projectedNormalized = projectedPosition.getNormalized();
    await this.moveArmy(renderable.entityId, projectedPosition);
  }

  private buildProjectedArmyPresentation(
    renderable: ArmySpatialRenderable,
    explorerTroops: ExplorerTroopsComponentValue,
  ): AddArmyParams {
    const ownerStructureId = explorerTroops.owner === 0 ? null : explorerTroops.owner;
    const resolvedOwner = this.resolveArmyOwnerFromStructure({
      armyEntityId: renderable.entityId,
      ownerStructureId,
      fallbackOwnerAddress: 0n,
      fallbackOwnerName: "",
      logContext: "spawn",
    });
    const category = renderable.troopCategory;
    const tier = renderable.troopTier;

    return {
      entityId: renderable.entityId,
      hexCoords: new Position({ x: renderable.hexCoords.col, y: renderable.hexCoords.row }),
      owner: { address: resolvedOwner.ownerAddress, ownerName: resolvedOwner.ownerName, guildName: "" },
      owningStructureId: ownerStructureId,
      category,
      tier,
      isDaydreamsAgent: false,
      troopCount: divideByPrecision(Number(explorerTroops.troops.count)),
      currentStamina: Number(explorerTroops.troops.stamina.amount),
      maxStamina: StaminaManager.getMaxStamina(category, tier),
      battleCooldownEnd: explorerTroops.troops.battle_cooldown_end,
    };
  }

  private async preloadMissingProjectedArmyModelsForEntity(entityId: ID): Promise<void> {
    const renderable = this.worldSpatialProjection.getArmy(entityId);
    if (!renderable || !this.isProjectedArmyInCurrentChunk(renderable)) {
      return;
    }

    await this.preloadMissingProjectedArmyModels([renderable]);
  }

  private async preloadMissingProjectedArmyModels(renderables: readonly ArmySpatialRenderable[]): Promise<void> {
    const requiredModelTypes = new Set<ModelType>();

    for (const renderable of renderables) {
      if (this.armyPresentations.has(renderable.entityId)) {
        continue;
      }

      const explorerTroops = this.resolveLiveExplorerTroopsComponent(renderable.entityId);
      if (!explorerTroops || explorerTroops.troops.count <= 0n || explorerTroops.coord.alt) {
        continue;
      }

      const params = this.buildProjectedArmyPresentation(renderable, explorerTroops);
      const { resolvedModelType } = this.resolveArmyModelSelection(params, params.owner.address ?? 0n);
      requiredModelTypes.add(resolvedModelType);
    }

    if (requiredModelTypes.size > 0) {
      await this.armyModel.preloadModels(requiredModelTypes);
    }
  }

  private resolveLiveExplorerTroopsComponent(entityId: ID): ExplorerTroopsComponentValue | undefined {
    if (!this.components) return undefined;
    return getComponentValue(this.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]));
  }

  private isProjectedArmyInCurrentChunk(renderable: ArmySpatialRenderable): boolean {
    if (!isCommittedManagerChunk(this.currentChunkKey)) return false;
    const [startRow, startCol] = this.currentChunkKey.split(",").map(Number);
    const bounds = this.getChunkBounds(startRow, startCol);
    const normalized = new Position({ x: renderable.hexCoords.col, y: renderable.hexCoords.row }).getNormalized();
    return (
      normalized.x >= bounds.minCol &&
      normalized.x <= bounds.maxCol &&
      normalized.y >= bounds.minRow &&
      normalized.y <= bounds.maxRow
    );
  }

  private handleChainTimeAdvanceSafely(): void {
    try {
      this.handleChainTimeAdvance();
    } catch (error) {
      console.error("[ArmyManager] Failed to apply a chain-time update", error);
    }
  }

  private handleChainTimeAdvance(): void {
    const { currentArmiesTick } = getBlockTimestamp();
    const tickRefresh = resolveArmyStaminaTickRefresh({
      currentTick: currentArmiesTick,
      previousTick: this.lastKnownArmiesTick,
    });
    if (tickRefresh.shouldRecompute) {
      this.lastKnownArmiesTick = tickRefresh.nextTrackedTick;
      this.recomputeStaminaForAllArmies(currentArmiesTick);
    }
    this.recomputeBattleTimersForAllArmies();
  }

  // Debug army spawner state
  private debugArmyEntityIdCounter = 900000; // Start high to avoid collisions with real armies
  private debugSpawnedArmyIds: Set<ID> = new Set();

  private setupDebugArmyControls(): void {
    if (!GRAPHICS_DEV_GUI_ENABLED) {
      return;
    }

    this.setupDebugArmyCreationControls();
    this.setupDebugArmyDeletionControls();
    this.setupDebugArmySpawner();
    this.setupProceduralCharacterPreviewControls();
  }

  private setupProceduralCharacterPreviewControls(): void {
    const folder = trackGuiFolder(this.guiFolders, createGuiFolder("Procedural Army Character"));
    const state = { enabled: false, entityId: 0 };
    const applyTarget = () => {
      const requestedEntityId = state.entityId > 0 ? state.entityId : (this.visibleArmyOrder[0] ?? null);
      this.setProceduralCharacterPreview(state.enabled ? requestedEntityId : null);
    };

    folder.add(state, "enabled").name("Enabled").onChange(applyTarget);
    folder.add(state, "entityId", 0, Number.MAX_SAFE_INTEGER, 1).name("Army entity ID").onFinishChange(applyTarget);
    folder.add({ ragdoll: () => void this.startProceduralCharacterRagdoll() }, "ragdoll").name("Start ragdoll");
    folder.add({ impact: () => void this.applyProceduralCharacterImpulse() }, "impact").name("Apply impact");
    folder.add({ reset: () => this.resetProceduralCharacter() }, "reset").name("Reset actor");
    folder.close();
  }

  private setupDebugArmyCreationControls(): void {
    const createArmyFolder = trackGuiFolder(this.guiFolders, createGuiFolder("Create Army"));
    const createArmyParams = { entityId: 0, col: 0, row: 0, isMine: false };

    createArmyFolder.add(createArmyParams, "entityId").name("Entity ID");
    createArmyFolder.add(createArmyParams, "col").name("Column");
    createArmyFolder.add(createArmyParams, "row").name("Row");
    createArmyFolder.add(createArmyParams, "isMine", [true, false]).name("Is Mine");
    createArmyFolder
      .add(
        {
          addArmy: () => {
            this.addDebugArmyFromControls(createArmyParams);
          },
        },
        "addArmy",
      )
      .name("Add army");
    createArmyFolder.close();
  }

  private addDebugArmyFromControls(input: { col: number; entityId: number; isMine: boolean; row: number }): void {
    this.addArmy({
      entityId: input.entityId,
      hexCoords: new Position({ x: input.col, y: input.row }),
      owner: {
        address: input.isMine ? ContractAddress(useAccountStore.getState().account?.address || "0") : 0n,
        // TODO: Add owner name and guild name
        ownerName: "Neutral",
        guildName: "None",
      },
      category: TroopType.Paladin,
      tier: TroopTier.T1,
      isDaydreamsAgent: false,
      troopCount: 10,
      currentStamina: 10,
      maxStamina: 100,
    });
  }

  private setupDebugArmyDeletionControls(): void {
    const deleteArmyFolder = trackGuiFolder(this.guiFolders, createGuiFolder("Delete Army"));
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
  }

  /**
   * Setup debug GUI for spawning multiple armies for performance testing
   */
  private setupDebugArmySpawner(): void {
    const debugFolder = trackGuiFolder(this.guiFolders, createGuiFolder("Debug Army Spawner"));

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
      statsParams.totalArmyCount = `Total: ${self.armyPresentations?.size ?? 0}`;
      statsParams.visibleArmyCount = `Visible: ${self.visibleArmyOrder?.length ?? 0}`;
    };
    this.debugStatsIntervalId = setInterval(updateStats, 500);

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
    if (!isCommittedManagerChunk(this.currentChunkKey)) {
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
        maxStamina: 100,
      });
    }

    console.log(
      `[Debug Spawner] Spawned ${params.count} armies. Total debug armies: ${this.debugSpawnedArmyIds.size}, Total armies: ${this.armyPresentations.size}`,
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
    console.log(
      `[Debug Spawner] Cleared ${count} debug armies. Total armies remaining: ${this.armyPresentations.size}`,
    );
  }

  public onMouseMove(raycaster: Raycaster) {
    return this.raycastNearestArmyEntityId(raycaster);
  }

  public onRightClick(raycaster: Raycaster) {
    const entityId = this.raycastNearestArmyEntityId(raycaster) as ID | undefined;
    return entityId !== undefined && this.armyPresentations.get(entityId)?.isMine ? entityId : undefined;
  }

  private raycastNearestArmyEntityId(raycaster: Raycaster): number | undefined {
    const proceduralHit = this.proceduralArmyCharacterLayer.raycastNearest(raycaster);
    const legacyHit = this.armyModel.raycastNearest(raycaster);
    if (proceduralHit && (!legacyHit || proceduralHit.distance <= legacyHit.distance)) {
      return proceduralHit.entityId;
    }
    if (legacyHit?.instanceId === undefined || !legacyHit.mesh.userData.entityIdMap) return undefined;
    return legacyHit.mesh.userData.entityIdMap.get(legacyHit.instanceId);
  }

  private resolveOwnerName(address: bigint, preferredName?: string, fallbackName?: string): string {
    if (preferredName && preferredName.length > 0) {
      return preferredName;
    }
    if (fallbackName && fallbackName.length > 0) {
      return fallbackName;
    }
    return `0x${address.toString(16)}`;
  }

  private syncTrackedArmyOwnerState(params: {
    entityId: ID;
    ownerAddress: bigint;
    ownerName?: string;
    guildName?: string;
    ownerStructureId?: ID | null;
  }): boolean {
    const army = this.armyPresentations.get(params.entityId);
    if (!army) {
      return false;
    }

    const mergedOwner = resolveArmyOwnerState({
      existingOwner: army.owner,
      incomingOwner: {
        address: params.ownerAddress,
        ownerName: this.resolveOwnerName(params.ownerAddress, params.ownerName, army.owner.ownerName),
        guildName: params.guildName ?? army.owner.guildName,
      },
    });

    const nextOwningStructureId =
      params.ownerStructureId !== undefined ? params.ownerStructureId : army.owningStructureId;
    const nextIsMine = isAddressEqualToAccount(mergedOwner.address);
    const nextColor = this.getArmyColor({
      isMine: nextIsMine,
      isDaydreamsAgent: army.isDaydreamsAgent,
      owner: { address: mergedOwner.address },
    });

    const ownerChanged =
      army.owner.address !== mergedOwner.address ||
      army.owner.ownerName !== mergedOwner.ownerName ||
      army.owner.guildName !== mergedOwner.guildName;
    const ownershipVisualChanged = army.isMine !== nextIsMine || army.color !== nextColor;
    const structureChanged = army.owningStructureId !== nextOwningStructureId;

    if (!ownerChanged && !ownershipVisualChanged && !structureChanged) {
      return false;
    }

    army.owner.address = mergedOwner.address;
    army.owner.ownerName = mergedOwner.ownerName;
    army.owner.guildName = mergedOwner.guildName;
    army.owningStructureId = nextOwningStructureId;
    army.isMine = nextIsMine;
    army.color = nextColor;
    this.armyPresentations.set(params.entityId, army);

    const label = this.entityIdLabels.get(params.entityId);
    if (label) {
      this.updateArmyLabelData(params.entityId, army, label);
    }

    if (ownerChanged || ownershipVisualChanged) {
      this.removeArmyPointIcon(params.entityId);
      const position = this.getArmyWorldPosition(params.entityId, army.hexCoords);
      this.updateArmyPointIcon(army, position);
    }

    const slot = this.visibleArmyIndices.get(params.entityId);
    if (slot !== undefined && (ownerChanged || ownershipVisualChanged)) {
      const numericId = this.toNumericId(params.entityId);
      const { x, y } = army.hexCoords.getContract();
      const biome = configManager.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);
      this.refreshArmyInstance(army, slot, modelType);
      this.markVisibleArmyPresentationDirty();
    }

    return true;
  }

  private resolveArmyOwnerFromStructure(params: {
    armyEntityId: ID;
    ownerStructureId?: ID | null;
    fallbackOwnerAddress: bigint;
    fallbackOwnerName: string;
    logContext: "spawn" | "explorer update";
  }): { ownerAddress: bigint; ownerName: string } {
    if (params.ownerStructureId === null || params.ownerStructureId === undefined || !this.components?.Structure) {
      return {
        ownerAddress: params.fallbackOwnerAddress,
        ownerName: params.fallbackOwnerName,
      };
    }

    try {
      const structureEntityId = gameEntityKey([BigInt(params.ownerStructureId)]);
      const liveStructure = getComponentValue(this.components.Structure, structureEntityId);
      const liveOwnerRaw = liveStructure?.owner;
      if (liveOwnerRaw === undefined || liveOwnerRaw === null) {
        return {
          ownerAddress: params.fallbackOwnerAddress,
          ownerName: params.fallbackOwnerName,
        };
      }

      const ownerAddress = typeof liveOwnerRaw === "bigint" ? liveOwnerRaw : BigInt(liveOwnerRaw ?? 0);
      return {
        ownerAddress,
        ownerName: this.resolveArmyOwnerNameForAddress(
          params.armyEntityId,
          ownerAddress,
          params.fallbackOwnerName,
          params.logContext,
        ),
      };
    } catch (error) {
      console.warn(
        `[ArmyManager] Failed to resolve owner from Structure component during ${params.logContext} for army ${params.armyEntityId}:`,
        error,
      );
      return {
        ownerAddress: params.fallbackOwnerAddress,
        ownerName: params.fallbackOwnerName,
      };
    }
  }

  private resolveArmyOwnerNameForAddress(
    armyEntityId: ID,
    ownerAddress: bigint,
    fallbackOwnerName: string,
    logContext: "spawn" | "explorer update",
  ): string {
    let ownerName = fallbackOwnerName;

    if (this.components?.AddressName) {
      const addressName = getComponentValue(this.components.AddressName, getEntityIdFromKeys([ownerAddress]));

      if (addressName?.name) {
        try {
          ownerName = shortString.decodeShortString(addressName.name.toString());
        } catch (error) {
          console.warn(
            `[ArmyManager] Failed to decode owner name during ${logContext} for army ${armyEntityId}:`,
            error,
          );
        }
      }
    }

    if (!ownerName || ownerName.length === 0) {
      ownerName = `0x${ownerAddress.toString(16)}`;
    }

    return ownerName;
  }

  async updateChunk(chunkKey: string, options?: ManagerChunkUpdateOptions) {
    if (this.isDestroyed) {
      return;
    }
    await runManagerChunkUpdateRuntime({
      chunkKey,
      executeChunkUpdate: (nextChunkKey, nextOptions) => this.renderVisibleArmies(nextChunkKey, nextOptions),
      isDestroyed: () => this.isDestroyed,
      onPreviousUpdateFailed: (error) => {
        console.warn(`Previous chunk switch failed:`, error);
      },
      options,
      prepareForUpdate: () => this.armyModel.loadPromise,
      shouldAcceptRequest: shouldAcceptManagerChunkRequest,
      state: this.resolveChunkUpdateRuntimeState(),
      waitForSettle: waitForVisualSettle,
    });
  }

  recoverChunkUpdateAfterStall(input: RecoverManagerChunkRuntimeAfterStallInput): void {
    const { didApply } = recoverManagerChunkRuntimeAfterStall(this.resolveChunkUpdateRuntimeState(), input);
    if (!didApply) {
      return;
    }
    this.isArmyChunkTransitioning = false;
    this.drainDeferredArmyQueue();
    this.drainPreCommitArmyQueue();
  }

  private resolveChunkUpdateRuntimeState() {
    return bindManagerChunkRuntimeState({
      getCurrentChunk: () => this.currentChunkKey,
      setCurrentChunk: (chunkKey) => {
        this.currentChunkKey = chunkKey;
      },
      getInFlightPromise: () => this.chunkSwitchPromise,
      setInFlightPromise: (promise) => {
        this.chunkSwitchPromise = promise;
      },
      getLatestTransitionToken: () => this.latestTransitionToken,
      setLatestTransitionToken: (transitionToken) => {
        this.latestTransitionToken = transitionToken;
      },
      transitionChunkByToken: this.transitionChunkByToken,
    });
  }

  private renderVisibleArmies(chunkKey: string, options?: ManagerChunkUpdateOptions): Promise<void> {
    if (this.isDestroyed) {
      return Promise.resolve();
    }

    if (!isCommittedManagerChunk(chunkKey)) {
      return Promise.resolve();
    }

    this.pendingRenderChunkKey = chunkKey;
    this.pendingRenderOptions = options ?? null;
    return this.processRenderQueue();
  }

  private processRenderQueue(): Promise<void> {
    if (this.isDestroyed) {
      return Promise.resolve();
    }

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
          if (chunkKey && !this.isDestroyed) {
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
      const biome = configManager.getBiome(x, y);
      const numericId = this.toNumericId(army.entityId);
      const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);
      modelTypesByEntity.set(army.entityId, modelType);
      requiredModelTypes.add(modelType);
    });

    return { modelTypesByEntity, requiredModelTypes };
  }

  private setVisibleArmyOrder(order: ID[]): void {
    const state = {
      order: this.visibleArmyOrder,
      indices: this.visibleArmyOrderIndices,
    };
    replaceVisibleArmyOrder(state, order);
    this.visibleArmyOrder = state.order;
    this.visibleArmyOrderIndices = state.indices;
  }

  private refreshVisibleArmyCollection(): void {
    this.visibleArmies = this.visibleArmyOrder
      .map((entityId) => this.armyPresentations.get(entityId))
      .filter((army): army is ArmyData => Boolean(army));
    setWorldmapRenderGauge("visibleArmies", this.visibleArmyOrder.length);
  }

  private markVisibleArmyPresentationDirty(buffersDirty: boolean = true): void {
    this.visibleArmyPresentationDirty = true;
    this.visibleArmyBuffersDirty ||= buffersDirty;
  }

  private flushVisibleArmyPresentation(): void {
    if (!this.visibleArmyPresentationDirty) {
      return;
    }

    const shouldFlushBuffers = this.visibleArmyBuffersDirty;
    this.visibleArmyPresentationDirty = false;
    this.visibleArmyBuffersDirty = false;
    this.refreshVisibleArmyCollection();
    this.syncVisibleArmyAttachments(this.visibleArmies);
    this.updateArmyAttachmentTransforms();
    if (shouldFlushBuffers) {
      this.updateVisibleArmyBuffers();
    }
  }

  private updateVisibleArmyBuffers(): void {
    this.compactVisibleArmySlots();
    this.syncVisibleSlots();
    this.armyModel.updateAllInstances();
    // Defer bounds computation until after instance matrices are flushed
    // to prevent frustum culling mismatches at chunk edges
    this.armyModel.requestBoundsUpdate();
    this.armyModel.applyPendingBounds();
    this.frustumVisibilityDirty = true;
  }

  private compactVisibleArmySlots(): void {
    const plan = resolveArmySlotCompactionPlan(
      Array.from(this.visibleArmyIndices.entries()).map(([entityId, slot]) => ({
        entityId,
        slot,
      })),
    );

    if (!plan.needsCompaction) {
      return;
    }

    plan.reassignments.forEach(({ entityId, toSlot }) => {
      const numericId = this.toNumericId(entityId);
      // The army-model owns slots. visibleArmyIndices only tracks the compact
      // visible set used by this manager; ArmyData carries no slot mirror.
      const movedSlot = this.armyModel.moveInstanceSlot(numericId, toSlot);
      if (movedSlot === undefined) {
        return;
      }
      this.visibleArmyIndices.set(entityId, movedSlot);
    });
  }

  private addVisibleArmy(army: ArmyData, modelType: ModelType): void {
    const numericId = this.toNumericId(army.entityId);
    const slot = this.armyModel.allocateInstanceSlot(numericId);
    this.visibleArmyIndices.set(army.entityId, slot);
    addVisibleArmyOrderEntry(
      {
        order: this.visibleArmyOrder,
        indices: this.visibleArmyOrderIndices,
      },
      army.entityId,
    );
    this.refreshArmyInstance(army, slot, modelType);
  }

  private refreshArmyInstance(army: ArmyData, slot: number, modelType: ModelType, reResolveCosmetics?: boolean): void {
    const numericId = this.toNumericId(army.entityId);
    const isMoving = this.armyModel.isEntityMoving(numericId);
    const position = resolveArmyPresentationPosition({
      entityId: army.entityId,
      hexCoords: army.hexCoords,
      path: this.armyPaths.get(army.entityId),
      isMoving,
      movingPosition: this.armyModel.getEntityWorldPosition(numericId),
      getArmyWorldPosition: (entityId, hexCoords) => this.getArmyWorldPosition(entityId, hexCoords),
    });

    this.armyModel.assignModelToEntity(numericId, modelType);

    if (army.isDaydreamsAgent) {
      this.armyModel.setIsAgent(true);
    }

    const cosmeticPresentation = resolveArmyCosmeticPresentation({
      army,
      modelType,
      reResolveCosmetics,
    });
    army.cosmeticId = cosmeticPresentation.cosmeticId;
    army.cosmeticAssetPaths = cosmeticPresentation.cosmeticAssetPaths;
    army.usesFallbackCosmeticSkin = cosmeticPresentation.usesFallbackCosmeticSkin;
    army.attachments = cosmeticPresentation.attachments;
    if (cosmeticPresentation.cosmeticAssignment) {
      this.armyModel.assignCosmeticToEntity(numericId, cosmeticPresentation.cosmeticAssignment);
    } else if (cosmeticPresentation.clearCosmeticAssignment) {
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

    this.armyPresentations.set(army.entityId, army);
    this.armyModel.rebindMovementMatrixIndex(numericId, slot);
    this.syncArmyAuxiliaryPresentation(army, position);
  }

  private syncArmyAuxiliaryPresentation(army: ArmyData, position: Vector3) {
    this.syncArmyLabelPresentation(army, position);
    this.syncArmyPointPresentation(army, position);
  }

  private syncArmyLabelPresentation(army: ArmyData, position: Vector3) {
    syncArmyLabelPresentationState({
      label: this.entityIdLabels.get(army.entityId),
      position,
    });
  }

  private syncArmyPointPresentation(army: ArmyData, position: Vector3) {
    this.updateArmyPointIcon(army, position);
    this.updateArmyCompactLabel(army, position);
  }

  private removeVisibleArmy(entityId: ID, options?: { notifyMovementVisualCancel?: boolean }): number | null {
    const slot = this.visibleArmyIndices.get(entityId);
    if (slot === undefined) {
      return null;
    }

    this.visibleArmyIndices.delete(entityId);
    removeVisibleArmyOrderEntry(
      {
        order: this.visibleArmyOrder,
        indices: this.visibleArmyOrderIndices,
      },
      entityId,
    );

    this.armyPaths.delete(entityId);
    this.removeArmyPointIcon(entityId);
    this.removeArmyCompactLabel(entityId);
    this.removeEntityIdLabel(entityId);

    const numericId = this.toNumericId(entityId);
    // Chunk reconciliation can evict a mid-move army; freeInstanceSlot below
    // kills the movement-complete callback that would normally erase the path
    // line, so the eviction itself must remove it or the line is stranded on
    // the map forever.
    this.pathRenderer.removePath(numericId);
    const shouldNotifyMovementVisualCancel =
      options?.notifyMovementVisualCancel === true || this.armyModel.isEntityMoving(numericId);
    this.removeTrackedArmyAttachments(entityId);

    // Clean up movement source bucket before freeing the slot, since
    // freeInstanceSlot kills the movement callback that would normally do this
    this.cleanupMovementSourceBucket(entityId);
    // Chunk reconciliation can evict a moving army before the tween completes.
    // Surface that as a visual cancellation so arrival ghosts and travel effects
    // do not survive the lost movement-complete callback.
    if (shouldNotifyMovementVisualCancel) {
      this.runMovementVisualCancelListeners(numericId);
    }

    // Free the army-model's live slot (the single source of truth), falling back
    // to the mirror only when the model has no live slot. Freeing the cached
    // mirror slot during a transient desync would strand a ghost at the real slot.
    this.armyModel.freeInstanceSlot(numericId, this.armyModel.getEntitySlot(numericId) ?? slot);
    return slot;
  }

  private updateArmyPointIcon(army: ArmyData, position: Vector3): void {
    const iconPosition = this.tempIconPosition.copy(position);
    iconPosition.y += 2.1; // Match CSS2D label height
    syncArmyPointIconState({
      renderers: this.pointsRenderers,
      rendererKey: resolveArmyPointRendererKey(army),
      entityId: army.entityId,
      position: iconPosition,
    });
  }

  private updateArmyCompactLabel(army: ArmyData, position: Vector3): void {
    const labelPosition = this.tempIconPosition.copy(position);
    labelPosition.y += 2.78;
    this.compactLabelRenderer.setLabel({
      entityId: army.entityId,
      position: labelPosition,
      text: resolveArmyCompactEntityLabel(army),
      variant: resolveCompactEntityLabelVariant(army),
    });
  }

  private removeArmyPointIcon(entityId: ID): void {
    removeArmyPointIconState({
      renderers: this.pointsRenderers,
      entityId,
    });
  }

  private removeArmyCompactLabel(entityId: ID): void {
    this.compactLabelRenderer.removeLabel(entityId);
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
      .toSorted((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .join("|");
  }

  private syncVisibleArmyAttachments(visibleArmies: ArmyData[]): void {
    syncArmyAttachmentState({
      visibleArmies,
      activeArmyAttachmentEntities: this.activeArmyAttachmentEntities,
      armyAttachmentSignatures: this.armyAttachmentSignatures,
      toNumericId: (entityId) => this.toNumericId(entityId),
      getAttachmentSignature: (templates) => this.getAttachmentSignature(templates),
      spawnAttachments: (entityId, templates) => this.spawnArmyAttachments(entityId, templates),
      removeAttachments: (entityId) => this.attachmentManager.removeAttachments(entityId),
    });
  }

  private updateArmyAttachmentTransforms() {
    if (this.activeArmyAttachmentEntities.size === 0) {
      return;
    }

    this.visibleArmies.forEach((army) => {
      const entityId = this.toNumericId(army.entityId);
      // Phase 3.2: skip non-attachment armies before building the input object.
      if (!this.activeArmyAttachmentEntities.has(entityId)) {
        return;
      }
      const instanceData = this.armyModel.getInstanceData(entityId);
      syncArmyAttachmentTransformState({
        entityId,
        army,
        instanceData,
        activeArmyAttachmentEntities: this.activeArmyAttachmentEntities,
        tempPosition: this.tempCosmeticPosition,
        scale: this.scale,
        attachmentTransformScratch: this.armyAttachmentTransformScratch,
        getWorldPositionInto: (out, hexCoords) => this.getArmyWorldPositionInto(out, hexCoords),
        resolveBiome: (x, y) => configManager.getBiome(x, y),
        getModelTypeForEntity: (trackedEntityId, category, tier, biome) =>
          this.armyModel.getModelTypeForEntity(trackedEntityId, category, tier, biome),
        resolveMountTransforms: (modelType, baseTransform, scratch) =>
          resolveArmyMountTransforms(modelType, baseTransform, scratch),
        updateAttachmentTransforms: (trackedEntityId, baseTransform, mountTransforms) =>
          this.attachmentManager.updateAttachmentTransforms(trackedEntityId, baseTransform, mountTransforms),
      });
    });
  }

  private removeTrackedArmyAttachments(entityId: ID): void {
    removeArmyAttachmentsIfTracked({
      entityId: this.toNumericId(entityId),
      activeArmyAttachmentEntities: this.activeArmyAttachmentEntities,
      armyAttachmentSignatures: this.armyAttachmentSignatures,
      removeAttachments: (trackedEntityId) => this.attachmentManager.removeAttachments(trackedEntityId),
    });
  }

  private spawnArmyAttachments(entityId: number, templates: CosmeticAttachmentTemplate[]): void {
    this.attachmentManager.spawnAttachments(entityId, templates);
    if (this.activeProceduralArmyEntityIds.has(entityId)) {
      this.attachmentManager.setAttachmentSlotsVisible(entityId, PROCEDURAL_CHARACTER_ATTACHMENT_SLOTS, false);
    }
  }

  private async executeRenderForChunk(chunkKey: string, options?: ManagerChunkUpdateOptions): Promise<void> {
    if (this.isDestroyed) {
      return;
    }

    const renderStartedAt = performance.now();
    if (
      !shouldRunManagerChunkUpdate({
        chunkKey,
        currentChunk: this.currentChunkKey,
        transitionToken: options?.transitionToken,
        latestTransitionToken: this.latestTransitionToken,
      })
    ) {
      return;
    }

    this.isArmyChunkTransitioning = true;
    try {
      const [startRow, startCol] = chunkKey.split(",").map(Number);
      await this.ensureProjectedArmyPresentationsForChunk(startRow, startCol);
      const computeVisibleArmies = () => this.getVisibleArmiesForChunk(startRow, startCol);

      let visibleArmies = computeVisibleArmies();
      let visibilityDiff = createManagerVisibilityDiff({
        currentVisibleIds: this.visibleArmyOrder,
        nextVisibleEntities: visibleArmies,
        getEntityId: (army) => army.entityId,
      });
      const armiesRequiringModels = options?.refreshExisting ? visibleArmies : visibilityDiff.entering;
      let { modelTypesByEntity, requiredModelTypes } = this.collectModelInfo(armiesRequiringModels);

      // Preload all required models once
      if (requiredModelTypes.size > 0) {
        await this.armyModel.preloadModels(requiredModelTypes);
      }

      if (this.isDestroyed) {
        return;
      }

      if (
        !shouldRunManagerChunkUpdate({
          chunkKey,
          currentChunk: this.currentChunkKey,
          transitionToken: options?.transitionToken,
          latestTransitionToken: this.latestTransitionToken,
        })
      ) {
        return;
      }

      // Recompute after async work to capture any armies added during preload
      visibleArmies = computeVisibleArmies();
      const sortedVisibleArmies = visibleArmies.toSorted(
        (a, b) => this.toNumericId(a.entityId) - this.toNumericId(b.entityId),
      );
      visibilityDiff = createManagerVisibilityDiff({
        currentVisibleIds: this.visibleArmyOrder,
        nextVisibleEntities: sortedVisibleArmies,
        getEntityId: (army) => army.entityId,
      });
      ({ modelTypesByEntity } = this.collectModelInfo(
        options?.refreshExisting ? sortedVisibleArmies : visibilityDiff.entering,
      ));
      await scheduleFrameBudgetWork(
        this.chunkWorkScheduler,
        "critical",
        () => {
          if (
            !shouldRunManagerChunkUpdate({
              chunkKey,
              currentChunk: this.currentChunkKey,
              transitionToken: options?.transitionToken,
              latestTransitionToken: this.latestTransitionToken,
            })
          ) {
            return;
          }

          this.reconcileVisibleArmies(sortedVisibleArmies, modelTypesByEntity, options?.refreshExisting);
          this.pruneArmyPresentationsOutsideCurrentChunk();
        },
        "manager:army-visibility",
      );
    } finally {
      finalizeArmyChunkTransition({
        isDestroyed: this.isDestroyed,
        isWinningTransition: shouldRunManagerChunkUpdate({
          chunkKey,
          currentChunk: this.currentChunkKey,
          transitionToken: options?.transitionToken,
          latestTransitionToken: this.latestTransitionToken,
        }),
        setTransitioning: (isTransitioning) => {
          this.isArmyChunkTransitioning = isTransitioning;
        },
        drainDeferredQueue: () => this.drainDeferredArmyQueue(),
        drainPreCommitQueue: () => this.drainPreCommitArmyQueue(),
      });
      recordWorldmapRenderDuration("executeRenderForChunk", performance.now() - renderStartedAt);
      setWorldmapRenderGauge("visibleArmies", this.visibleArmyOrder.length);
      setWorldmapRenderGauge("activePaths", this.getActivePathCount());
    }
  }

  private isArmyVisible(army: ArmyData, bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }) {
    const entityIdNumber = this.toNumericId(army.entityId);

    // Only trust instanceData world position if the army-model still owns a
    // live slot. After chunk eviction, instanceData.position is stale
    // (frozen at mid-movement) and would poison the visibility decision.
    const isActivelyRendered = this.armyModel.getEntitySlot(entityIdNumber) !== undefined;
    const worldPos = isActivelyRendered ? this.armyModel.getEntityWorldPosition(entityIdNumber) : undefined;
    const worldHex = worldPos ? getHexForWorldPosition(worldPos) : undefined;
    const displayedHex = worldHex
      ? new Position({ x: worldHex.col, y: worldHex.row }).getNormalized()
      : army.hexCoords.getNormalized();

    const sourceState = this.movingArmySourceBuckets.get(army.entityId);
    const visibilityDecision = resolveArmyVisibilityBoundsDecision({
      destination: { col: displayedHex.x, row: displayedHex.y },
      bounds,
      source: sourceState ? { col: sourceState.col, row: sourceState.row } : undefined,
    });
    if (!visibilityDecision.shouldRemainVisible) {
      return false;
    }

    // Skip frustum culling during chunk updates - bounds check is sufficient.
    // Frustum culling can fail when the camera is still animating to the new chunk position,
    // causing armies to not appear until the next frame/click.
    // The bounds check already ensures we only render armies in the current chunk area.
    return true;
  }

  private getChunkBounds(startRow: number, startCol: number) {
    return getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkStride);
  }

  private reconcileVisibleArmies(
    visibleArmies: ArmyData[],
    modelTypesByEntity: Map<ID, ModelType>,
    forceRefresh?: boolean,
  ): void {
    reconcileVisibleArmySet({
      desiredVisibleArmies: visibleArmies,
      modelTypesByEntity,
      forceRefresh,
      currentVisibleOrder: this.visibleArmyOrder,
      forEachTrackedLabel: (visit) => {
        this.entityIdLabels.forEach((_, entityId) => visit(entityId));
      },
      getVisibleArmySlot: (entityId) => this.visibleArmyIndices.get(entityId),
      removeVisibleArmy: (entityId) => this.removeVisibleArmy(entityId),
      addVisibleArmy: (army, modelType) => this.addVisibleArmy(army, modelType),
      refreshVisibleArmy: (army, slot, modelType) => {
        // Re-resolve cosmetics on force refresh to pick up debug override changes.
        this.refreshArmyInstance(army, slot, modelType, true);
      },
      removeEntityIdLabel: (entityId) => this.removeEntityIdLabel(entityId),
      commitVisibleArmyOrder: (entityIds) => this.setVisibleArmyOrder(entityIds),
      markVisibleArmyPresentationDirty: (buffersDirty) => this.markVisibleArmyPresentationDirty(buffersDirty),
      sortEntityIds: (entityIds) => entityIds.toSorted((a, b) => this.toNumericId(a) - this.toNumericId(b)),
    });
  }

  private cleanupMovementSourceBucket(entityId: ID) {
    this.movingArmySourceBuckets.delete(entityId);
  }

  private getVisibleArmiesForChunk(startRow: number, startCol: number): Array<ArmyData> {
    const bounds = this.getChunkBounds(startRow, startCol);
    return [...this.armyPresentations.values()].filter((army) => this.isArmyVisible(army, bounds));
  }

  private getProjectedArmiesForChunk(startRow: number, startCol: number): readonly ArmySpatialRenderable[] {
    const bounds = this.getChunkBounds(startRow, startCol);
    const center = FELT_CENTER();
    return this.worldSpatialProjection.getArmiesInBounds({
      minCol: bounds.minCol + center,
      maxCol: bounds.maxCol + center,
      minRow: bounds.minRow + center,
      maxRow: bounds.maxRow + center,
    });
  }

  private async ensureProjectedArmyPresentationsForChunk(startRow: number, startCol: number): Promise<void> {
    const currentVisibleIds = new Set(this.visibleArmyOrder);
    const enteringRenderables = this.getProjectedArmiesForChunk(startRow, startCol).filter(
      ({ entityId }) => !currentVisibleIds.has(entityId) || !this.armyPresentations.has(entityId),
    );
    await this.preloadMissingProjectedArmyModels(enteringRenderables);
    await Promise.all(
      enteringRenderables.map((renderable) =>
        scheduleFrameBudgetWork(
          this.chunkWorkScheduler,
          "critical",
          () => this.ensureArmyPresentation(renderable),
          "manager:army-entering",
        ),
      ),
    );
  }

  private pruneArmyPresentationsOutsideCurrentChunk(): void {
    if (!isCommittedManagerChunk(this.currentChunkKey)) return;

    const [startRow, startCol] = this.currentChunkKey.split(",").map(Number);
    const retained = new Set(this.getProjectedArmiesForChunk(startRow, startCol).map(({ entityId }) => entityId));
    this.movingArmySourceBuckets.forEach((_, entityId) => retained.add(entityId));
    this.debugSpawnedArmyIds.forEach((entityId) => retained.add(entityId));

    const stalePresentations = [...this.armyPresentations.keys()].filter((entityId) => !retained.has(entityId));
    stalePresentations.forEach((entityId) => this.removeArmy(entityId, { playDefeatFx: false }));
  }

  private isArmyVisibleInCurrentChunk(army: ArmyData): boolean {
    if (!isCommittedManagerChunk(this.currentChunkKey)) {
      return false;
    }

    const [startRow, startCol] = this.currentChunkKey.split(",").map(Number);
    return this.isArmyVisible(army, this.getChunkBounds(startRow, startCol));
  }

  private drainDeferredArmyQueue(): void {
    if (this.deferredArmyQueue.size === 0) return;
    const deferred = [...this.deferredArmyQueue];
    this.deferredArmyQueue.clear();
    for (const entityId of deferred) void this.renderArmyIntoCurrentChunkIfVisible(entityId);
  }

  private drainPreCommitArmyQueue(): void {
    if (this.preCommitArmyQueue.size === 0) return;
    const queued = [...this.preCommitArmyQueue];
    this.preCommitArmyQueue.clear();
    for (const entityId of queued) void this.renderArmyIntoCurrentChunkIfVisible(entityId);
  }

  private async renderArmyIntoCurrentChunkIfVisible(entityId: ID): Promise<boolean> {
    if (this.isArmyChunkTransitioning) {
      this.deferredArmyQueue.add(entityId);
      return false;
    }

    if (!isCommittedManagerChunk(this.currentChunkKey)) {
      this.preCommitArmyQueue.add(entityId);
      return false;
    }

    const army = this.armyPresentations.get(entityId);
    if (!army || !this.isArmyVisibleInCurrentChunk(army)) {
      return false;
    }

    const numericEntityId = this.toNumericId(entityId);
    const { x, y } = army.hexCoords.getContract();
    const biome = configManager.getBiome(x, y);
    const modelType = this.armyModel.getModelTypeForEntity(numericEntityId, army.category, army.tier, biome);
    await this.armyModel.preloadModels([modelType]);

    const latestArmy = this.armyPresentations.get(entityId);
    if (!latestArmy || !this.isArmyVisibleInCurrentChunk(latestArmy)) {
      return false;
    }

    const slot = this.visibleArmyIndices.get(entityId);
    if (slot !== undefined) {
      this.refreshArmyInstance(latestArmy, slot, modelType);
    } else {
      this.addVisibleArmy(latestArmy, modelType);
    }

    this.markVisibleArmyPresentationDirty();
    return true;
  }

  public async addArmy(params: AddArmyParams) {
    if (this.armyPresentations.has(params.entityId)) return;

    // Monitor memory usage before adding army
    this.memoryMonitor?.getCurrentStats(`addArmy-${params.entityId}`);
    const numericEntityId = this.toNumericId(params.entityId);

    const { x, y } = params.hexCoords.getContract();

    // Variables to hold the final values
    let finalTroopCount = params.troopCount || 0;
    let finalCurrentStamina = params.currentStamina || 0;
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

    const structureIdForOwner =
      finalOwningStructureId !== null && finalOwningStructureId !== undefined
        ? finalOwningStructureId
        : (params.owningStructureId ?? null);

    const resolvedOwnerFromStructure = this.resolveArmyOwnerFromStructure({
      armyEntityId: params.entityId,
      ownerStructureId: structureIdForOwner,
      fallbackOwnerAddress: finalOwnerAddress ?? 0n,
      fallbackOwnerName: finalOwnerName,
      logContext: "spawn",
    });
    finalOwnerAddress = resolvedOwnerFromStructure.ownerAddress;
    finalOwnerName = resolvedOwnerFromStructure.ownerName;

    finalOwningStructureId = structureIdForOwner ?? finalOwningStructureId;

    const ownerForCosmetics = finalOwnerAddress ?? 0n;
    const { cosmetic, resolvedModelType } = this.resolveArmyModelSelection(params, ownerForCosmetics);

    // Extract cosmetic asset paths for potential custom model
    const cosmeticAssetPaths = cosmetic.skin.assetPaths;
    const hasCosmeticSkin = !cosmetic.skin.isFallback && cosmeticAssetPaths.length > 0;

    await this.armyModel.preloadModels([resolvedModelType]);
    this.armyModel.assignModelToEntity(numericEntityId, resolvedModelType);

    // If there's a custom cosmetic skin, assign it to the entity
    if (hasCosmeticSkin) {
      this.armyModel.assignCosmeticToEntity(numericEntityId, cosmetic.skin);
    }

    const isMine = finalOwnerAddress ? isAddressEqualToAccount(finalOwnerAddress) : false;

    // Determine the color based on ownership using the centralized player color system
    // This ensures each unique player gets a distinct, consistent color across the game
    const color = this.getArmyColor({
      isMine,
      isDaydreamsAgent: params.isDaydreamsAgent,
      owner: { address: finalOwnerAddress || 0n },
    });

    const initialStaminaPresentation = this.resolveArmyStaminaSnapshot(params.entityId);
    finalCurrentStamina = initialStaminaPresentation?.current ?? finalCurrentStamina;

    this.armyPresentations.set(
      params.entityId,
      createArmyRecord({
        entityId: params.entityId,
        hexCoords: params.hexCoords,
        isMine,
        owningStructureId: finalOwningStructureId,
        owner: {
          address: finalOwnerAddress || 0n,
          ownerName: finalOwnerName,
          guildName: finalGuildName,
        },
        cosmeticId: cosmetic.skin.cosmeticId,
        cosmeticAssetPaths,
        usesFallbackCosmeticSkin: cosmetic.skin.isFallback,
        attachments: cosmetic.attachments,
        color,
        category: params.category,
        tier: params.tier,
        isDaydreamsAgent: params.isDaydreamsAgent,
        // Enhanced data
        troopCount: finalTroopCount,
        currentStamina: finalCurrentStamina,
        maxStamina: finalMaxStamina,
        displayStaminaRatio: initialStaminaPresentation?.displayRatio,
        attackedFromDegrees: attackedFromDegrees ?? undefined,
        attackedTowardDegrees: attackTowardDegrees ?? undefined,
        battleCooldownEnd: finalBattleCooldownEnd,
        battleTimerLeft: finalBattleTimerLeft,
      }),
    );

    await this.renderArmyIntoCurrentChunkIfVisible(params.entityId);
  }

  private resolveArmyModelSelection(params: AddArmyParams, ownerAddress: bigint) {
    const numericEntityId = this.toNumericId(params.entityId);
    const { x, y } = params.hexCoords.getContract();
    const biome = configManager.getBiome(x, y);
    const baseModelType = this.armyModel.getModelTypeForEntity(numericEntityId, params.category, params.tier, biome);

    if (this.components && ownerAddress !== 0n) {
      playerCosmeticsStore.hydrateFromBlitzComponent(this.components, ownerAddress);
    }

    const cosmetic = resolveArmyCosmetic({
      owner: ownerAddress,
      troopType: params.category,
      tier: params.tier,
      defaultModelType: baseModelType,
    });

    return {
      cosmetic,
      resolvedModelType: cosmetic.skin.modelType ?? baseModelType,
    };
  }

  public async computeMovementPlan(entityId: ID, hexCoords: Position): Promise<ArmyMovementPlan | null> {
    const armyData = this.armyPresentations.get(entityId);
    if (!armyData) return null;

    const numericEntityId = this.toNumericId(entityId);
    const sourceNormalized = armyData.hexCoords.getNormalized();
    const targetNormalized = hexCoords.getNormalized();

    if (sourceNormalized.x === targetNormalized.x && sourceNormalized.y === targetNormalized.y) {
      return null;
    }

    // todo: currently taking max stamina of paladin as max stamina but need to refactor
    const maxTroopStamina = configManager.getTroopStaminaConfig(TroopType.Paladin, TroopTier.T3);
    const staminaMax = Number(maxTroopStamina?.staminaMax ?? 0);
    const minTravelCost = configManager.getMinTravelStaminaCost();
    const maxHex = Math.max(0, Math.floor(staminaMax / Math.max(minTravelCost, 1)));

    const shouldUseWorkerPath = shouldUseWorkerPathForArmy({ isMine: armyData.isMine });
    if (!shouldUseWorkerPath) {
      incrementWorldmapRenderCounter("workerFindPathBypasses");
    }

    const workerPath = shouldUseWorkerPath
      ? await gameWorkerManager.findPath(armyData.hexCoords, hexCoords, maxHex)
      : null;
    const path = resolveMovementPath(armyData.hexCoords, hexCoords, workerPath);
    const worldPath = path.map((pos) => this.getArmyWorldPositionInto(new Vector3(), pos));

    return {
      entityId,
      numericEntityId,
      sourceNormalized,
      targetNormalized,
      targetHexCoords: hexCoords,
      path,
      worldPath,
      armyCategory: armyData.category,
      armyTier: armyData.tier,
    };
  }

  /**
   * Apply a pre-computed movement plan. The projected RECS position is already
   * authoritative for presentation; this method owns only the visual tween.
   */
  private async applyMovementPlan(plan: ArmyMovementPlan): Promise<boolean> {
    const { entityId, numericEntityId, sourceNormalized, targetNormalized, targetHexCoords, path, worldPath } = plan;

    const armyData = this.armyPresentations.get(entityId);
    if (!armyData) return false;

    const currentNorm = armyData.hexCoords.getNormalized();
    // Already at target (either this plan or a later authoritative update landed first).
    if (currentNorm.x === targetNormalized.x && currentNorm.y === targetNormalized.y) return false;
    // Source drifted (another update moved the army since plan was computed). Abandon this plan.
    if (currentNorm.x !== sourceNormalized.x || currentNorm.y !== sourceNormalized.y) return false;

    this.movingArmySourceBuckets.set(entityId, {
      col: sourceNormalized.x,
      row: sourceNormalized.y,
    });
    this.armyPresentations.set(entityId, { ...armyData, hexCoords: targetHexCoords });

    // The army-model is the single source of truth for render slots.
    const matrixIndex = this.armyModel.getEntitySlot(numericEntityId);
    if (matrixIndex === undefined) {
      this.armyPaths.delete(entityId);
      this.armyModel.setMovementCompleteCallback(numericEntityId, undefined);
      this.cleanupMovementSourceBucket(entityId);
      await this.renderArmyIntoCurrentChunkIfVisible(entityId);
      this.runMovementStartListeners(numericEntityId);
      this.runMovementCompleteListeners(numericEntityId);
      return false;
    }

    this.armyPaths.set(entityId, path);

    this.armyModel.setMovementCompleteCallback(numericEntityId, () => {
      if (!this.armyPresentations.has(entityId)) return;
      this.armyPaths.delete(entityId);
      this.cleanupMovementSourceBucket(entityId);
      this.pathRenderer.removePath(numericEntityId);
      this.runMovementCompleteListeners(numericEntityId);
    });

    this.armyModel.startMovement(numericEntityId, worldPath, matrixIndex, plan.armyCategory, plan.armyTier);
    this.runMovementStartListeners(numericEntityId);

    const colorProfile = this.getArmyColorProfile(armyData);
    const displayState = this.selectedArmyForPath === entityId ? "selected" : "moving";
    this.pathRenderer.createPath(numericEntityId, worldPath, colorProfile.primary, displayState);

    return true;
  }

  public async moveArmy(entityId: ID, hexCoords: Position): Promise<void> {
    const plan = await this.computeMovementPlan(entityId, hexCoords);
    if (!plan) return;
    await this.applyMovementPlan(plan);
  }

  public removeArmy(entityId: ID, options: { playDefeatFx?: boolean } = {}) {
    const { playDefeatFx = true } = options;

    if (!this.armyPresentations.has(entityId)) return;

    if (this.proceduralCharacterPreviewEntityId === entityId) {
      this.setProceduralCharacterPreview(null);
    }

    const numericEntityId = this.toNumericId(entityId);
    if (playDefeatFx && this.proceduralArmyCharacterLayer.playDefeat(numericEntityId)) {
      this.activeProceduralArmyEntityIds.delete(numericEntityId);
    }
    this.removeTrackedArmyAttachments(entityId);

    // Monitor memory usage before removing army
    this.memoryMonitor?.getCurrentStats(`removeArmy-${entityId}`);

    // console.debug(`[ArmyManager] removeArmy invoked for entity ${entityId}`);

    this.armyPaths.delete(entityId);
    this.armyModel.setMovementCompleteCallback(numericEntityId, undefined);

    // Remove path visualization
    this.pathRenderer.removePath(numericEntityId);
    if (this.selectedArmyForPath === entityId) {
      this.selectedArmyForPath = null;
    }

    // Clean up movement source bucket tracking if army was mid-movement
    this.cleanupMovementSourceBucket(entityId);

    const army = this.armyPresentations.get(entityId);
    if (!army) {
      // console.warn(`[ArmyManager] removeArmy called for missing entity ${entityId}`);
      return;
    }

    // console.debug(`[ArmyManager] Preparing world cleanup for entity ${entityId}`);
    const worldPosition = this.getArmyWorldPosition(entityId, army.hexCoords);

    const removedSlot = this.removeVisibleArmy(entityId, { notifyMovementVisualCancel: true });
    if (removedSlot === null) {
      this.runMovementVisualCancelListeners(numericEntityId);
      this.removeArmyPointIcon(entityId);
      this.removeArmyCompactLabel(entityId);
      this.removeEntityIdLabel(entityId);
    }

    this.armyPresentations.delete(entityId);

    if (removedSlot !== null) {
      this.markVisibleArmyPresentationDirty();
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
    return Array.from(this.armyPresentations.values());
  }

  public getArmy(entityId: ID): ArmyData | undefined {
    return this.armyPresentations.get(entityId);
  }

  public getArrivalGhostSourceSnapshot(entityId: ID): { armyColor: string; sourceScene: Object3D } | null {
    const army = this.armyPresentations.get(entityId);
    if (!army) {
      return null;
    }

    const numericEntityId = this.toNumericId(entityId);
    const modelData = this.armyModel.getModelForEntity(numericEntityId);
    if (!modelData) {
      return null;
    }

    return {
      armyColor: army.color,
      sourceScene: modelData.sourceScene,
    };
  }

  public async resolvePendingCreationGhostSource(input: {
    entityId: ID;
    hexCoords: HexPosition;
    troopType: TroopType;
    troopTier: TroopTier;
  }): Promise<PendingCreationGhostSource> {
    const ownerAddress = this.resolvePendingCreationOwnerAddress();
    this.hydratePendingCreationCosmetics(ownerAddress);

    const baseModelType = this.resolvePendingCreationBaseModel(input);
    const cosmetic = resolveArmyCosmetic({
      owner: ownerAddress,
      troopType: input.troopType,
      tier: input.troopTier,
      defaultModelType: baseModelType,
    });
    const sourceScene = await this.resolvePendingCreationSourceScene({
      baseModelType: cosmetic.skin.modelType ?? baseModelType,
      cosmeticSkin: cosmetic.skin,
    });

    return {
      armyColor: this.resolvePendingCreationGhostColor(ownerAddress),
      sourceScene,
    };
  }

  private resolvePendingCreationOwnerAddress(): bigint {
    return ContractAddress(useAccountStore.getState().account?.address || "0");
  }

  private hydratePendingCreationCosmetics(ownerAddress: bigint): void {
    if (!this.components || ownerAddress === 0n) {
      return;
    }

    playerCosmeticsStore.hydrateFromBlitzComponent(this.components, ownerAddress);
  }

  private resolvePendingCreationBaseModel(input: {
    entityId: ID;
    hexCoords: HexPosition;
    troopType: TroopType;
    troopTier: TroopTier;
  }): ModelType {
    const contractHex = new Position({ x: input.hexCoords.col, y: input.hexCoords.row }).getContract();
    const biome = configManager.getBiome(contractHex.x, contractHex.y);
    return this.armyModel.getModelTypeForEntity(
      this.toNumericId(input.entityId),
      input.troopType,
      input.troopTier,
      biome,
    );
  }

  private async resolvePendingCreationSourceScene(input: {
    baseModelType: ModelType;
    cosmeticSkin: ResolvedCosmeticSkin;
  }): Promise<Object3D> {
    if (this.shouldUsePendingCreationCosmeticSource(input.cosmeticSkin)) {
      try {
        return await this.armyModel.getCosmeticModelSourceScene(input.cosmeticSkin);
      } catch (error) {
        console.warn("[ArmyManager] Failed to load pending creation cosmetic ghost, falling back to base model", error);
      }
    }

    return this.armyModel.getModelSourceScene(input.baseModelType);
  }

  private shouldUsePendingCreationCosmeticSource(skin: ResolvedCosmeticSkin): boolean {
    return !skin.isFallback && skin.assetPaths.length > 0;
  }

  private resolvePendingCreationGhostColor(ownerAddress: bigint): string {
    return this.getArmyColor({
      isMine: true,
      isDaydreamsAgent: false,
      owner: { address: ownerAddress },
    });
  }

  public syncAttachedArmiesOwnerForStructure(params: {
    structureId: ID;
    ownerAddress: bigint;
    ownerName?: string;
    guildName?: string;
  }): ID[] {
    const updatedArmyIds: ID[] = [];

    this.armyPresentations.forEach((army, entityId) => {
      if (army.owningStructureId !== params.structureId) {
        return;
      }

      this.syncTrackedArmyOwnerState({
        entityId,
        ownerAddress: params.ownerAddress,
        ownerName: params.ownerName,
        guildName: params.guildName ?? army.owner.guildName,
        ownerStructureId: params.structureId,
      });
      updatedArmyIds.push(entityId);
    });

    return updatedArmyIds;
  }

  public getVisibleCount(): number {
    return this.visibleArmyOrder.length;
  }

  public refreshCosmeticsForOwner(owner: string | bigint): void {
    refreshVisibleArmyCosmeticsByOwner({
      owner,
      armies: this.armyPresentations,
      visibleArmyIndices: this.visibleArmyIndices,
      getAssignedModelType: (entityId) => this.armyModel.getAssignedModelType(entityId),
      toNumericId: (entityId) => this.toNumericId(entityId),
      refreshArmyInstance: (army, slot, assignedModelType, reResolveCosmetics) =>
        this.refreshArmyInstance(army, slot, assignedModelType, reResolveCosmetics),
    });
  }

  public getActivePathCount(): number {
    return this.pathRenderer.getStats().activePaths;
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

  /** Select one production procedural actor for the graphics-dev ragdoll controls. */
  public setProceduralCharacterPreview(entityId: ID | null): void {
    this.proceduralCharacterPreviewEntityId = entityId;
  }

  public getProceduralArmyProductionStats(): ProceduralArmyProductionStats {
    const layer = this.proceduralArmyCharacterLayer.getStats();
    const visibleLandArmyCount = this.proceduralArmyPresentationBuffer.length;
    return {
      ...layer,
      activeRepresentationCount: this.activeProceduralArmyEntityIds.size,
      fallbackRepresentationCount: Math.max(0, visibleLandArmyCount - this.activeProceduralArmyEntityIds.size),
      visibleLandArmyCount,
    };
  }

  public setProceduralCollisionMode(mode: RenderMode): void {
    this.proceduralArmyCharacterLayer.setCollisionBudget(createProceduralCollisionBudget(mode));
  }

  public async startProceduralCharacterRagdoll(): Promise<void> {
    const entityId = this.proceduralCharacterPreviewEntityId;
    if (entityId === null) return;
    await this.proceduralArmyCharacterLayer.startRagdoll(this.toNumericId(entityId));
  }

  public async applyProceduralCharacterImpulse(): Promise<void> {
    const entityId = this.proceduralCharacterPreviewEntityId;
    if (entityId === null) return;
    await this.proceduralArmyCharacterLayer.applyImpulse(this.toNumericId(entityId));
  }

  public resetProceduralCharacter(): void {
    const entityId = this.proceduralCharacterPreviewEntityId;
    if (entityId === null) return;
    this.proceduralArmyCharacterLayer.reset(this.toNumericId(entityId));
  }

  public playProceduralAttack(
    entityId: ID,
    targetWorld: Readonly<Vector3>,
    targetEntityId?: ID,
    authority: ProceduralImpactAuthority = "provisional",
  ): boolean {
    return this.proceduralArmyCharacterLayer.playAttack(
      this.toNumericId(entityId),
      targetWorld,
      targetEntityId === undefined ? undefined : this.toNumericId(targetEntityId),
      authority,
    );
  }

  public sweepProceduralProjectile(request: ProjectileSweepRequest): ProjectileSweepHit | undefined {
    return this.proceduralArmyCharacterLayer.sweepProjectile(request);
  }

  public hasProceduralProjectileTarget(entityId: number): boolean {
    return this.proceduralArmyCharacterLayer.hasProjectileTarget(entityId);
  }

  public presentProceduralProjectileImpact(event: ArrowImpactEvent): boolean {
    return this.proceduralArmyCharacterLayer.presentProjectileImpact(event);
  }

  public onProceduralMeleeContact(
    listener: (
      entityId: number,
      event: ProceduralMeleeContactEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void,
  ): () => void {
    return this.proceduralArmyCharacterLayer.onMeleeContact(listener);
  }

  public onProceduralRangedRelease(
    listener: (
      entityId: number,
      event: ProceduralRangedReleaseEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void,
  ): () => void {
    return this.proceduralArmyCharacterLayer.onRangedRelease(listener);
  }

  public onMovementStart(entityId: ID, callback: () => void): () => void {
    const numericEntityId = this.toNumericId(entityId);
    let listeners = this.movementStartListeners.get(numericEntityId);
    if (!listeners) {
      listeners = new Set();
      this.movementStartListeners.set(numericEntityId, listeners);
    }

    listeners.add(callback);

    return () => {
      const active = this.movementStartListeners.get(numericEntityId);
      if (!active) {
        return;
      }
      active.delete(callback);
      if (active.size === 0) {
        this.movementStartListeners.delete(numericEntityId);
      }
    };
  }

  public onMovementComplete(entityId: ID, callback: () => void): () => void {
    const numericEntityId = this.toNumericId(entityId);
    let listeners = this.movementCompleteListeners.get(numericEntityId);
    if (!listeners) {
      listeners = new Set();
      this.movementCompleteListeners.set(numericEntityId, listeners);
    }

    listeners.add(callback);

    return () => {
      const active = this.movementCompleteListeners.get(numericEntityId);
      if (!active) {
        return;
      }
      active.delete(callback);
      if (active.size === 0) {
        this.movementCompleteListeners.delete(numericEntityId);
      }
    };
  }

  public onMovementVisualCancel(entityId: ID, callback: () => void): () => void {
    const numericEntityId = this.toNumericId(entityId);
    let listeners = this.movementVisualCancelListeners.get(numericEntityId);
    if (!listeners) {
      listeners = new Set();
      this.movementVisualCancelListeners.set(numericEntityId, listeners);
    }

    listeners.add(callback);

    return () => {
      const active = this.movementVisualCancelListeners.get(numericEntityId);
      if (!active) {
        return;
      }

      active.delete(callback);
      if (active.size === 0) {
        this.movementVisualCancelListeners.delete(numericEntityId);
      }
    };
  }

  public hasMovingArmies(): boolean {
    return this.armyModel.hasMovingInstances();
  }

  public isArmyMoving(entityId: ID): boolean {
    return this.armyModel.isEntityMoving(this.toNumericId(entityId));
  }

  private runMovementStartListeners(entityId: number): void {
    const listeners = this.movementStartListeners.get(entityId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    this.movementStartListeners.delete(entityId);
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[ArmyManager] Movement start listener failed", error);
      }
    });
  }

  private runMovementCompleteListeners(entityId: number): void {
    const listeners = this.movementCompleteListeners.get(entityId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    this.movementCompleteListeners.delete(entityId);
    this.movementVisualCancelListeners.delete(entityId);
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[ArmyManager] Movement complete listener failed", error);
      }
    });
  }

  private runMovementVisualCancelListeners(entityId: number): void {
    const listeners = this.movementVisualCancelListeners.get(entityId);
    this.movementVisualCancelListeners.delete(entityId);
    this.movementStartListeners.delete(entityId);
    this.movementCompleteListeners.delete(entityId);

    if (!listeners || listeners.size === 0) {
      return;
    }

    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[ArmyManager] Movement visual cancel listener failed", error);
      }
    });
  }

  // Dev-only ghost tripwire: throttled audit that the manager's slot mirror
  // matches the army-model source of truth (see army-slot-auditor).
  private slotAuditFrameCounter = 0;
  private readonly loggedSlotViolations = new Set<string>();

  update(deltaTime: number, animationContext?: AnimationVisibilityContext) {
    this.flushVisibleArmyPresentation();

    // Update movements in ArmyModel
    this.armyModel.updateMovements(deltaTime);
    this.requestMovingArmyShadowRefresh();
    this.armyModel.updateAnimations(deltaTime, animationContext);
    this.updateProceduralArmyCharacters(deltaTime, animationContext);
    this.updateCompactLabelCamera();

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
    // This consolidates point icons, compact labels, and attachment transforms.
    this.updateVisibleArmiesBatched();
    this.syncArmyBoundsForMovementState();

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

    // Throttled (~1.5s at 60fps) so the per-frame cost stays negligible.
    this.slotAuditFrameCounter = (this.slotAuditFrameCounter + 1) % 90;
    if (this.slotAuditFrameCounter === 0) {
      // All builds: self-heal the two ghosting symptoms (orphaned drawn slot,
      // visible-but-undrawn army) so a dropped slot can't strand a ghost or a
      // missing model indefinitely.
      this.reconcileArmyRenderIntegrity();
      if (import.meta.env?.DEV) {
        // DEV-only mirror/SSOT tripwire — narrows where a desync originated.
        this.auditArmySlotsForGhosts();
      }
    }
  }

  private updateProceduralArmyCharacters(
    deltaTime: number,
    animationContext: AnimationVisibilityContext | undefined,
  ): void {
    this.proceduralArmyPresentationBuffer.length = 0;
    this.desiredProceduralArmyEntityIds.clear();

    this.visibleArmies.forEach((army) => this.collectProceduralArmyPresentation(army, animationContext));
    this.proceduralArmyCharacterLayer.sync(this.proceduralArmyPresentationBuffer, deltaTime);
    this.syncProceduralArmyRepresentationVisibility();
    this.pruneProceduralArmyPresentationCache();
  }

  private collectProceduralArmyPresentation(
    army: ArmyData,
    animationContext: AnimationVisibilityContext | undefined,
  ): void {
    const entityId = this.toNumericId(army.entityId);
    const instance = this.armyModel.getInstanceData(entityId);
    const modelType = this.armyModel.getAssignedModelType(entityId);
    if (
      !instance ||
      !shouldPresentArmyProcedurally(modelType) ||
      !isAnimationPositionVisible(instance.position, animationContext)
    ) {
      return;
    }

    let presentation = this.proceduralArmyPresentations.get(entityId);
    if (!presentation) {
      presentation = {
        category: army.category,
        distanceToViewCenterSquared: animationContext?.cameraPosition?.distanceToSquared(instance.position),
        entityId,
        isMoving: false,
        isSelected: this.selectedArmyForPath === army.entityId,
        position: instance.position,
        primaryColor: army.color,
        tier: army.tier,
      };
      this.proceduralArmyPresentations.set(entityId, presentation);
    }

    presentation.attachments = army.attachments;
    presentation.category = army.category;
    presentation.distanceToViewCenterSquared = animationContext?.cameraPosition?.distanceToSquared(instance.position);
    presentation.isMoving = this.armyModel.isEntityMoving(entityId);
    presentation.isSelected = this.selectedArmyForPath === army.entityId;
    presentation.position = instance.position;
    presentation.primaryColor = army.color;
    presentation.rotation = instance.rotation;
    presentation.tier = army.tier;
    this.desiredProceduralArmyEntityIds.add(entityId);
    this.proceduralArmyPresentationBuffer.push(presentation);
  }

  private syncProceduralArmyRepresentationVisibility(): void {
    this.readyProceduralArmyEntityIds.clear();
    this.proceduralArmyPresentationBuffer.forEach(({ entityId }) => {
      if (this.proceduralArmyCharacterLayer.hasActor(entityId)) this.readyProceduralArmyEntityIds.add(entityId);
    });
    reconcileProceduralArmyRepresentations({
      activeEntityIds: this.activeProceduralArmyEntityIds,
      readyEntityIds: this.readyProceduralArmyEntityIds,
      setLegacyAttachmentsVisible: this.setProceduralFallbackAttachmentVisibility,
      setLegacyModelVisible: this.setProceduralFallbackModelVisibility,
    });
  }

  private pruneProceduralArmyPresentationCache(): void {
    this.proceduralArmyPresentations.forEach((_presentation, entityId) => {
      if (!this.desiredProceduralArmyEntityIds.has(entityId)) this.proceduralArmyPresentations.delete(entityId);
    });
  }

  // Self-healing reconciliation for the two reported ghosting symptoms:
  //   1. orphaned-drawn-slot — a model still drawn for an army no longer tracked
  //      (a dead unit's frozen ghost). Purge the slot.
  //   2. visible-not-drawn — a tracked army that should be visible in the
  //      committed chunk but has no drawn model (a spawn that never appeared).
  //      Re-run its render, which is idempotent and self-gating.
  //   3. stale-drawn-position — a live, stationary army whose drawn matrix sits
  //      on a different hex than its authoritative position: the model stands
  //      at the OLD hex while the label follows the entity. Re-render rewrites
  //      the matrix from the same source the label reads.
  //   4. duplicate-drawn-owner — one entity owning two drawn slots; purge every
  //      slot except the model's source-of-truth one.
  // The label path is unaffected because labels read instanceData.position, not
  // the slot — which is exactly why labels keep working while models ghost.
  private reconcileArmyRenderIntegrity(): void {
    const liveEntityIds = new Set<number>();
    this.armyPresentations.forEach((_, entityId) => liveEntityIds.add(this.toNumericId(entityId)));

    const visibleUndrawnEntityIds: ID[] = [];
    // Only trust the "should be visible" predicate when the chunk is settled;
    // mid-transition, an undrawn army is expected (it is queued for render).
    if (!this.isArmyChunkTransitioning && isCommittedManagerChunk(this.currentChunkKey)) {
      this.armyPresentations.forEach((army, entityId) => {
        if (!this.isArmyVisibleInCurrentChunk(army)) return;
        const numericEntityId = this.toNumericId(entityId);
        if (this.activeProceduralArmyEntityIds.has(numericEntityId) || this.armyModel.isEntityDrawn(numericEntityId)) {
          return;
        }
        visibleUndrawnEntityIds.push(entityId);
      });
    }

    const violations = auditArmyRenderIntegrity({
      drawnSlotOwners: this.armyModel.collectDrawnSlotOwners(),
      liveEntityIds,
      visibleUndrawnEntityIds,
      drawnPositionEntries: this.collectStationaryDrawnPositions(liveEntityIds),
    });

    if (violations.length === 0) {
      return;
    }

    let purgedAny = false;
    for (const violation of violations) {
      switch (violation.kind) {
        case "orphaned-drawn-slot":
          this.armyModel.purgeDrawnSlot(violation.slot);
          purgedAny = true;
          incrementWorldmapRenderCounter("armyRenderIntegrityHealOrphanSlot");
          break;
        case "duplicate-drawn-owner": {
          const ssotSlot = this.armyModel.getEntitySlot(violation.owner);
          for (const slot of violation.slots) {
            if (slot === ssotSlot) continue;
            this.armyModel.purgeDrawnSlot(slot);
            purgedAny = true;
          }
          incrementWorldmapRenderCounter("armyRenderIntegrityHealDuplicateOwner");
          break;
        }
        case "stale-drawn-position":
          void this.renderArmyIntoCurrentChunkIfVisible(violation.entityId);
          incrementWorldmapRenderCounter("armyRenderIntegrityHealStalePosition");
          break;
        default:
          void this.renderArmyIntoCurrentChunkIfVisible(this.toNumericId(violation.entityId));
          incrementWorldmapRenderCounter("armyRenderIntegrityHealVisibleUndrawn");
          break;
      }

      reportArmyIntegrityHealOnce({
        rendererMode: getRendererDiagnosticActiveMode(),
        reportedSignatures: this.loggedSlotViolations,
        violation,
      });
    }

    // Purges mutate activeInstances directly; recompact draw counts so the freed
    // slot stops drawing on the next frame.
    if (purgedAny) {
      this.markVisibleArmyPresentationDirty();
    }
  }

  // Drawn matrix vs authoritative position for every live, stationary, drawn
  // army. Moving armies are excluded — mid-spline the matrix legitimately
  // trails the entity — and mid-transition renders are queued, not stale.
  private collectStationaryDrawnPositions(liveEntityIds: Set<number>): DrawnSlotPositionEntry[] {
    if (this.isArmyChunkTransitioning || !isCommittedManagerChunk(this.currentChunkKey)) return [];
    const entries: DrawnSlotPositionEntry[] = [];
    for (const entityId of liveEntityIds) {
      const instanceData = this.armyModel.getInstanceData(entityId);
      if (!instanceData || instanceData.isMoving) continue;
      const slot = instanceData.matrixIndex;
      if (slot === undefined) continue;
      const drawn = this.armyModel.getDrawnSlotPosition(slot);
      if (!drawn) continue;
      entries.push({
        entityId,
        slot,
        drawn: { x: drawn.x, z: drawn.z },
        expected: { x: instanceData.position.x, z: instanceData.position.z },
      });
    }
    return entries;
  }

  // Reports when the manager's slot mirror (visibleArmyIndices) drifts from the
  // army-model source of truth, or when two entities share a live slot — the two
  // states that surface as a frozen ghost. Each unique violation is logged once.
  private auditArmySlotsForGhosts(): void {
    const entries: ArmySlotAuditEntry[] = [];
    this.visibleArmyIndices.forEach((mirrorSlot, entityId) => {
      entries.push({
        entityId,
        mirrorSlot,
        ssotSlot: this.armyModel.getEntitySlot(this.toNumericId(entityId)),
      });
    });

    for (const violation of auditArmySlots(entries)) {
      const signature =
        violation.kind === "mirror-mismatch"
          ? `mirror:${violation.entityId}:${violation.mirrorSlot}:${violation.ssotSlot}`
          : `shared:${violation.slot}:${violation.entityIds.join(",")}`;
      if (this.loggedSlotViolations.has(signature)) {
        continue;
      }
      this.loggedSlotViolations.add(signature);
      console.warn("[ArmyManager] slot-audit ghost risk", violation);
    }
  }

  private updateCompactLabelCamera(): void {
    const camera = this.hexagonScene?.getCamera();
    if (camera) {
      this.compactLabelRenderer.updateCamera(camera);
    }
  }

  private requestMovingArmyShadowRefresh(): void {
    if (this.currentCameraView !== CameraView.Close || !this.hasMovingArmies()) {
      return;
    }

    this.hexagonScene?.requestShadowContentRefresh();
  }

  private syncArmyBoundsForMovementState() {
    const hasMovingArmies = this.hasMovingArmies();

    if (hasMovingArmies) {
      this.refreshMovingArmyBoundsIfNeeded();
      this.hadMovingArmiesLastFrame = true;
      return;
    }

    if (this.hadMovingArmiesLastFrame) {
      this.refreshSettledArmyBounds();
    }

    this.hadMovingArmiesLastFrame = false;
  }

  private refreshMovingArmyBoundsIfNeeded() {
    if (!this.hasMovingArmies()) {
      return;
    }

    const now = performance.now();
    if (now - this.lastMovingBoundsRefreshAt < this.movingBoundsRefreshIntervalMs) {
      return;
    }

    this.lastMovingBoundsRefreshAt = now;
    this.armyModel.requestBoundsUpdate();
    this.armyModel.applyPendingBounds();
    this.frustumVisibilityDirty = true;
  }

  private refreshSettledArmyBounds() {
    this.lastMovingBoundsRefreshAt = Number.NEGATIVE_INFINITY;
    this.armyModel.requestBoundsUpdate();
    this.armyModel.applyPendingBounds();
    this.frustumVisibilityDirty = true;
  }

  /**
   * Batched update for all visible army per-frame operations.
   * Consolidates point icon updates, compact labels, and attachment transforms
   * into a single iteration over visibleArmies to reduce iteration overhead.
   */
  private updateVisibleArmiesBatched() {
    const hasPointsRenderers = this.pointsRenderers !== undefined;
    const hasActiveAttachments = this.activeArmyAttachmentEntities.size > 0;
    const hasMovingArmies = this.hasMovingArmies();

    // Early exit if nothing to update
    if (!hasPointsRenderers && !hasActiveAttachments && !hasMovingArmies) {
      return;
    }

    let pointsBatchStarted = false;
    const startPointsBatch = () => {
      if (!hasPointsRenderers || pointsBatchStarted || !this.pointsRenderers) {
        return;
      }
      pointsBatchStarted = true;
      this.pointsRenderers.player.beginBatch();
      this.pointsRenderers.enemy.beginBatch();
      this.pointsRenderers.ally.beginBatch();
      this.pointsRenderers.agent.beginBatch();
    };

    // Single pass over visible armies
    for (let i = 0; i < this.visibleArmies.length; i++) {
      const army = this.visibleArmies[i];
      const numericEntityId = this.toNumericId(army.entityId);
      const instanceData = this.armyModel.getInstanceData(numericEntityId);

      // 1. Update point icon positions for moving armies
      if (hasPointsRenderers && instanceData?.isMoving) {
        startPointsBatch();
        const iconPosition = this.tempIconPosition.copy(instanceData.position);
        iconPosition.y += 2.1; // Match CSS2D label height

        syncArmyPointIconState({
          renderers: this.pointsRenderers,
          rendererKey: resolveArmyPointRendererKey(army),
          entityId: army.entityId,
          position: iconPosition,
        });
      }

      if (instanceData?.isMoving) {
        this.updateArmyCompactLabel(army, instanceData.position);
      }

      // 2. Update attachment transforms. Phase 3.2: only attachment-bearing armies
      // need the sync (the callee early-returns for non-members), so hoist the
      // membership check here to avoid allocating the input object + delegate
      // closures for every visible army each frame.
      if (hasActiveAttachments && this.activeArmyAttachmentEntities.has(numericEntityId)) {
        syncArmyAttachmentTransformState({
          entityId: numericEntityId,
          army,
          instanceData,
          activeArmyAttachmentEntities: this.activeArmyAttachmentEntities,
          tempPosition: this.tempCosmeticPosition,
          scale: this.scale,
          attachmentTransformScratch: this.armyAttachmentTransformScratch,
          getWorldPositionInto: (out, hexCoords) => this.getArmyWorldPositionInto(out, hexCoords),
          resolveBiome: (x, y) => configManager.getBiome(x, y),
          getModelTypeForEntity: (trackedEntityId, category, tier, biome) =>
            this.armyModel.getModelTypeForEntity(trackedEntityId, category, tier, biome),
          resolveMountTransforms: (modelType, baseTransform, scratch) =>
            resolveArmyMountTransforms(modelType, baseTransform, scratch),
          updateAttachmentTransforms: (trackedEntityId, baseTransform, mountTransforms) =>
            this.attachmentManager.updateAttachmentTransforms(trackedEntityId, baseTransform, mountTransforms),
        });
      }
    }

    if (pointsBatchStarted && this.pointsRenderers) {
      this.pointsRenderers.player.endBatch();
      this.pointsRenderers.enemy.endBatch();
      this.pointsRenderers.ally.endBatch();
      this.pointsRenderers.agent.endBatch();
    }
  }

  private applyFrustumVisibilityToLabels() {
    syncArmyLabelVisibility<ID>({
      labels: this.entityIdLabels.values(),
      setLabelVisible: (label) => this.isArmyLabelVisible(label),
      revealLabel: (entityId, label) => this.revealArmyLabel(entityId, label),
    });
  }

  private getArmyWorldPositionInto(out: Vector3, hexCoords: Position): Vector3 {
    const { x: hexCoordsX, y: hexCoordsY } = hexCoords.getNormalized();
    getWorldPositionForHexCoordsInto(hexCoordsX, hexCoordsY, out);
    return placePositionOnTerrain(out, this.hexagonScene?.getTerrainSurface() ?? FLAT_TERRAIN_SURFACE, 0.03);
  }

  private getArmyWorldPosition = (_armyEntityId: ID, hexCoords: Position) => {
    return this.getArmyWorldPositionInto(this.tempWorldPosition, hexCoords);
  };

  private toNumericId(entityId: ID | string | null | undefined): number {
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

  recheckOwnership() {
    const updatedVisible: ArmyData[] = [];

    this.armyPresentations.forEach((army, entityId) => {
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
      this.armyPresentations.set(entityId, army);

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
      const biome = configManager.getBiome(x, y);
      const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);
      this.refreshArmyInstance(army, slot, modelType);
    });

    this.visibleArmies = this.visibleArmyOrder
      .map((id) => this.armyPresentations.get(id))
      .filter((army): army is ArmyData => Boolean(army));

    this.armyModel.updateAllInstances();
    this.syncVisibleSlots();
    this.frustumVisibilityDirty = true;
  }

  private async addEntityIdLabel(army: ArmyData, position: Vector3) {
    const { label } = this.labelPool.acquire(() => {
      const element = createArmyLabel(army, this.currentCameraView);
      return new CSS2DObject(element);
    });

    initializeArmyLabelState({
      label,
      entityId: army.entityId,
      position,
    });
    configureArmyLabelHoverPriority(label);

    this.entityIdLabels.set(army.entityId, label);
    this.armyModel.addLabel(this.toNumericId(army.entityId), label);

    this.updateArmyLabelData(army.entityId, army, label);
    this.frustumVisibilityDirty = true;
  }

  public showLabel(entityId: ID): HoverLabelShowResult {
    const army = this.armyPresentations.get(entityId);
    if (!army) {
      return { status: "missing" };
    }

    const position = this.getArmyWorldPosition(army.entityId, army.hexCoords);
    if (this.entityIdLabels.has(army.entityId)) {
      const label = this.entityIdLabels.get(army.entityId)!;
      const wasDetached = label.parent !== this.labelsGroup;
      const wasHidden = label.visible !== true || label.element.style.display === "none";
      syncArmyLabelPresentationState({
        label,
        position,
      });
      this.revealArmyLabel(entityId, label);
      label.visible = true;
      label.element.style.display = "";
      this.updateArmyLabelData(entityId, army, label);
      this.highlightArmyPointHover(entityId, army);
      if (wasDetached || wasHidden) {
        this.frustumVisibilityDirty = true;
        return { status: "reattached" };
      }
      return { status: "unchanged" };
    }

    this.addEntityIdLabel(army, position);
    this.highlightArmyPointHover(entityId, army);
    this.frustumVisibilityDirty = true;
    return { status: "shown" };
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);
    this.clearArmyPointHoverIcons();
    this.frustumVisibilityDirty = true;
  }

  public hideAllLabels(): void {
    removeArmyLabels({
      trackedLabelEntityIds: Array.from(this.entityIdLabels.keys()),
      shouldRetainLabel: () => false,
      removeEntityIdLabel: (armyId) => this.removeEntityIdLabel(armyId),
    });
    this.clearArmyPointHoverIcons();
    this.frustumVisibilityDirty = true;
  }

  public setLabelRenderDistance(distance: number): void {
    this.labelRenderDistance = distance;
    // Re-evaluate label visibility on the next update cycle.
    this.frustumVisibilityDirty = true;
  }

  private isArmyLabelVisible(label: CSS2DObject): boolean {
    if (this.labelRenderDistance < Infinity) {
      const camera = this.hexagonScene?.getCamera();
      if (camera && camera.position.distanceTo(label.position) > this.labelRenderDistance) {
        return false;
      }
    }
    return this.visibilityManager
      ? this.visibilityManager.isPointVisible(label.position)
      : (this.frustumManager?.isPointVisible(label.position) ?? true);
  }

  private revealArmyLabel(entityId: ID, label: CSS2DObject) {
    revealArmyLabelState({
      label,
      labelsGroup: this.labelsGroup,
      army: this.armyPresentations.get(entityId),
      renderLabel: (army) => updateArmyLabel(label.element, army, this.currentCameraView),
    });
  }

  private highlightArmyPointHover(entityId: ID, army: Pick<ArmyData, "isDaydreamsAgent" | "isMine">): void {
    setArmyPointHoverState({
      renderers: this.pointsRenderers,
      rendererKey: resolveArmyPointRendererKey(army),
      entityId,
    });
    this.compactLabelRenderer.setHover(entityId);
  }

  private clearArmyPointHoverIcons() {
    clearArmyPointHoverState({
      renderers: this.pointsRenderers,
    });
    this.compactLabelRenderer.clearHover();
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
          texture.flipY = resolvePointLabelTextureFlipY(snapshotRendererDiagnostics().activeMode);

          loadedTextures[key as keyof typeof texturePaths] = texture;
          loadedCount++;

          // When all textures are loaded, create the renderers
          if (loadedCount === totalTextures) {
            const scaledPointSize = resolveArmyPointLabelSize();
            // Use player texture for agent as fallback
            this.pointsRenderers = {
              player: new PointsLabelRenderer(
                this.scene,
                loadedTextures.player!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
              ),
              enemy: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemy!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
              ),
              ally: new PointsLabelRenderer(
                this.scene,
                loadedTextures.ally!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
              ),
              agent: new PointsLabelRenderer(
                this.scene,
                loadedTextures.player!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
              ),
            };

            // Re-render visible armies to populate points
            if (isCommittedManagerChunk(this.currentChunkKey)) {
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
    const shadowsEnabled = this.hexagonScene?.getShadowsEnabled() ?? true;
    const enableRealShadows = view === CameraView.Close && shadowsEnabled;
    const enableContactShadows = !enableRealShadows;

    // Keep shadow flags in sync when the scene reapplies its visual profile.
    this.armyModel.setShadowsEnabled(enableRealShadows);
    this.armyModel.setContactShadowsEnabled(enableContactShadows);
    this.proceduralArmyCharacterLayer.setShadowsEnabled(enableRealShadows);

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
    if (!this.armyPresentations.has(entityId)) {
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
    return this.armyPresentations.has(entityId) && this.isArmySelectable(entityId);
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

  private resolveLiveExplorerTroops(entityId: ID) {
    if (!this.components) {
      return null;
    }

    return getComponentValue(this.components.ExplorerTroops, gameEntityKey([BigInt(entityId)]))?.troops ?? null;
  }

  private resolveArmyStaminaSnapshot(
    entityId: ID,
    currentArmiesTick = getBlockTimestamp().currentArmiesTick,
  ): { current: number; max: number; displayRatio: number } | null {
    if (!Number.isFinite(currentArmiesTick) || currentArmiesTick <= 0) {
      return null;
    }

    const staminaSnapshot = getExplorerStaminaSnapshot({
      entityId,
      currentArmiesTick,
      liveTroops: this.resolveLiveExplorerTroops(entityId),
    });
    if (!staminaSnapshot) {
      return null;
    }

    // staminaSnapshot.current is already the computed regen value from
    // StaminaManager.getStamina(troops, currentArmiesTick). Use it directly.
    return {
      current: staminaSnapshot.current,
      max: staminaSnapshot.max,
      displayRatio: staminaSnapshot.max > 0 ? staminaSnapshot.current / staminaSnapshot.max : 0,
    };
  }

  /**
   * Recompute stamina for all armies and update visible labels when armies tick changes
   */
  private recomputeStaminaForAllArmies(currentArmiesTick: number): void {
    // Update all army data in cache
    this.armyPresentations.forEach((army, entityId) => {
      try {
        const staminaSnapshot = this.resolveArmyStaminaSnapshot(entityId, currentArmiesTick);

        // Update cached army data with new stamina
        army.currentStamina = staminaSnapshot?.current ?? army.currentStamina;
        army.maxStamina = staminaSnapshot?.max ?? army.maxStamina;
        army.displayStaminaRatio = staminaSnapshot?.displayRatio ?? army.displayStaminaRatio;

        // Update visible label if it exists
        const label = this.entityIdLabels.get(entityId);
        if (label) {
          this.updateArmyLabelData(entityId, army, label);
        }
      } catch {
        // Skip this army — don't let one bad entity block all others
      }
    });
  }

  /**
   * Recompute battle timers for all armies and update visible labels every second
   */
  private recomputeBattleTimersForAllArmies(): void {
    // Update all army data with active battle timers
    this.armyPresentations.forEach((army, entityId) => {
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
    const layoutDataKey = buildArmyLabelLayoutDataKey(army);
    const staminaDataKey = buildArmyLabelStaminaDataKey(army);

    syncArmyLabelContentState({
      label: existingLabel,
      layoutDataKey,
      staminaDataKey,
      labelsAttachedToScene: this.labelsGroup.parent !== null,
      renderLabel: () => updateArmyLabel(existingLabel.element, army, this.currentCameraView),
      renderStamina: () => this.updateArmyLabelStamina(existingLabel.element, army),
    });
  }

  private updateArmyLabelStamina(labelElement: HTMLElement, army: ArmyData): void {
    const staminaBar = labelElement.querySelector('[data-component="stamina-bar"]');
    if (!staminaBar) {
      updateArmyLabel(labelElement, army, this.currentCameraView);
      return;
    }

    updateStaminaBar(staminaBar as HTMLElement, army.currentStamina, army.maxStamina);
  }

  /**
   * Update army battle direction and label
   */
  public updateBattleDirection(entityId: ID, degrees: number | undefined, role: "attacker" | "defender"): void {
    const army = this.armyPresentations.get(entityId);
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

  private applyExplorerTroopsPresentationUpdate(explorerTroops: ExplorerTroopsComponentValue): void {
    const entityId = explorerTroops.explorer_id as ID;
    const army = this.armyPresentations.get(entityId);
    if (!army) return;

    const troopCount = divideByPrecision(Number(explorerTroops.troops.count));
    // Log troop count diff and play visual FX for battle damage/healing
    const previousCount = army.troopCount;
    if (previousCount !== troopCount) {
      const diff = troopCount - previousCount;

      // Play floating damage/heal FX at the army's position
      const normalizedHex = army.hexCoords.getNormalized();
      const worldPos = getWorldPositionForHex({ col: normalizedHex.x, row: normalizedHex.y });
      this.fxManager.playTroopDiffFx(diff, worldPos.x, worldPos.y + 3, worldPos.z);
    }

    army.troopCount = troopCount;

    const staminaSnapshot = this.resolveArmyStaminaSnapshot(entityId);
    army.currentStamina = staminaSnapshot?.current ?? army.currentStamina;
    army.maxStamina = staminaSnapshot?.max ?? army.maxStamina;
    army.displayStaminaRatio = staminaSnapshot?.displayRatio ?? army.displayStaminaRatio;

    const ownerStructureId = explorerTroops.owner === 0 ? null : explorerTroops.owner;
    const resolvedOwnerFromStructure = this.resolveArmyOwnerFromStructure({
      armyEntityId: entityId,
      ownerStructureId,
      fallbackOwnerAddress: army.owner.address,
      fallbackOwnerName: army.owner.ownerName,
      logContext: "explorer update",
    });
    this.syncTrackedArmyOwnerState({
      entityId,
      ownerAddress: resolvedOwnerFromStructure.ownerAddress,
      ownerName: resolvedOwnerFromStructure.ownerName,
      guildName: army.owner.guildName,
      ownerStructureId,
    });

    army.battleCooldownEnd = explorerTroops.troops.battle_cooldown_end;
    army.battleTimerLeft = getBattleTimerLeft(explorerTroops.troops.battle_cooldown_end);

    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.updateArmyLabelData(entityId, army, label);
    }
  }

  private refreshArmyPositionPresentation(army: ArmyData): void {
    const slot = this.visibleArmyIndices.get(army.entityId);
    if (slot === undefined) {
      return;
    }

    const numericId = this.toNumericId(army.entityId);
    const { x, y } = army.hexCoords.getContract();
    const biome = configManager.getBiome(x, y);
    const modelType = this.armyModel.getModelTypeForEntity(numericId, army.category, army.tier, biome);

    this.refreshArmyInstance(army, slot, modelType);
    this.markVisibleArmyPresentationDirty();
  }

  public destroy() {
    if (this.isDestroyed) {
      console.warn("ArmyManager already destroyed, skipping cleanup");
      return;
    }
    this.isDestroyed = true;

    this.unsubscribeArmyProjection();
    this.unsubscribeExplorerTroopsPresentation?.();
    this.unsubscribeExplorerTroopsPresentation = undefined;
    this.armyProjectionSyncs.clear();

    if (this.unsubscribeVisibility) {
      this.unsubscribeVisibility();
      this.unsubscribeVisibility = undefined;
    }

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

    this.unsubscribeChainTime?.();
    this.unsubscribeChainTime = undefined;

    // Clean up debug stats interval
    if (this.debugStatsIntervalId) {
      clearInterval(this.debugStatsIntervalId);
      this.debugStatsIntervalId = undefined;
    }

    this.entityIdLabels.forEach((label, entityId) => {
      this.armyModel.removeLabel(this.toNumericId(entityId));
      this.labelPool.release(label);
    });
    this.entityIdLabels.clear();

    this.armyPaths.clear();
    this.movingArmySourceBuckets.clear();
    this.preCommitArmyQueue.clear();
    this.movementStartListeners.clear();
    this.movementCompleteListeners.clear();
    this.movementVisualCancelListeners.clear();

    destroyArmyManagerOwnedResources({
      pathRenderer: this.pathRenderer,
      guiFolders: this.guiFolders,
    });
    this.selectedArmyForPath = null;

    this.proceduralArmyPresentationBuffer.length = 0;
    this.syncProceduralArmyRepresentationVisibility();
    this.proceduralArmyCharacterLayer.dispose();
    this.proceduralArmyPresentations.clear();

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
    this.compactLabelRenderer.dispose();

    // Clean up any other resources...
  }
}
