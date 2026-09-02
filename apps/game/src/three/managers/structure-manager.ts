import { useAccountStore } from "@/hooks/store/use-account-store";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { getGameModeConfig } from "@/config/game-modes";
import type { GameModeConfig } from "@/config/game-modes";
import { isVillageLikeStructureCategory } from "@/lib/structure-type-utils";
import InstancedModel, { LAND_NAME } from "@/three/managers/instanced-model";
import { recordWorldmapRenderDuration, setWorldmapRenderGauge } from "@/three/perf/worldmap-render-diagnostics";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { FLAT_TERRAIN_SURFACE, placePositionOnTerrain } from "@/three/terrain/terrain-surface";
import { gltfLoader, isAddressEqualToAccount } from "@/three/utils/utils";
import { FELT_CENTER } from "@/ui/config";
import type { SetupResult } from "@bibliothecadao/dojo";
import {
  divideByPrecision,
  getIsBlitz,
  getStructureInfoFromTileOccupier,
  getStructureName,
  TROOP_TIERS,
  unpackBuildingCounts,
  type GuardArmy,
  type IncomingTroopArrival,
} from "@bibliothecadao/eternum";
import type {
  StructureSpatialProjectionChange,
  StructureSpatialRenderable,
  WorldSpatialBounds,
  WorldSpatialProjection,
} from "@bibliothecadao/eternum/game-sync";
import { BuildingType, ClientComponents, GuardSlot, ID, StructureType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import * as THREE from "three";
import { Box3, Euler, Group, Object3D, Scene, Sphere, Vector3 } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { AttachmentTransform, CosmeticAttachmentTemplate } from "../cosmetics";
import {
  CosmeticAttachmentManager,
  findCosmeticById,
  playerCosmeticsStore,
  resolveStructureCosmetic,
  resolveStructureMountTransforms,
} from "../cosmetics";
import { resolveAllSkinGltfs } from "../cosmetics/skin-asset-source";
import type { StructureInfo } from "../types";
import type { AnimationVisibilityContext } from "../types/animation";
import type { RenderChunkSize } from "../types/common";
import { getWorldPositionForHex, getWorldPositionForHexCoordsInto, hashCoordinates } from "../utils";
import { CentralizedVisibilityManager } from "../utils/centralized-visibility-manager";
import { getRenderBounds } from "../utils/chunk-geometry";
import { getBattleTimerLeft } from "../utils/combat-directions";
import { FrustumManager } from "../utils/frustum-manager";
import { createStructureLabel, updateStructureLabel } from "../utils/labels/label-factory";
import { LabelPool } from "../utils/labels/label-pool";
import { applyLabelTransitions, transitionManager } from "../utils/labels/label-transitions";
import { snapshotRendererDiagnostics } from "../renderer-diagnostics";
import { FXManager } from "./fx-manager";
import type { HoverLabelShowResult } from "./hover-label-show-result";
import {
  bindManagerChunkRuntimeState,
  recoverManagerChunkRuntimeAfterStall,
  type ManagerChunkUpdateOptions,
  type RecoverManagerChunkRuntimeAfterStallInput,
  runManagerChunkUpdateRuntime,
} from "./manager-chunk-runtime";
import {
  createAsyncPassFence,
  createCoalescedAsyncUpdateRunner,
  isCommittedManagerChunk,
  MANAGER_UNCOMMITTED_CHUNK,
  shouldAcceptManagerChunkRequest,
  shouldRunManagerChunkUpdate,
  waitForVisualSettle,
} from "./manager-update-convergence";
import { resolvePointLabelTextureFlipY } from "./point-label-texture-policy";
import { PointsLabelRenderer } from "./points-label-renderer";
import { CompactEntityLabelRenderer } from "./compact-entity-label-renderer";
import {
  resolveCompactEntityLabelVariant,
  resolveStructureCompactEntityLabel,
  type CompactEntityLabelVariant,
} from "./compact-entity-label-policy";
import { cleanupVisibleStructurePass } from "./structure-visible-pass-cleanup";
import { applyVisibleStructurePresentation } from "./structure-visible-presentation";
import {
  commitManagerVisibilityDiff,
  createManagerVisibilityDiff,
  type ManagerVisibilityDiff,
} from "./manager-visibility-diff";
import { buildStructureModelPreloadPlan, type StructureModelPreloadPlan } from "./structure-model-preload-plan";
import {
  buildStructureLabelDataKey,
  resolveStructureIncomingTroopArrivals,
  resolveTimedStructureLabelState,
  shouldTrackTimedStructureLabel,
} from "./structure-label-state";
import { removeStructureLabels, syncStructureLabelVisibility } from "./structure-label-visibility";
import { normalizeStructureEntityId as normalizeEntityId } from "./structure-entity-id";
import { gameEntityKey } from "@/sync/game-scope";
import {
  isFrameBudgetWorkQueueDisposedError,
  scheduleFrameBudgetWork,
  type FrameBudgetWorkLane,
  type FrameBudgetWorkScheduler,
} from "../frame-budget-work-queue";

// Fixed buffer capacity per structure model — buffers never grow (InstancedModel
// refuses overflow loudly), so this is sized to the worst-case count of one
// structure type in a render area, not a growth seed.
const STRUCTURE_INSTANCE_CAPACITY = 512;
const WONDER_MODEL_INDEX = 4;

interface ChunkBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// Chunk authority can move by one stride while the camera moves by one hex at a boundary.
// Structures are sparse, so keep the neighboring presentation window live to avoid edge flicker.
function expandBoundsForStructurePresentation(bounds: ChunkBounds, chunkStride: number): ChunkBounds {
  const overlap = Math.max(0, Math.floor(chunkStride));

  return {
    minCol: bounds.minCol - overlap,
    maxCol: bounds.maxCol + overlap,
    minRow: bounds.minRow - overlap,
    maxRow: bounds.maxRow + overlap,
  };
}

interface VisibleStructurePassSnapshot {
  chunkKey: string;
  passFenceSnapshot: {
    version: number;
  };
  transitionToken?: number;
}

interface StructureInstanceBinding {
  entityIdsByInstance: Map<number, ID>;
  instanceIndex: number;
  model: InstancedModel;
}

interface VisibleStructureRefreshOptions {
  refreshEntityIds?: Iterable<ID>;
  refreshExisting?: boolean;
  transitionToken?: number;
  workLane?: FrameBudgetWorkLane;
}

type EntityStructureRenderable = Extract<StructureSpatialRenderable, { reserved: false }>;

// Structures inside the committed chunk's presentation bounds. Seeded by one bounds query per
// chunk change and kept current from the projection change set, so a change batch never re-queries.
interface VisibleStructureWindow {
  chunkKey: string;
  /** Contract-space bounds, matching the projection's coordinates. */
  bounds: WorldSpatialBounds;
  structures: Map<ID, EntityStructureRenderable>;
}

interface StructureManagerMetrics {
  structureInfoCacheHits: number;
  structureInfoCacheMisses: number;
  visibleStructureBoundsQueries: number;
  visibleStructureChangeSetUpdates: number;
}

function isWithinBounds(hexCoords: { col: number; row: number }, bounds: WorldSpatialBounds): boolean {
  return (
    hexCoords.col >= bounds.minCol &&
    hexCoords.col <= bounds.maxCol &&
    hexCoords.row >= bounds.minRow &&
    hexCoords.row <= bounds.maxRow
  );
}

export class StructureManager {
  private scene: Scene;
  private structureModels: Map<StructureType, InstancedModel[]> = new Map();
  private structureModelPromises: Map<StructureType, Promise<InstancedModel[]>> = new Map();
  private structureModelPaths: Record<string, string[]>;
  // Cosmetic skin models keyed by cosmeticId
  private cosmeticStructureModels: Map<string, InstancedModel[]> = new Map();
  private cosmeticStructureModelPromises: Map<string, Promise<InstancedModel[]>> = new Map();
  private isUpdatingVisibleStructures = false;
  private readonly runVisibleStructuresUpdate: () => Promise<void>;
  private entityIdMaps: Map<StructureType, Map<number, ID>> = new Map();
  // Cosmetic entity ID maps keyed by cosmeticId
  private cosmeticEntityIdMaps: Map<string, Map<number, ID>> = new Map();
  private structureInstanceBindings: Map<ID, StructureInstanceBinding[]> = new Map();
  private structureInstanceSlots: Map<InstancedModel, Array<ID | undefined>> = new Map();
  private structureInstanceFreeSlots: Map<InstancedModel, number> = new Map();
  private structureModelDrawCounts: Map<InstancedModel, number> = new Map();
  private wonderEntityIdMaps: Map<number, ID> = new Map();
  private entityIdLabels: Map<ID, CSS2DObject> = new Map();
  private labelPool = new LabelPool();
  private dummy: Object3D = new Object3D();
  private currentChunk: string = MANAGER_UNCOMMITTED_CHUNK;
  private renderChunkSize: RenderChunkSize;
  private labelsGroup: Group;
  private currentCameraView: CameraView;
  private hexagonScene?: HexagonScene;
  private fxManager: FXManager;
  private components?: ClientComponents;
  private mode: GameModeConfig;
  private chunkSwitchPromise: Promise<void> | null = null; // Track ongoing chunk switches
  private latestTransitionToken = 0;
  private transitionChunkByToken: Map<number, string> = new Map();
  private timedLabelInterval: NodeJS.Timeout | null = null; // Timer for updating battle and arrival countdowns
  private structuresWithActiveTimedLabels: Set<ID> = new Set(); // Track structures with active timed labels for O(1) lookup
  private unsubscribeAccountStore?: () => void;
  private readonly unsubscribeProjection: () => void;
  private readonly recsUnsubscribes: Array<() => void> = [];
  private readonly incomingTroopArrivalsByStructure = new Map<ID, IncomingTroopArrival[]>();
  private readonly battleDirectionsByStructure = new Map<
    ID,
    { attackedFromDegrees?: number; attackedTowardDegrees?: number }
  >();
  private attachmentManager: CosmeticAttachmentManager;
  private structureAttachmentSignatures: Map<number, string> = new Map();
  private activeStructureAttachmentEntities: Set<number> = new Set();
  private readonly tempCosmeticPosition: Vector3 = new Vector3();
  // Scratch vectors for performVisibleStructuresUpdate to avoid allocations
  private readonly scratchPosition: Vector3 = new Vector3();
  private readonly scratchLabelPosition: Vector3 = new Vector3();
  private readonly scratchIconPosition: Vector3 = new Vector3();
  private readonly tempCosmeticRotation: Euler = new Euler();
  private readonly structureAttachmentTransformScratch = new Map<string, AttachmentTransform>();
  private animationCullDistance = 140;
  private labelRenderDistance = Infinity;
  private animationCameraPosition: Vector3 = new Vector3();
  private animationVisibilityContext?: AnimationVisibilityContext;
  private pointsRenderers?: {
    myVillage: PointsLabelRenderer;
    enemyVillage: PointsLabelRenderer;
    allyVillage: PointsLabelRenderer;
    myRealm: PointsLabelRenderer;
    enemyRealm: PointsLabelRenderer;
    allyRealm: PointsLabelRenderer;
    hyperstructure: PointsLabelRenderer;
    bank: PointsLabelRenderer;
    fragmentMine: PointsLabelRenderer;
  };
  private compactLabelRenderer: CompactEntityLabelRenderer;
  private frustumManager?: FrustumManager;
  private frustumVisibilityDirty = false;
  private lastLabelVisibilityUpdate = 0;
  private labelVisibilityIntervalMs = 66;
  private visibilityManager?: CentralizedVisibilityManager;
  private currentChunkBounds?: { box: Box3; sphere: Sphere };
  private chunkAssetPrewarmPromises: Map<string, Promise<void>> = new Map();
  private unsubscribeFrustum?: () => void;
  private unsubscribeVisibility?: () => void;
  private chunkStride: number;
  private hasPendingModelBounds = false;
  private visibleStructureCount = 0;
  private readonly visibleStructurePassFence = createAsyncPassFence();
  private pendingVisibleStructureWorkLane: FrameBudgetWorkLane = "visible";
  private shouldRefreshExistingStructures = false;
  private pendingVisibleStructureRefreshIds = new Set<ID>();
  private pendingVisibleStructureTransitionToken?: number;
  private previousVisibleIds: Set<ID> = new Set(); // Committed visible ownership; also drives point cleanup.
  private visibleStructureWindow?: VisibleStructureWindow;
  // Per-entity StructureInfo; a Structure, StructureBuildings, Hyperstructure, or projection change deletes the entry.
  private readonly structureInfoCache = new Map<ID, StructureInfo>();
  private readonly metrics: StructureManagerMetrics = {
    structureInfoCacheHits: 0,
    structureInfoCacheMisses: 0,
    visibleStructureBoundsQueries: 0,
    visibleStructureChangeSetUpdates: 0,
  };
  private isDestroyed = false;

  private readonly worldSpatialProjection: WorldSpatialProjection;

  constructor(
    scene: Scene,
    renderChunkSize: { width: number; height: number },
    worldSpatialProjection: WorldSpatialProjection,
    labelsGroup?: Group,
    hexagonScene?: HexagonScene,
    fxManager?: FXManager,
    dojoContext?: SetupResult,
    frustumManager?: FrustumManager,
    visibilityManager?: CentralizedVisibilityManager,
    chunkStride?: number,
    private readonly chunkWorkScheduler?: FrameBudgetWorkScheduler,
  ) {
    this.scene = scene;
    this.worldSpatialProjection = worldSpatialProjection;
    this.runVisibleStructuresUpdate = createCoalescedAsyncUpdateRunner(() =>
      this.flushPendingVisibleStructureRefresh(),
    );
    this.renderChunkSize = renderChunkSize;
    this.labelsGroup = labelsGroup || new Group();
    this.hexagonScene = hexagonScene;
    this.currentCameraView = hexagonScene?.getCurrentCameraView() ?? CameraView.Medium;
    this.fxManager = fxManager || new FXManager(scene);
    this.attachmentManager = new CosmeticAttachmentManager(scene);
    this.components = dojoContext?.components as ClientComponents | undefined;
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
    this.mode = getGameModeConfig();
    this.structureModelPaths = this.mode.assets.structureModelPaths;
    // Keep chunk stride aligned with the world chunk size so visibility/fetch math matches.
    this.chunkStride = Math.max(1, chunkStride ?? Math.floor(this.renderChunkSize.width / 2));
    this.unsubscribeProjection = worldSpatialProjection.subscribeStructures((changes) => {
      this.handleStructureProjectionChanges(changes);
    });
    this.subscribeToStructurePresentationComponents();

    // Subscribe to camera view changes if scene is provided
    if (hexagonScene) {
      hexagonScene.addCameraViewListener(this.handleCameraViewChange);
    }

    this.unsubscribeAccountStore = useAccountStore.subscribe(() => {
      // isMine is folded into every cached record.
      this.structureInfoCache.clear();
      this.requestVisibleStructuresRefresh({ refreshExisting: true });
    });

    // Initialize points-based icon renderers
    this.initializePointsRenderers();
    this.compactLabelRenderer = new CompactEntityLabelRenderer(scene);

    // Start timed label updates
    this.startTimedLabelUpdates();
  }

  private removeStructurePresentation(entityId: ID): void {
    const entityNumericId = Number(entityId);
    this.attachmentManager.removeAttachments(entityNumericId);
    this.activeStructureAttachmentEntities.delete(entityNumericId);
    this.structureAttachmentSignatures.delete(entityNumericId);

    this.structuresWithActiveTimedLabels.delete(entityId);
    this.incomingTroopArrivalsByStructure.delete(entityId);
    this.battleDirectionsByStructure.delete(entityId);
    this.removeEntityIdLabel(entityId);
    this.removeStructureCompactLabel(entityId);
  }

  private handleStructureProjectionChanges(changes: readonly StructureSpatialProjectionChange[]): void {
    changes.forEach(({ previous, current }) => {
      this.invalidateStructureInfo(previous?.entityId);
      this.invalidateStructureInfo(current?.entityId);
      if (previous && !previous.reserved && !current) {
        this.removeStructurePresentation(previous.entityId);
      }
    });

    const refreshEntityIds = this.applyStructureChangesToVisibleWindow(changes);
    this.metrics.visibleStructureChangeSetUpdates += 1;
    if (refreshEntityIds.size > 0) {
      void this.requestVisibleStructuresRefresh({ refreshEntityIds });
    }
  }

  /** Returns the entity ids whose window membership or record changed, so the pass re-adds only those. */
  private applyStructureChangesToVisibleWindow(changes: readonly StructureSpatialProjectionChange[]): Set<ID> {
    const touchedEntityIds = new Set<ID>();
    const structureWindow = this.visibleStructureWindow;
    if (!structureWindow) return touchedEntityIds;

    changes.forEach(({ previous, current }) => {
      const entityId = normalizeEntityId(current?.entityId ?? previous?.entityId);
      if (entityId === undefined) return;

      const wasVisible = structureWindow.structures.has(entityId);
      const visibleRenderable =
        current && !current.reserved && isWithinBounds(current.hexCoords, structureWindow.bounds) ? current : undefined;
      if (visibleRenderable) {
        structureWindow.structures.set(entityId, visibleRenderable);
      } else {
        structureWindow.structures.delete(entityId);
      }
      if (wasVisible || visibleRenderable) touchedEntityIds.add(entityId);
    });
    return touchedEntityIds;
  }

  private subscribeToStructurePresentationComponents(): void {
    const structureSubscription = this.components?.Structure?.update$.subscribe(({ value }) => {
      const [current, previous] = value;
      const entityId = normalizeEntityId(current?.entity_id ?? previous?.entity_id);
      if (entityId === undefined) return;

      this.playStructureGuardDifferenceFx(
        entityId,
        this.resolveGuardArmies(previous?.troop_guards),
        this.resolveGuardArmies(current?.troop_guards),
      );
      this.refreshStructurePresentation(entityId);
    });
    if (structureSubscription) this.recsUnsubscribes.push(() => structureSubscription.unsubscribe());

    const buildingSubscription = this.components?.StructureBuildings?.update$.subscribe(({ value }) => {
      const [current, previous] = value;
      const entityId = normalizeEntityId(current?.entity_id ?? previous?.entity_id);
      if (entityId !== undefined) this.refreshStructurePresentation(entityId);
    });
    if (buildingSubscription) this.recsUnsubscribes.push(() => buildingSubscription.unsubscribe());

    const hyperstructureSubscription = this.components?.Hyperstructure?.update$.subscribe(({ value }) => {
      const [current, previous] = value;
      const entityId = normalizeEntityId(current?.hyperstructure_id ?? previous?.hyperstructure_id);
      if (entityId !== undefined) this.refreshStructurePresentation(entityId);
    });
    if (hyperstructureSubscription) this.recsUnsubscribes.push(() => hyperstructureSubscription.unsubscribe());

    const addressNameSubscription = this.components?.AddressName?.update$.subscribe(() => {
      // Owner names are folded into every cached record.
      this.structureInfoCache.clear();
      this.entityIdLabels.forEach((_label, entityId) => {
        this.refreshTrackedStructureLabelOrPrune(entityId);
      });
    });
    if (addressNameSubscription) this.recsUnsubscribes.push(() => addressNameSubscription.unsubscribe());
  }

  private refreshStructurePresentation(entityId: ID): void {
    this.invalidateStructureInfo(entityId);
    const structure = this.resolveStructureInfoByEntityId(entityId);
    if (structure) {
      this.refreshStructureLabelIfTracked(entityId, structure);
    } else {
      this.removeStructurePresentation(entityId);
    }
    this.requestVisibleStructuresRefreshForEntities([entityId]);
  }

  private resolveStructureInfoByEntityId(entityId: ID): StructureInfo | undefined {
    const renderable = this.worldSpatialProjection.getStructure(entityId);
    return renderable ? this.resolveStructureInfo(renderable) : undefined;
  }

  private resolveStructureInfo(renderable: StructureSpatialRenderable): StructureInfo | undefined {
    if (renderable.reserved) return undefined;

    const cached = this.structureInfoCache.get(renderable.entityId);
    if (cached) {
      this.metrics.structureInfoCacheHits += 1;
      return cached;
    }

    this.metrics.structureInfoCacheMisses += 1;
    const structure = this.buildStructureInfo(renderable);
    if (structure) {
      this.structureInfoCache.set(renderable.entityId, structure);
      // battleTimerLeft and incomingTroopArrivals are time-derived; the timed label loop keeps them
      // current for tracked ids, so a cached record with an active timer must be tracked.
      this.updateTimedLabelTracking(renderable.entityId, structure.battleCooldownEnd, structure.incomingTroopArrivals);
    }
    return structure;
  }

  private invalidateStructureInfo(entityId: ID | null | undefined): void {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId !== undefined) this.structureInfoCache.delete(normalizedEntityId);
  }

  private buildStructureInfo(renderable: EntityStructureRenderable): StructureInfo | undefined {
    const renderInfo = getStructureInfoFromTileOccupier(renderable.occupierType);
    if (!renderInfo || renderInfo.reserved) return undefined;

    const structureComponent = this.components?.Structure
      ? getComponentValue(this.components.Structure, gameEntityKey([BigInt(renderable.entityId)]))
      : undefined;
    const ownerAddress = structureComponent?.owner ?? 0n;
    const ownerName = this.resolveLiveStructureOwnerName(renderable.entityId, ownerAddress, "");
    const cosmetic = this.resolveStructureCosmeticSelection({
      owner: ownerAddress,
      structureType: renderInfo.type,
      stage: renderInfo.stage,
    });
    const battleCooldownEnd = this.resolveBattleCooldownEnd(structureComponent?.troop_guards);
    const battleDirections = this.battleDirectionsByStructure.get(renderable.entityId);

    return {
      entityId: renderable.entityId,
      structureName: structureComponent
        ? getStructureName(structureComponent, getIsBlitz()).name
        : `${StructureType[renderInfo.type] ?? "Structure"} ${renderable.entityId}`,
      hexCoords: {
        col: renderable.hexCoords.col - FELT_CENTER(),
        row: renderable.hexCoords.row - FELT_CENTER(),
      },
      stage: renderInfo.stage,
      initialized: this.resolveHyperstructureInitialized(renderable.entityId, renderInfo.type),
      level: renderInfo.level,
      isMine: isAddressEqualToAccount(ownerAddress),
      isAlly: false,
      owner: { address: ownerAddress, ownerName, guildName: "" },
      structureType: renderInfo.type,
      hasWonder: renderInfo.hasWonder,
      cosmeticId: cosmetic.skin.cosmeticId,
      cosmeticAssetPaths: cosmetic.skin.assetPaths,
      usesFallbackCosmeticSkin: cosmetic.skin.isFallback,
      attachments: cosmetic.attachments,
      guardArmies: this.resolveGuardArmies(structureComponent?.troop_guards),
      activeProductions: this.resolveActiveProductions(renderable.entityId),
      incomingTroopArrivals: this.incomingTroopArrivalsByStructure.get(renderable.entityId),
      hyperstructureRealmCount: structureComponent?.metadata?.villages_count,
      attackedFromDegrees: battleDirections?.attackedFromDegrees,
      attackedTowardDegrees: battleDirections?.attackedTowardDegrees,
      battleCooldownEnd,
      battleTimerLeft: getBattleTimerLeft(battleCooldownEnd),
    };
  }

  private resolveHyperstructureInitialized(entityId: ID, structureType: StructureType): boolean {
    if (structureType !== StructureType.Hyperstructure || !this.components?.Hyperstructure) return false;
    return Boolean(getComponentValue(this.components.Hyperstructure, gameEntityKey([BigInt(entityId)]))?.initialized);
  }

  private resolveActiveProductions(entityId: ID): Array<{ buildingCount: number; buildingType: BuildingType }> {
    if (!this.components?.StructureBuildings) return [];
    const buildings = getComponentValue(this.components.StructureBuildings, gameEntityKey([BigInt(entityId)]));
    if (!buildings) return [];

    const counts = unpackBuildingCounts([
      BigInt(buildings.packed_counts_1 ?? 0),
      BigInt(buildings.packed_counts_2 ?? 0),
      BigInt(buildings.packed_counts_3 ?? 0),
    ]);
    return counts.flatMap((buildingCount, index) =>
      buildingCount > 0 ? [{ buildingCount, buildingType: (index + 1) as BuildingType }] : [],
    );
  }

  private resolveGuardArmies(troopGuards: any): GuardArmy[] {
    if (!troopGuards) return [];

    const resolveGuard = (slot: GuardSlot, guard: any): GuardArmy => ({
      slot,
      category: guard?.category ?? null,
      tier: TROOP_TIERS[guard?.tier] ?? 1,
      count: divideByPrecision(Number(guard?.count ?? 0)),
      stamina: Number(guard?.stamina?.amount ?? 0),
    });

    return [
      resolveGuard(GuardSlot.Delta, troopGuards.delta),
      resolveGuard(GuardSlot.Charlie, troopGuards.charlie),
      resolveGuard(GuardSlot.Bravo, troopGuards.bravo),
      resolveGuard(GuardSlot.Alpha, troopGuards.alpha),
    ];
  }

  private resolveBattleCooldownEnd(troopGuards: any): number {
    if (!troopGuards) return 0;
    return Math.max(
      troopGuards.alpha?.battle_cooldown_end ?? 0,
      troopGuards.bravo?.battle_cooldown_end ?? 0,
      troopGuards.charlie?.battle_cooldown_end ?? 0,
      troopGuards.delta?.battle_cooldown_end ?? 0,
    );
  }

  private initializePointsRenderers(): void {
    const textureLoader = new THREE.TextureLoader();
    const texturePaths = {
      myVillage: "/images/labels/village.png",
      enemyVillage: "/images/labels/enemy_village.png",
      allyVillage: "/images/labels/allies_village.png",
      myRealm: "/images/labels/realm.png",
      enemyRealm: "/images/labels/enemy_realm.png",
      allyRealm: "/images/labels/allies_realm.png",
      hyperstructure: "/images/labels/hyperstructure.png",
      bank: "/images/labels/chest.png", // Using chest as placeholder for bank
      fragmentMine: this.mode.assets.labels.fragmentMine,
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

          if (loadedCount === totalTextures) {
            const scaledPointSize = 40;
            this.pointsRenderers = {
              myVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.myVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              enemyVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemyVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              allyVillage: new PointsLabelRenderer(
                this.scene,
                loadedTextures.allyVillage!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              myRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.myRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              enemyRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.enemyRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              allyRealm: new PointsLabelRenderer(
                this.scene,
                loadedTextures.allyRealm!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              hyperstructure: new PointsLabelRenderer(
                this.scene,
                loadedTextures.hyperstructure!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              bank: new PointsLabelRenderer(
                this.scene,
                loadedTextures.bank!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
              fragmentMine: new PointsLabelRenderer(
                this.scene,
                loadedTextures.fragmentMine!,
                1000,
                scaledPointSize,
                0,
                1.3,
                false,
                this.frustumManager,
                this.visibilityManager,
              ),
            };

            if (isCommittedManagerChunk(this.currentChunk)) {
              this.requestVisibleStructuresRefresh({ refreshExisting: true });
            }
          }
        },
        undefined,
        (error) => {
          console.error(`[StructureManager] Failed to load structure icon texture (${key}):`, error);
        },
      );
    });
  }

  private handleCameraViewChange = (view: CameraView) => {
    if (this.currentCameraView === view) {
      this.updateShadowFlags();
      return;
    }

    // If we're moving away from Medium view, clean up transition state
    if (this.currentCameraView === CameraView.Medium) {
      transitionManager.clearMediumViewTransition();
    }

    this.currentCameraView = view;

    // If we're switching to Medium view, store timestamp
    if (view === CameraView.Medium) {
      transitionManager.setMediumViewTransition();
    }

    // Use the centralized label transition function
    applyLabelTransitions(this.entityIdLabels, view);
    this.updateShadowFlags();
  };

  private updateShadowFlags(): void {
    const shadowsEnabled = this.hexagonScene?.getShadowsEnabled() ?? true;
    const enableCasting = this.currentCameraView === CameraView.Close && shadowsEnabled;
    const enableContactShadows = !enableCasting;
    const applyToModels = (models: InstancedModel[]) => {
      models.forEach((model) => {
        model.instancedMeshes.forEach((mesh) => {
          if (mesh.name === LAND_NAME) {
            mesh.castShadow = false;
            return;
          }
          mesh.castShadow = enableCasting;
        });
        model.setContactShadowsEnabled(enableContactShadows);
      });
    };

    this.structureModels.forEach((models) => applyToModels(models));
    this.cosmeticStructureModels.forEach((models) => applyToModels(models));
  }

  public destroy() {
    if (this.isDestroyed) {
      console.warn("StructureManager already destroyed, skipping cleanup");
      return;
    }
    this.isDestroyed = true;
    this.unsubscribeProjection();
    this.recsUnsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());

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

    // Clean up timed label interval
    if (this.timedLabelInterval) {
      clearInterval(this.timedLabelInterval);
      this.timedLabelInterval = null;
    }

    this.entityIdLabels.forEach((label) => {
      this.labelsGroup.remove(label);
      this.labelPool.release(label);
    });
    this.entityIdLabels.clear();

    this.labelPool.clear();

    this.attachmentManager.clear();
    this.activeStructureAttachmentEntities.clear();
    this.structureAttachmentSignatures.clear();

    // Dispose of all structure models
    this.structureModels.forEach((models) => {
      models.forEach((model) => {
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        if (model.group.parent) {
          model.group.parent.remove(model.group);
        }
      });
    });
    this.structureModels.clear();

    // Dispose of cosmetic structure models
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => {
        if (typeof model.dispose === "function") {
          model.dispose();
        }
        if (model.group.parent) {
          model.group.parent.remove(model.group);
        }
      });
    });
    this.cosmeticStructureModels.clear();

    // Clear all maps
    this.entityIdMaps.clear();
    this.cosmeticEntityIdMaps.clear();
    this.wonderEntityIdMaps.clear();
    this.structureInstanceBindings.clear();
    this.structureInstanceSlots.clear();
    this.structureInstanceFreeSlots.clear();
    this.structureModelDrawCounts.clear();
    this.pendingVisibleStructureRefreshIds.clear();
    this.incomingTroopArrivalsByStructure.clear();
    this.battleDirectionsByStructure.clear();
    this.structuresWithActiveTimedLabels.clear();
    this.previousVisibleIds.clear();
    this.structureInfoCache.clear();
    this.visibleStructureWindow = undefined;

    // Clean up points renderers
    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.dispose());
    }
    this.compactLabelRenderer.dispose();

    if (this.unsubscribeVisibility) {
      this.unsubscribeVisibility();
      this.unsubscribeVisibility = undefined;
    }
  }

  getTotalStructures() {
    return this.worldSpatialProjection.getStructures().filter((structure) => !structure.reserved).length;
  }

  public prewarmChunkAssets(chunkKey: string): Promise<void> {
    const existing = this.chunkAssetPrewarmPromises.get(chunkKey);
    if (existing) {
      return existing;
    }

    const [startRow, startCol] = chunkKey.split(",").map(Number);
    if (!Number.isFinite(startRow) || !Number.isFinite(startCol)) {
      return Promise.resolve();
    }

    const prewarmPromise = (async () => {
      const visibleStructures = this.queryStructureInfosInChunk(startRow, startCol);
      const structureTypes = new Set<StructureType>();
      const cosmeticAssets = new Map<string, string[]>();

      visibleStructures.forEach((structure) => {
        if (this.hasCosmeticSkin(structure)) {
          const cosmeticId = structure.cosmeticId ?? "";
          const assetPaths = structure.cosmeticAssetPaths ?? [];
          if (cosmeticId && assetPaths.length > 0 && !cosmeticAssets.has(cosmeticId)) {
            cosmeticAssets.set(cosmeticId, assetPaths);
          }
          return;
        }

        structureTypes.add(structure.structureType);
      });

      await Promise.all([
        ...Array.from(structureTypes, (structureType) => this.ensureStructureModels(structureType)),
        ...Array.from(cosmeticAssets.entries(), ([cosmeticId, assetPaths]) =>
          this.ensureCosmeticStructureModels(cosmeticId, assetPaths),
        ),
      ]);
    })().finally(() => {
      this.chunkAssetPrewarmPromises.delete(chunkKey);
    });

    this.chunkAssetPrewarmPromises.set(chunkKey, prewarmPromise);
    return prewarmPromise;
  }

  private async ensureStructureModels(structureType: StructureType): Promise<InstancedModel[]> {
    if (this.structureModels.has(structureType)) {
      return this.structureModels.get(structureType)!;
    }

    let pending = this.structureModelPromises.get(structureType);
    if (pending) {
      return pending;
    }

    const modelPaths = this.structureModelPaths[String(structureType)] ?? [];
    if (modelPaths.length === 0) {
      const empty: InstancedModel[] = [];
      this.structureModels.set(structureType, empty);
      return empty;
    }

    pending = Promise.all(modelPaths.map((modelPath) => this.loadStructureModel(structureType, modelPath)))
      .then((models) => {
        this.structureModels.set(structureType, models);
        models.forEach((model) => {
          this.scene.add(model.group);
          if (this.currentChunkBounds) {
            model.setWorldBounds(this.currentChunkBounds);
          }
        });
        return models;
      })
      .finally(() => {
        this.structureModelPromises.delete(structureType);
      });

    this.structureModelPromises.set(structureType, pending);
    return pending;
  }

  private loadStructureModel(structureType: StructureType, modelPath: string): Promise<InstancedModel> {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        modelPath,
        (gltf) => {
          try {
            const instancedModel = new InstancedModel(
              gltf,
              STRUCTURE_INSTANCE_CAPACITY,
              false,
              modelPath.includes("wonder") ? "wonder" : StructureType[structureType],
            );
            resolve(instancedModel);
          } catch (error) {
            reject(error);
          }
        },
        undefined,
        (error) => {
          console.error(modelPath);
          console.error(`An error occurred while loading the ${StructureType[structureType]} model:`, error);
          reject(error);
        },
      );
    });
  }

  /**
   * Ensures cosmetic structure models are loaded for a given cosmeticId.
   * Returns the loaded models or empty array if loading fails.
   */
  private async ensureCosmeticStructureModels(cosmeticId: string, assetPaths: string[]): Promise<InstancedModel[]> {
    if (this.cosmeticStructureModels.has(cosmeticId)) {
      return this.cosmeticStructureModels.get(cosmeticId)!;
    }

    let pending = this.cosmeticStructureModelPromises.get(cosmeticId);
    if (pending) {
      return pending;
    }

    if (assetPaths.length === 0) {
      const empty: InstancedModel[] = [];
      this.cosmeticStructureModels.set(cosmeticId, empty);
      return empty;
    }

    pending = this.loadCosmeticStructureModels(cosmeticId, assetPaths)
      .then((models) => {
        this.cosmeticStructureModels.set(cosmeticId, models);
        models.forEach((model) => {
          this.scene.add(model.group);
          if (this.currentChunkBounds) {
            model.setWorldBounds(this.currentChunkBounds);
          }
        });
        return models;
      })
      .catch((error) => {
        console.warn(`[StructureManager] Failed to load cosmetic models for ${cosmeticId}:`, error);
        const empty: InstancedModel[] = [];
        this.cosmeticStructureModels.set(cosmeticId, empty);
        return empty;
      })
      .finally(() => {
        this.cosmeticStructureModelPromises.delete(cosmeticId);
      });

    this.cosmeticStructureModelPromises.set(cosmeticId, pending);
    return pending;
  }

  private async loadCosmeticStructureModels(cosmeticId: string, assetPaths: string[]): Promise<InstancedModel[]> {
    const gltfs = await resolveAllSkinGltfs({
      cosmeticId,
      assetPaths,
      registryEntry: findCosmeticById(cosmeticId),
    });

    return gltfs.map((gltf) => new InstancedModel(gltf, STRUCTURE_INSTANCE_CAPACITY, false, cosmeticId, "cache"));
  }

  private resolveLiveStructureOwnerName(entityId: ID, ownerAddress: bigint, fallbackOwnerName: string): string {
    if (!this.components?.AddressName) {
      return fallbackOwnerName;
    }

    const addressName = getComponentValue(this.components.AddressName, getEntityIdFromKeys([ownerAddress]));
    if (!addressName?.name) {
      return fallbackOwnerName;
    }

    try {
      return shortString.decodeShortString(addressName.name.toString());
    } catch (error) {
      console.warn(`[StructureManager] Failed to decode owner name for ${entityId}:`, error);
      return fallbackOwnerName;
    }
  }

  private resolveStructureCosmeticSelection(input: {
    owner: bigint;
    structureType: StructureType;
    stage: number;
  }): ReturnType<typeof resolveStructureCosmetic> {
    if (this.components && input.owner !== 0n) {
      playerCosmeticsStore.hydrateFromBlitzComponent(this.components, input.owner);
    }

    const enumName = StructureType[input.structureType as unknown as keyof typeof StructureType];
    const defaultModelKey = typeof enumName === "string" ? enumName : String(input.structureType);

    return resolveStructureCosmetic({
      owner: input.owner,
      structureType: input.structureType,
      stage: input.stage,
      defaultModelKey,
    });
  }

  private refreshTrackedStructureLabelOrPrune(entityId: ID): void {
    const structure = this.resolveStructureInfoByEntityId(entityId);
    if (!structure) {
      this.removeStructurePresentation(entityId);
      return;
    }

    this.refreshStructureLabelIfTracked(entityId, structure);
  }

  /** Contract-space bounds of the structures presented for a chunk, matching the projection's coordinates. */
  private resolveStructurePresentationBounds(startRow: number, startCol: number): WorldSpatialBounds {
    const renderBounds = getRenderBounds(startRow, startCol, this.renderChunkSize, this.chunkStride);
    const bounds = expandBoundsForStructurePresentation(renderBounds, this.chunkStride);
    const center = FELT_CENTER();
    return {
      minCol: bounds.minCol + center,
      maxCol: bounds.maxCol + center,
      minRow: bounds.minRow + center,
      maxRow: bounds.maxRow + center,
    };
  }

  async updateChunk(chunkKey: string, options?: ManagerChunkUpdateOptions) {
    if (this.isDestroyed) {
      return;
    }
    await runManagerChunkUpdateRuntime({
      chunkKey,
      executeChunkUpdate: async (nextChunkKey, nextOptions) => {
        if (
          !shouldRunManagerChunkUpdate({
            chunkKey: nextChunkKey,
            currentChunk: this.currentChunk,
            transitionToken: nextOptions?.transitionToken,
            latestTransitionToken: this.latestTransitionToken,
          })
        ) {
          return false;
        }

        await this.requestVisibleStructuresRefresh({
          refreshExisting: nextOptions?.refreshExisting ?? false,
          transitionToken: nextOptions?.transitionToken,
          workLane: "critical",
        });
      },
      isDestroyed: () => this.isDestroyed,
      onPreviousUpdateFailed: (error) => {
        console.warn(`Previous structure chunk switch failed:`, error);
      },
      options,
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
    this.isUpdatingVisibleStructures = false;
    this.visibleStructurePassFence.invalidate();
  }

  private resolveChunkUpdateRuntimeState() {
    return bindManagerChunkRuntimeState({
      getCurrentChunk: () => this.currentChunk,
      setCurrentChunk: (chunkKey) => {
        this.currentChunk = chunkKey ?? MANAGER_UNCOMMITTED_CHUNK;
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

  getStructureByHexCoords(hexCoords: { col: number; row: number }) {
    const center = FELT_CENTER();
    const renderable = this.worldSpatialProjection
      .getStructuresAtHex({ col: hexCoords.col + center, row: hexCoords.row + center })
      .find((structure) => !structure.reserved);
    return renderable ? this.resolveStructureInfo(renderable) : undefined;
  }

  public getVisibleCount(): number {
    return this.visibleStructureCount;
  }

  public getStructureManagerMetrics(): StructureManagerMetrics {
    return { ...this.metrics };
  }

  public refreshCosmeticsForOwner(owner: string | bigint): void {
    const normalizedOwner = BigInt(owner);
    const refreshEntityIds = this.worldSpatialProjection.getStructures().flatMap((renderable) => {
      if (renderable.reserved || !this.components?.Structure) return [];
      const matchesOwner =
        getComponentValue(this.components.Structure, gameEntityKey([BigInt(renderable.entityId)]))?.owner ===
        normalizedOwner;
      return matchesOwner ? [renderable.entityId] : [];
    });
    refreshEntityIds.forEach((entityId) => this.invalidateStructureInfo(entityId));
    this.requestVisibleStructuresRefreshForEntities(refreshEntityIds);
  }

  // Component rows change facts, not positions: only structures inside the window need a pass.
  private requestVisibleStructuresRefreshForEntities(entityIds: readonly ID[]): void {
    const refreshEntityIds = entityIds.filter((entityId) => this.visibleStructureWindow?.structures.has(entityId));
    if (refreshEntityIds.length > 0) {
      void this.requestVisibleStructuresRefresh({ refreshEntityIds });
    }
  }

  private requestVisibleStructuresRefresh(options: VisibleStructureRefreshOptions = {}): Promise<void> {
    if (this.isDestroyed) {
      return Promise.resolve();
    }

    this.recordPendingVisibleStructureRefresh(options);

    if (!isCommittedManagerChunk(this.currentChunk)) {
      return Promise.resolve();
    }

    return this.runVisibleStructuresUpdate().catch((error) => {
      if (isFrameBudgetWorkQueueDisposedError(error)) {
        return;
      }
      console.error("Failed to update visible structures", error);
    });
  }

  private async flushPendingVisibleStructureRefresh(): Promise<boolean> {
    const options = this.takePendingVisibleStructureRefresh();
    this.isUpdatingVisibleStructures = true;
    try {
      const committed = await this.performVisibleStructuresUpdate(options);
      if (!committed && !this.isDestroyed) {
        this.recordPendingVisibleStructureRefresh(options);
      }
      return committed || this.isDestroyed;
    } catch (error) {
      if (!this.isDestroyed) {
        this.recordPendingVisibleStructureRefresh({ ...options, refreshExisting: true });
      }
      throw error;
    } finally {
      this.isUpdatingVisibleStructures = false;
    }
  }

  private takePendingVisibleStructureRefresh(): VisibleStructureRefreshOptions {
    const options = {
      refreshEntityIds: this.pendingVisibleStructureRefreshIds,
      refreshExisting: this.shouldRefreshExistingStructures,
      transitionToken: this.pendingVisibleStructureTransitionToken,
      workLane: this.pendingVisibleStructureWorkLane,
    };
    this.pendingVisibleStructureWorkLane = "visible";
    this.shouldRefreshExistingStructures = false;
    this.pendingVisibleStructureRefreshIds = new Set();
    this.pendingVisibleStructureTransitionToken = undefined;
    return options;
  }

  private recordPendingVisibleStructureRefresh(options: VisibleStructureRefreshOptions): void {
    if (options.workLane === "critical") {
      this.pendingVisibleStructureWorkLane = "critical";
    }
    this.shouldRefreshExistingStructures ||= options.refreshExisting ?? false;
    for (const entityId of options.refreshEntityIds ?? []) {
      this.pendingVisibleStructureRefreshIds.add(entityId);
    }
    if (options.transitionToken !== undefined) {
      this.pendingVisibleStructureTransitionToken = Math.max(
        options.transitionToken,
        this.pendingVisibleStructureTransitionToken ?? options.transitionToken,
      );
    }
  }

  private resolveStructureAttachmentsForRender(structure: StructureInfo): CosmeticAttachmentTemplate[] {
    return structure.attachments ? [...structure.attachments] : [];
  }

  /**
   * Check if a structure uses a non-default cosmetic skin.
   */
  private hasCosmeticSkin(structure: StructureInfo): boolean {
    if (!structure.cosmeticId || !structure.cosmeticAssetPaths?.length) {
      return false;
    }
    return !structure.usesFallbackCosmeticSkin;
  }

  private getModelForStructure(structure: StructureInfo): InstancedModel | undefined {
    if (this.hasCosmeticSkin(structure)) {
      return this.cosmeticStructureModels.get(structure.cosmeticId ?? "")?.[0];
    }

    const models = this.structureModels.get(structure.structureType);
    if (!models || models.length === 0) {
      return undefined;
    }

    if (structure.structureType === StructureType.Realm) {
      return models[structure.level];
    }

    return models[structure.stage];
  }

  private async performVisibleStructuresUpdate(options: VisibleStructureRefreshOptions = {}): Promise<boolean> {
    if (this.isDestroyed) {
      return false;
    }

    const updateStartedAt = performance.now();
    if (!isCommittedManagerChunk(this.currentChunk)) {
      this.visibleStructureCount = 0;
      setWorldmapRenderGauge("visibleStructures", 0);
      return false;
    }
    try {
      const visibleStructurePassSnapshot = this.captureVisibleStructurePassSnapshot(options.transitionToken);

      const visibleStructures = this.resolveVisibleStructuresForChunk(visibleStructurePassSnapshot.chunkKey);
      const preloadPlan = this.createStructureModelPreloadPlan(visibleStructures);
      await this.preloadStructureModels(preloadPlan);

      if (this.shouldDiscardVisibleStructurePass(visibleStructurePassSnapshot)) {
        return false;
      }

      const renderableStructures = visibleStructures.filter((structure) => this.getModelForStructure(structure));
      const visibilityDiff = createManagerVisibilityDiff({
        currentVisibleIds: this.previousVisibleIds,
        nextVisibleEntities: renderableStructures,
        getEntityId: (structure) => structure.entityId,
        refreshEntityIds: options.refreshEntityIds,
        refreshExisting: options.refreshExisting,
      });
      return await scheduleFrameBudgetWork(
        this.chunkWorkScheduler,
        options.workLane ?? "visible",
        () => this.commitVisibleStructureDiff(visibleStructurePassSnapshot, visibilityDiff),
        this.resolveVisibleStructureCommitOwner(options),
      );
    } finally {
      recordWorldmapRenderDuration("performVisibleStructuresUpdate", performance.now() - updateStartedAt);
      setWorldmapRenderGauge("visibleStructures", this.visibleStructureCount);
    }
  }

  private resolveVisibleStructureCommitOwner(options: VisibleStructureRefreshOptions): string {
    if (options.refreshExisting) {
      return "manager:structure-full-refresh";
    }
    if (options.refreshEntityIds && [...options.refreshEntityIds].length > 0) {
      return "manager:structure-targeted-refresh";
    }
    return "manager:structure-visibility-diff";
  }

  private createStructureModelPreloadPlan(
    visibleStructures: StructureInfo[],
  ): StructureModelPreloadPlan<StructureType> {
    return buildStructureModelPreloadPlan<StructureInfo, StructureType>({
      visibleStructures,
      hasCosmeticSkin: (structure) => this.hasCosmeticSkin(structure),
      hasStructureModel: (structureType) => this.structureModels.has(structureType),
      hasCosmeticModel: (cosmeticId) => this.cosmeticStructureModels.has(cosmeticId),
    });
  }

  private captureVisibleStructurePassSnapshot(transitionToken?: number): VisibleStructurePassSnapshot {
    return {
      chunkKey: this.currentChunk,
      passFenceSnapshot: this.visibleStructurePassFence.capture(),
      transitionToken,
    };
  }

  private shouldDiscardVisibleStructurePass(snapshot: VisibleStructurePassSnapshot): boolean {
    return (
      this.isDestroyed ||
      this.currentChunk !== snapshot.chunkKey ||
      (snapshot.transitionToken !== undefined && snapshot.transitionToken !== this.latestTransitionToken) ||
      !this.visibleStructurePassFence.isCurrent(snapshot.passFenceSnapshot)
    );
  }

  private async preloadStructureModels(preloadPlan: StructureModelPreloadPlan<StructureType>): Promise<void> {
    const preloadPromises: Promise<unknown>[] = [
      ...preloadPlan.missingStructureModels.map((structureType) => this.ensureStructureModels(structureType)),
      ...preloadPlan.missingCosmeticModels.map(({ cosmeticId, assetPaths }) =>
        this.ensureCosmeticStructureModels(cosmeticId, assetPaths),
      ),
    ];

    if (preloadPromises.length === 0) {
      return;
    }

    try {
      await Promise.all(preloadPromises);
    } catch (error) {
      console.error("Failed to preload structure models", error);
    }
  }

  private resolveVisibleStructureRotationY(structure: StructureInfo): number {
    if (structure.structureType === StructureType.Bank) {
      return (4 * Math.PI) / 6;
    }

    const rotationSeed = hashCoordinates(structure.hexCoords.col, structure.hexCoords.row);
    const rotationIndex = Math.floor(rotationSeed * 6);
    return (rotationIndex * Math.PI) / 3;
  }

  private syncVisibleStructurePresentation(
    previous: StructureInfo | undefined,
    next: StructureInfo,
    rotationY: number,
    attachmentRetain?: Set<number>,
  ): void {
    applyVisibleStructurePresentation({
      previousStructure: previous,
      structure: next,
      rotationY,
      dummy: this.dummy,
      scratchPosition: this.scratchPosition,
      scratchLabelPosition: this.scratchLabelPosition,
      scratchIconPosition: this.scratchIconPosition,
      tempCosmeticPosition: this.tempCosmeticPosition,
      tempCosmeticRotation: this.tempCosmeticRotation,
      getWorldPositionForHexCoordsInto: (col, row, out) => {
        getWorldPositionForHexCoordsInto(col, row, out);
        return placePositionOnTerrain(out, this.hexagonScene?.getTerrainSurface() ?? FLAT_TERRAIN_SURFACE);
      },
      getLabel: (entityId) => this.entityIdLabels.get(Number(entityId) as ID),
      updateLabel: (structure, label) => this.updateStructureLabelData(structure, label),
      syncCompactLabel: (structure, position) => this.updateStructureCompactLabel(structure, position),
      getRendererForStructure: (structure) => this.getRendererForStructure(structure),
      resolveAttachments: (structure) => this.resolveStructureAttachmentsForRender(structure),
      getAttachmentSignature: (templates) => this.getAttachmentSignature(templates),
      activeAttachmentEntities: this.activeStructureAttachmentEntities,
      attachmentSignatures: this.structureAttachmentSignatures,
      spawnAttachments: (entityId, templates) => this.attachmentManager.spawnAttachments(entityId, templates),
      removeAttachments: (entityId) => this.attachmentManager.removeAttachments(entityId),
      resolveMountTransforms: (structure, baseTransform) =>
        resolveStructureMountTransforms(
          structure.structureType,
          baseTransform,
          this.structureAttachmentTransformScratch,
        ),
      updateAttachmentTransforms: (entityId, baseTransform, mountTransforms) =>
        this.attachmentManager.updateAttachmentTransforms(entityId, baseTransform, mountTransforms),
      attachmentRetain,
    });
  }

  private commitVisibleStructureDiff(
    snapshot: VisibleStructurePassSnapshot,
    visibilityDiff: ManagerVisibilityDiff<StructureInfo, ID>,
  ): boolean {
    if (this.shouldDiscardVisibleStructurePass(snapshot)) {
      return false;
    }

    const dirtyModels = new Set<InstancedModel>();
    const visibleNumericIds = new Set(visibilityDiff.visibleIds.map(Number));
    const attachmentRetain = new Set<number>();
    this.activeStructureAttachmentEntities.forEach((entityId) => {
      if (visibleNumericIds.has(entityId)) {
        attachmentRetain.add(entityId);
      }
    });

    if (this.pointsRenderers) {
      Object.values(this.pointsRenderers).forEach((renderer) => renderer.beginBatch());
    }

    try {
      return commitManagerVisibilityDiff({
        diff: visibilityDiff,
        isCurrent: () => !this.shouldDiscardVisibleStructurePass(snapshot),
        remove: (entityId) => this.removeVisibleStructureInstance(entityId, dirtyModels),
        add: (structure) => this.addVisibleStructureInstance(structure, attachmentRetain, dirtyModels),
        commitVisibleIds: (visibleIds) => {
          this.updateVisibleStructureModelCounts(dirtyModels);
          this.applyPendingModelBounds();
          this.visibleStructureCount = visibleIds.length;
          this.finalizeVisibleStructurePass(new Set(visibleIds), attachmentRetain);
        },
      });
    } finally {
      if (this.pointsRenderers) {
        Object.values(this.pointsRenderers).forEach((renderer) => renderer.endBatch());
      }
    }
  }

  private addVisibleStructureInstance(
    structure: StructureInfo,
    attachmentRetain: Set<number>,
    dirtyModels: Set<InstancedModel>,
  ): void {
    const rotationY = this.resolveVisibleStructureRotationY(structure);
    this.syncVisibleStructurePresentation(undefined, structure, rotationY, attachmentRetain);

    const bindings = this.hasCosmeticSkin(structure)
      ? this.addVisibleCosmeticStructureInstances(structure, dirtyModels)
      : this.addVisibleBaseStructureInstances(structure, dirtyModels);
    if (bindings.length > 0) {
      this.structureInstanceBindings.set(structure.entityId, bindings);
    }
  }

  private addVisibleBaseStructureInstances(
    structure: StructureInfo,
    dirtyModels: Set<InstancedModel>,
  ): StructureInstanceBinding[] {
    const models = this.structureModels.get(structure.structureType);
    if (!models) {
      return [];
    }

    const modelIndex = structure.structureType === StructureType.Realm ? structure.level : structure.stage;
    const model = models[modelIndex];
    if (!model) {
      return [];
    }

    const entityIdsByInstance = this.getOrCreateStructureEntityIdMap(structure.structureType);
    const bindings = [this.bindStructureInstance(model, structure.entityId, entityIdsByInstance, dirtyModels)];
    if (structure.structureType === StructureType.Realm && structure.hasWonder) {
      const wonderModel = models[WONDER_MODEL_INDEX];
      if (wonderModel) {
        bindings.push(
          this.bindStructureInstance(wonderModel, structure.entityId, this.wonderEntityIdMaps, dirtyModels),
        );
      }
    }

    return bindings;
  }

  private addVisibleCosmeticStructureInstances(
    structure: StructureInfo,
    dirtyModels: Set<InstancedModel>,
  ): StructureInstanceBinding[] {
    const cosmeticId = structure.cosmeticId ?? "";
    const model = this.cosmeticStructureModels.get(cosmeticId)?.[0];
    if (!model) {
      return [];
    }

    const entityIdsByInstance = this.getOrCreateCosmeticEntityIdMap(cosmeticId);
    return [this.bindStructureInstance(model, structure.entityId, entityIdsByInstance, dirtyModels)];
  }

  private bindStructureInstance(
    model: InstancedModel,
    entityId: ID,
    entityIdsByInstance: Map<number, ID>,
    dirtyModels: Set<InstancedModel>,
  ): StructureInstanceBinding {
    const slots = this.structureInstanceSlots.get(model) ?? [];
    const instanceIndex = this.takeFreeStructureInstanceSlot(model, slots);
    if (instanceIndex >= STRUCTURE_INSTANCE_CAPACITY) {
      throw new Error(`Structure instance capacity exceeded for entity ${entityId}`);
    }

    slots[instanceIndex] = entityId;
    this.structureInstanceSlots.set(model, slots);
    entityIdsByInstance.set(instanceIndex, entityId);
    model.setMatrixAt(instanceIndex, this.dummy.matrix);
    dirtyModels.add(model);

    return { entityIdsByInstance, instanceIndex, model };
  }

  private takeFreeStructureInstanceSlot(model: InstancedModel, slots: Array<ID | undefined>): number {
    const freeSlot = this.structureInstanceFreeSlots.get(model);
    if (freeSlot === undefined || freeSlot < 0 || freeSlot >= slots.length || slots[freeSlot] !== undefined) {
      this.structureInstanceFreeSlots.delete(model);
      return slots.length;
    }

    const nextFreeSlot = slots.indexOf(undefined, freeSlot + 1);
    if (nextFreeSlot === -1) {
      this.structureInstanceFreeSlots.delete(model);
    } else {
      this.structureInstanceFreeSlots.set(model, nextFreeSlot);
    }
    return freeSlot;
  }

  private removeVisibleStructureInstance(entityId: ID, dirtyModels: Set<InstancedModel>): void {
    const bindings = this.structureInstanceBindings.get(entityId);
    if (!bindings) {
      return;
    }

    bindings.forEach(({ entityIdsByInstance, instanceIndex, model }) => {
      model.removeInstance(instanceIndex);
      const slots = this.structureInstanceSlots.get(model);
      if (slots) {
        slots[instanceIndex] = undefined;
        const firstFreeSlot = this.structureInstanceFreeSlots.get(model);
        if (firstFreeSlot === undefined || instanceIndex < firstFreeSlot) {
          this.structureInstanceFreeSlots.set(model, instanceIndex);
        }
      }
      if (entityIdsByInstance.get(instanceIndex) === entityId) {
        entityIdsByInstance.delete(instanceIndex);
      }
      dirtyModels.add(model);
    });
    this.structureInstanceBindings.delete(entityId);
  }

  private updateVisibleStructureModelCounts(dirtyModels: Set<InstancedModel>): void {
    dirtyModels.forEach((model) => {
      const slots = this.structureInstanceSlots.get(model) ?? [];
      while (slots.length > 0 && slots.at(-1) === undefined) {
        slots.pop();
      }
      const firstFreeSlot = this.structureInstanceFreeSlots.get(model);
      if (firstFreeSlot !== undefined && firstFreeSlot >= slots.length) {
        this.structureInstanceFreeSlots.delete(model);
      }
      if (this.structureModelDrawCounts.get(model) !== slots.length) {
        model.setCount(slots.length);
        this.structureModelDrawCounts.set(model, slots.length);
      }
      if (slots.length === 0) {
        this.structureInstanceSlots.delete(model);
        this.structureInstanceFreeSlots.delete(model);
        this.structureModelDrawCounts.delete(model);
      }
    });
  }

  private getOrCreateStructureEntityIdMap(structureType: StructureType): Map<number, ID> {
    const existing = this.entityIdMaps.get(structureType);
    if (existing) {
      return existing;
    }

    const created = new Map<number, ID>();
    this.entityIdMaps.set(structureType, created);
    return created;
  }

  private getOrCreateCosmeticEntityIdMap(cosmeticId: string): Map<number, ID> {
    const existing = this.cosmeticEntityIdMaps.get(cosmeticId);
    if (existing) {
      return existing;
    }

    const created = new Map<number, ID>();
    this.cosmeticEntityIdMaps.set(cosmeticId, created);
    return created;
  }

  private finalizeVisibleStructurePass(visibleStructureIds: Set<ID>, attachmentRetain: Set<number>): void {
    this.previousVisibleIds = cleanupVisibleStructurePass({
      retainedAttachmentEntities: attachmentRetain,
      activeAttachmentEntities: this.activeStructureAttachmentEntities,
      attachmentSignatures: this.structureAttachmentSignatures,
      removeAttachments: (entityId) => this.attachmentManager.removeAttachments(entityId),
      trackedLabelEntityIds: this.entityIdLabels.keys(),
      visibleStructureIds,
      removeEntityIdLabel: (entityId) => this.removeEntityIdLabel(entityId),
      removeStructureCompactLabel: (entityId) => this.removeStructureCompactLabel(entityId),
      previousVisibleIds: this.previousVisibleIds,
      getStructureByEntityId: (entityId) => this.resolveStructureInfoByEntityId(entityId),
      removeStructurePoint: (entityId, structure) => {
        const renderer = this.getRendererForStructure(structure);
        renderer?.removePoint(entityId);
      },
    });
    this.frustumVisibilityDirty = true;
  }

  private getRendererForStructure(structure: StructureInfo): PointsLabelRenderer | null {
    if (!this.pointsRenderers) return null;

    const { structureType, isMine, isAlly } = structure;

    if (isVillageLikeStructureCategory(structureType)) {
      return isMine
        ? this.pointsRenderers.myVillage
        : isAlly
          ? this.pointsRenderers.allyVillage
          : this.pointsRenderers.enemyVillage;
    }
    if (structureType === StructureType.Realm) {
      return isMine
        ? this.pointsRenderers.myRealm
        : isAlly
          ? this.pointsRenderers.allyRealm
          : this.pointsRenderers.enemyRealm;
    }
    if (structureType === StructureType.Hyperstructure) {
      return this.pointsRenderers.hyperstructure;
    }
    if (structureType === StructureType.Bank) {
      return this.pointsRenderers.bank;
    }
    if (structureType === StructureType.FragmentMine || structureType === StructureType.BitcoinMine) {
      return this.pointsRenderers.fragmentMine;
    }
    return null;
  }

  private updateStructureCompactLabel(structure: StructureInfo, position: Vector3): void {
    this.compactLabelRenderer.setLabel({
      entityId: structure.entityId,
      position,
      text: resolveStructureCompactEntityLabel(structure),
      variant: this.resolveStructureCompactLabelVariant(structure),
    });
  }

  private removeStructureCompactLabel(entityId: ID): void {
    this.compactLabelRenderer.removeLabel(entityId);
  }

  private resolveStructureCompactLabelVariant(structure: StructureInfo): CompactEntityLabelVariant {
    if (structure.owner.address === 0n) {
      return "neutral";
    }

    return resolveCompactEntityLabelVariant(structure);
  }

  private resolveVisibleStructuresForChunk(chunkKey: string): StructureInfo[] {
    return this.resolveStructureInfos(this.ensureVisibleStructureWindow(chunkKey).structures.values());
  }

  // Only a chunk change re-queries the bounds; inside a chunk the change set keeps the window current.
  private ensureVisibleStructureWindow(chunkKey: string): VisibleStructureWindow {
    if (this.visibleStructureWindow?.chunkKey === chunkKey) {
      return this.visibleStructureWindow;
    }

    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const bounds = this.resolveStructurePresentationBounds(startRow, startCol);
    const structures = new Map<ID, EntityStructureRenderable>();
    this.queryStructuresInBounds(bounds).forEach((renderable) => {
      if (!renderable.reserved) structures.set(renderable.entityId, renderable);
    });
    this.visibleStructureWindow = { chunkKey, bounds, structures };
    return this.visibleStructureWindow;
  }

  private queryStructureInfosInChunk(startRow: number, startCol: number): StructureInfo[] {
    return this.resolveStructureInfos(
      this.queryStructuresInBounds(this.resolveStructurePresentationBounds(startRow, startCol)),
    );
  }

  private queryStructuresInBounds(bounds: WorldSpatialBounds): readonly StructureSpatialRenderable[] {
    this.metrics.visibleStructureBoundsQueries += 1;
    return this.worldSpatialProjection.getStructuresInBounds(bounds);
  }

  private resolveStructureInfos(renderables: Iterable<StructureSpatialRenderable>): StructureInfo[] {
    const structures: StructureInfo[] = [];
    for (const renderable of renderables) {
      const structure = this.resolveStructureInfo(renderable);
      if (structure) structures.push(structure);
    }
    return structures;
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

  public getEntityIdFromInstance(structureType: StructureType, instanceId: number): ID | undefined {
    // Check if this is a wonder model instance
    if (structureType === StructureType.Realm && this.wonderEntityIdMaps.has(instanceId)) {
      return this.wonderEntityIdMaps.get(instanceId);
    }

    const map = this.entityIdMaps.get(structureType);
    return map ? map.get(instanceId) : undefined;
  }

  public getInstanceIdFromEntityId(structureType: StructureType, entityId: ID): number | undefined {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return undefined;
    }

    // First check the wonder map
    if (structureType === StructureType.Realm) {
      for (const [instanceId, id] of this.wonderEntityIdMaps.entries()) {
        if (id === normalizedEntityId) {
          return instanceId;
        }
      }
    }

    const map = this.entityIdMaps.get(structureType);
    if (!map) return undefined;
    for (const [instanceId, id] of map.entries()) {
      if (id === normalizedEntityId) {
        return instanceId;
      }
    }
    return undefined;
  }

  public setChunkBounds(bounds?: { box: Box3; sphere: Sphere }) {
    this.currentChunkBounds = bounds ?? undefined;
    this.visibleStructurePassFence.invalidate();
    // Model worldBounds are NOT applied here — they are deferred to
    // applyPendingModelBounds() which runs after instance data is rebuilt
    // in performVisibleStructuresUpdate. Applying bounds before instance
    // data is updated causes ghosting at chunk edges (old instances pass
    // frustum culling with new chunk bounds).
    this.hasPendingModelBounds = true;
  }

  private applyPendingModelBounds() {
    if (!this.hasPendingModelBounds) return;
    this.hasPendingModelBounds = false;
    const bounds = this.currentChunkBounds;
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.setWorldBounds(bounds));
    });
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => model.setWorldBounds(bounds));
    });
  }

  private isChunkVisible(): boolean {
    if (!this.currentChunkBounds) {
      return true;
    }
    if (this.visibilityManager) {
      return this.visibilityManager.isBoxVisible(this.currentChunkBounds.box);
    }
    if (!this.frustumManager) {
      return true;
    }
    return this.frustumManager.isBoxVisible(this.currentChunkBounds.box);
  }

  updateAnimations(deltaTime: number, visibility?: AnimationVisibilityContext) {
    if (!this.isChunkVisible()) {
      return;
    }

    this.updateCompactLabelCamera();

    const context = this.resolveAnimationVisibilityContext(visibility);
    this.structureModels.forEach((models) => {
      models.forEach((model) => model.updateAnimations(deltaTime, context));
    });
    this.cosmeticStructureModels.forEach((models) => {
      models.forEach((model) => model.updateAnimations(deltaTime, context));
    });

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

  private updateCompactLabelCamera(): void {
    const camera = this.hexagonScene?.getCamera();
    if (camera) {
      this.compactLabelRenderer.updateCamera(camera);
    }
  }

  private resolveAnimationVisibilityContext(
    provided?: AnimationVisibilityContext,
  ): AnimationVisibilityContext | undefined {
    if (provided) {
      return provided;
    }

    if (!this.hexagonScene) {
      return undefined;
    }

    const camera = this.hexagonScene.getCamera();
    if (!camera) {
      return undefined;
    }

    this.animationCameraPosition.copy(camera.position);

    if (!this.animationVisibilityContext) {
      this.animationVisibilityContext = {
        visibilityManager: this.visibilityManager,
        frustumManager: this.frustumManager,
        cameraPosition: this.animationCameraPosition,
        maxDistance: this.animationCullDistance,
      };
    } else {
      this.animationVisibilityContext.visibilityManager = this.visibilityManager;
      this.animationVisibilityContext.frustumManager = this.frustumManager;
      this.animationVisibilityContext.cameraPosition = this.animationCameraPosition;
      this.animationVisibilityContext.maxDistance = this.animationCullDistance;
    }

    return this.animationVisibilityContext;
  }

  public setAnimationCullDistance(distance: number): void {
    this.animationCullDistance = distance;
    // Invalidate the cached animation context so the new distance is rebuilt on next use.
    this.animationVisibilityContext = undefined;
  }

  public setLabelRenderDistance(distance: number): void {
    this.labelRenderDistance = distance;
    // Re-evaluate label visibility on the next update cycle.
    this.frustumVisibilityDirty = true;
  }

  private applyFrustumVisibilityToLabels() {
    syncStructureLabelVisibility<ID>({
      labels: this.entityIdLabels.values(),
      setLabelVisible: (label) => this.isStructureLabelVisible(label),
      revealLabel: (entityId, label) => this.revealStructureLabel(entityId, label),
    });
  }

  // Label Management Methods
  private addEntityIdLabel(structure: StructureInfo, position: Vector3) {
    const { label } = this.labelPool.acquire(() => {
      const element = createStructureLabel(structure, this.currentCameraView);
      const cssLabel = new CSS2DObject(element);
      cssLabel.userData.baseRenderOrder = cssLabel.renderOrder;
      return cssLabel;
    });

    label.position.copy(position);
    label.position.y += 2;
    label.userData.entityId = structure.entityId;
    // Clear stale lastDataKey from pool recycling to ensure fresh DOM update
    label.userData.lastDataKey = null;

    this.configureStructureLabelInteractions(label);

    this.entityIdLabels.set(structure.entityId, label);
    this.labelsGroup.add(label);
    this.updateStructureLabelData(structure, label);
    this.frustumVisibilityDirty = true;
  }

  private removeEntityIdLabel(entityId: ID) {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return;
    }

    const label = this.entityIdLabels.get(normalizedEntityId);
    if (label) {
      this.labelsGroup.remove(label);
      this.labelPool.release(label);
      this.entityIdLabels.delete(normalizedEntityId);
      this.frustumVisibilityDirty = true;
    }
  }

  private configureStructureLabelInteractions(label: CSS2DObject): void {
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

  public removeLabelsFromScene() {
    removeStructureLabels({
      trackedLabelEntityIds: this.entityIdLabels.keys(),
      shouldRetainLabel: () => false,
      removeEntityIdLabel: (entityId) => this.removeEntityIdLabel(entityId),
    });
    this.removeOrphanedStructureSceneLabels();
    this.frustumVisibilityDirty = true;
  }

  public removeLabelsExcept(entityId?: ID) {
    const normalizedEntityId = entityId !== undefined ? normalizeEntityId(entityId) : undefined;
    removeStructureLabels({
      trackedLabelEntityIds: this.entityIdLabels.keys(),
      shouldRetainLabel: (labelEntityId) => labelEntityId === normalizedEntityId,
      removeEntityIdLabel: (labelEntityId) => this.removeEntityIdLabel(labelEntityId),
    });
    this.frustumVisibilityDirty = true;
  }

  public showLabels() {
    this.frustumVisibilityDirty = true;
    this.applyFrustumVisibilityToLabels();
  }

  public showLabel(entityId: ID): HoverLabelShowResult {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      return { status: "missing" };
    }

    const structure = this.resolveStructureInfoByEntityId(normalizedEntityId);
    if (!structure) {
      return { status: "missing" };
    }

    const existingLabel = this.entityIdLabels.get(normalizedEntityId);
    if (existingLabel) {
      const wasDetached = existingLabel.parent !== this.labelsGroup;
      const wasHidden = existingLabel.visible !== true || existingLabel.element.style.display === "none";
      if (wasDetached) {
        this.labelsGroup.add(existingLabel);
      }
      existingLabel.visible = true;
      existingLabel.element.style.display = "";
      this.refreshExistingStructureLabel(structure, existingLabel);
      this.highlightStructurePointIcon(structure, normalizedEntityId);
      if (wasDetached || wasHidden) {
        this.frustumVisibilityDirty = true;
        return { status: "reattached" };
      }
      return { status: "unchanged" };
    }

    this.addEntityIdLabel(structure, this.resolveStructureLabelPosition(structure));
    this.highlightStructurePointIcon(structure, normalizedEntityId);
    this.frustumVisibilityDirty = true;
    return { status: "shown" };
  }

  public hideLabel(entityId: ID): void {
    this.removeEntityIdLabel(entityId);
    this.clearStructurePointHoverIcons();
    this.frustumVisibilityDirty = true;
  }

  public hideAllLabels(): void {
    removeStructureLabels({
      trackedLabelEntityIds: Array.from(this.entityIdLabels.keys()),
      shouldRetainLabel: () => false,
      removeEntityIdLabel: (structureId) => this.removeEntityIdLabel(structureId),
    });
    this.clearStructurePointHoverIcons();
    this.frustumVisibilityDirty = true;
  }

  private isStructureLabelVisible(label: CSS2DObject): boolean {
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

  private revealStructureLabel(entityId: ID, label: CSS2DObject) {
    if (label.parent !== this.labelsGroup) {
      this.labelsGroup.add(label);
    }

    const structure = this.resolveStructureInfoByEntityId(entityId);
    if (structure) {
      updateStructureLabel(label.element, structure, this.currentCameraView);
    }
  }

  private resolveStructureLabelPosition(structure: StructureInfo): Vector3 {
    const position = getWorldPositionForHex(structure.hexCoords);
    return placePositionOnTerrain(position, this.hexagonScene?.getTerrainSurface() ?? FLAT_TERRAIN_SURFACE, 0.05);
  }

  private refreshExistingStructureLabel(structure: StructureInfo, label: CSS2DObject) {
    const position = this.resolveStructureLabelPosition(structure);
    position.y += 1.95;
    label.position.copy(position);
    this.updateStructureLabelData(structure, label);
  }

  private highlightStructurePointIcon(structure: StructureInfo, entityId: ID) {
    if (!this.pointsRenderers) {
      this.compactLabelRenderer.setHover(entityId);
      return;
    }

    const renderer = this.getRendererForStructure(structure);
    if (renderer) {
      renderer.setHover(entityId);
    }
    this.compactLabelRenderer.setHover(entityId);
  }

  private clearStructurePointHoverIcons() {
    if (!this.pointsRenderers) {
      this.compactLabelRenderer.clearHover();
      return;
    }

    Object.values(this.pointsRenderers).forEach((renderer) => renderer.clearHover());
    this.compactLabelRenderer.clearHover();
  }

  private removeOrphanedStructureSceneLabels() {
    const remainingLabels = this.labelsGroup.children.filter((child) => child instanceof CSS2DObject);
    remainingLabels.forEach((label) => {
      this.labelsGroup.remove(label);
    });
  }

  /**
   * Update structure battle direction and label
   */
  public updateBattleDirection(entityId: ID, degrees: number | undefined, role: "attacker" | "defender"): void {
    const normalizedEntityId = normalizeEntityId(entityId);
    if (normalizedEntityId === undefined) {
      console.warn("[StructureManager] Received battle direction update without a valid entity id", {
        entityId,
        degrees,
        role,
      });
      return;
    }

    const directions = this.battleDirectionsByStructure.get(normalizedEntityId) ?? {};

    if (role === "attacker") {
      directions.attackedTowardDegrees = degrees;
    } else {
      directions.attackedFromDegrees = degrees;
    }
    this.battleDirectionsByStructure.set(normalizedEntityId, directions);
    this.invalidateStructureInfo(normalizedEntityId);

    const structure = this.resolveStructureInfoByEntityId(normalizedEntityId);
    if (structure) this.refreshStructureLabelIfTracked(normalizedEntityId, structure);
  }

  private playStructureGuardDifferenceFx(entityId: ID, previousGuards: GuardArmy[], currentGuards: GuardArmy[]) {
    if (previousGuards.length === 0 || currentGuards.length === 0) return;

    const structure = this.resolveStructureInfoByEntityId(entityId);
    if (!structure) return;

    for (const newGuard of currentGuards) {
      const oldGuard = previousGuards.find((guard) => guard.slot === newGuard.slot);
      if (!oldGuard || oldGuard.count === newGuard.count) {
        continue;
      }

      const diff = newGuard.count - oldGuard.count;

      const worldPos = getWorldPositionForHex(structure.hexCoords);
      placePositionOnTerrain(worldPos, this.hexagonScene?.getTerrainSurface() ?? FLAT_TERRAIN_SURFACE);
      this.fxManager.playTroopDiffFx(diff, worldPos.x, worldPos.y + 3, worldPos.z);
    }
  }

  private refreshStructureLabelIfTracked(entityId: ID, structure: StructureInfo) {
    const label = this.entityIdLabels.get(entityId);
    if (label) {
      this.updateStructureLabelData(structure, label);
    }
  }

  /**
   * Sync public incoming troop arrivals onto known structures and refresh visible labels as needed.
   */
  public setIncomingTroopArrivalsByStructure(arrivalsByStructure: Record<string, IncomingTroopArrival[]>): void {
    const nowSeconds = useChainTimeStore.getState().getNowSeconds();
    this.incomingTroopArrivalsByStructure.clear();

    this.worldSpatialProjection.getStructures().forEach((renderable) => {
      if (renderable.reserved) return;

      const nextArrivals = arrivalsByStructure[String(renderable.entityId)];
      if (nextArrivals?.length) this.incomingTroopArrivalsByStructure.set(renderable.entityId, nextArrivals);

      const structure = this.resolveStructureInfo(renderable);
      if (!structure) return;
      this.syncIncomingTroopArrivalsForStructure(structure, nextArrivals, nowSeconds);
      this.updateTimedLabelTracking(structure.entityId, structure.battleCooldownEnd, structure.incomingTroopArrivals);
    });
  }

  private syncIncomingTroopArrivalsForStructure(
    structure: StructureInfo,
    nextIncomingTroopArrivals: IncomingTroopArrival[] | undefined,
    nowSeconds: number,
  ) {
    const arrivalUpdate = resolveStructureIncomingTroopArrivals({
      currentIncomingTroopArrivals: structure.incomingTroopArrivals,
      nextIncomingTroopArrivals,
      nowSeconds,
    });

    if (!arrivalUpdate.changed) {
      return;
    }

    if (arrivalUpdate.incomingTroopArrivals?.length) {
      this.incomingTroopArrivalsByStructure.set(structure.entityId, arrivalUpdate.incomingTroopArrivals);
    } else {
      this.incomingTroopArrivalsByStructure.delete(structure.entityId);
    }
    structure.incomingTroopArrivals = arrivalUpdate.incomingTroopArrivals;

    const label = this.entityIdLabels.get(structure.entityId);
    if (label) {
      this.updateStructureLabelData(structure, label);
    }
  }

  /**
   * Update timed label tracking for a structure.
   * Adds to or removes from the active timer set based on whether a battle timer or incoming troop countdown is active.
   */
  private updateTimedLabelTracking(
    entityId: ID,
    battleCooldownEnd: number | undefined,
    incomingTroopArrivals?: IncomingTroopArrival[],
  ): void {
    const nowSeconds = useChainTimeStore.getState().getNowSeconds();
    if (shouldTrackTimedStructureLabel({ battleCooldownEnd, incomingTroopArrivals, nowSeconds })) {
      this.structuresWithActiveTimedLabels.add(entityId);
      return;
    }

    this.structuresWithActiveTimedLabels.delete(entityId);
  }

  /**
   * Start the timed label update system
   */
  private startTimedLabelUpdates(): void {
    this.timedLabelInterval = setInterval(() => {
      this.recomputeTimedLabelDataForAllStructures();
    }, 1000);
  }

  /**
   * Update battle timers and incoming troop countdowns for structures with active timed labels.
   * Only iterates structures in structuresWithActiveTimedLabels set (O(active) instead of O(total)).
   */
  private recomputeTimedLabelDataForAllStructures(): void {
    const inactiveTimedLabels: ID[] = [];
    const nowSeconds = useChainTimeStore.getState().getNowSeconds();

    for (const entityId of this.structuresWithActiveTimedLabels) {
      const structure = this.resolveStructureInfoByEntityId(entityId);
      if (!structure) {
        inactiveTimedLabels.push(entityId);
        continue;
      }

      const timedLabelState = resolveTimedStructureLabelState({
        battleCooldownEnd: structure.battleCooldownEnd,
        incomingTroopArrivals: structure.incomingTroopArrivals,
        nowSeconds,
      });

      if (structure.battleTimerLeft !== timedLabelState.battleTimerLeft) {
        structure.battleTimerLeft = timedLabelState.battleTimerLeft;
      }

      if (structure.incomingTroopArrivals !== timedLabelState.incomingTroopArrivals) {
        structure.incomingTroopArrivals = timedLabelState.incomingTroopArrivals;
      }

      if (!timedLabelState.isActive) {
        inactiveTimedLabels.push(entityId);
      }

      const label = this.entityIdLabels.get(entityId);
      if (label) {
        this.updateStructureLabelData(structure, label);
      }
    }

    for (const entityId of inactiveTimedLabels) {
      this.structuresWithActiveTimedLabels.delete(entityId);
    }
  }

  /**
   * Update a structure label with fresh data
   */
  private updateStructureLabelData(structure: StructureInfo, existingLabel: CSS2DObject): void {
    const dataKey = buildStructureLabelDataKey(structure, useChainTimeStore.getState().getNowSeconds());
    const isVisible = this.labelsGroup.parent !== null && existingLabel.visible === true;
    if (isVisible && existingLabel.userData.lastDataKey === dataKey) {
      return;
    }

    if (!isVisible) {
      existingLabel.userData.lastDataKey = null;
      return;
    }

    existingLabel.userData.lastDataKey = dataKey;
    updateStructureLabel(existingLabel.element, structure, this.currentCameraView);
  }
}
