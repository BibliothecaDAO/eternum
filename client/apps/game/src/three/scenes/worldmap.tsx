import { AudioManager } from "@/audio/core/AudioManager";
import { toast } from "sonner";

import { getMapFromToriiExact, getStructuresDataFromTorii } from "@/dojo/queries";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { getBiomeVariant, HEX_SIZE } from "@/three/constants";
import { ArmyManager } from "@/three/managers/army-manager";
import { BattleDirectionManager } from "@/three/managers/battle-direction-manager";
import { ChestManager } from "@/three/managers/chest-manager";
import Minimap from "@/three/managers/minimap";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { SelectionPulseManager } from "@/three/managers/selection-pulse-manager";
import { RelicSource, StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playResourceSound } from "@/three/sound/utils";
import { LeftView, RightView } from "@/types";
import { Position } from "@bibliothecadao/eternum";

import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { ChestModal, HelpModal } from "@/ui/features/military";
import { QuickAttackPreview } from "@/ui/features/military/battle/quick-attack-preview";
import { UnifiedArmyCreationModal } from "@/ui/features/military/components/unified-army-creation-modal";
import { QuestModal } from "@/ui/features/progression";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  BattleEventSystemUpdate,
  ChestSystemUpdate,
  ExplorerMoveSystemUpdate,
  ExplorerTroopsTileSystemUpdate,
  getBlockTimestamp,
  isRelicActive,
  QuestSystemUpdate,
  RelicEffectSystemUpdate,
  SelectableArmy,
  StructureActionManager,
  TileSystemUpdate,
} from "@bibliothecadao/eternum";
import {
  ActorType,
  BiomeType,
  ContractAddress,
  Direction,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  findResourceById,
  getDirectionBetweenAdjacentHexes,
  HexEntityInfo,
  HexPosition,
  ID,
  RelicEffect,
  Structure,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Account, AccountInterface } from "starknet";
import { Color, Group, InstancedBufferAttribute, Matrix4, Object3D, Raycaster, Vector2, Vector3 } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { env } from "../../../env";
import { FXManager } from "../managers/fx-manager";
import { HoverLabelManager } from "../managers/hover-label-manager";
import { QuestManager } from "../managers/quest-manager";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import { SceneName } from "../types/common";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import { InstancedMatrixAttributePool } from "../utils/instanced-matrix-attribute-pool";
import { MatrixPool } from "../utils/matrix-pool";
import { MemoryMonitor } from "../utils/memory-monitor";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "../utils/navigation";
import { SceneShortcutManager } from "../utils/shortcuts";
import { openStructureContextMenu } from "./context-menu/structure-context-menu";

//const dummyObject = new Object3D();
const dummyVector = new Vector3();
const dummy = new Object3D();
const MEMORY_MONITORING_ENABLED = env.VITE_PUBLIC_ENABLE_MEMORY_MONITORING;

export default class WorldmapScene extends HexagonScene {
  private chunkSize = 8; // Size of each chunk
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
  private wheelAccumulator = 0;
  private wheelResetTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly wheelThreshold = 10;
  private wheelDirection: -1 | 0 | 1 = 0;
  private wheelStepsThisGesture = 0;
  private readonly wheelGestureTimeoutMs = 50;
  private renderChunkSize = {
    width: 60,
    height: 44,
    // width: 20,
    // height: 14,
  };

  private totalStructures: number = 0;

  private currentChunk: string = "null";

  private armyManager: ArmyManager;
  private pendingArmyMovements: Set<ID> = new Set();
  private structureManager: StructureManager;
  private memoryMonitor?: MemoryMonitor;
  private chestManager: ChestManager;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  // normalized positions and if they are allied or not
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private chestHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // store armies positions by ID, to remove previous positions when army moves
  // normalized coordinates
  private armiesPositions: Map<ID, HexPosition> = new Map();
  private armyLastUpdateAt: Map<ID, number> = new Map();
  // normalized coordinates
  private structuresPositions: Map<ID, HexPosition> = new Map();

  // Battle direction manager for tracking attacker/defender relationships
  private battleDirectionManager: BattleDirectionManager;

  private selectedHexManager: SelectedHexManager;
  private selectionPulseManager: SelectionPulseManager;
  private structurePulseColorCache: Map<string, { base: Color; pulse: Color }> = new Map();
  private armyStructureOwners: Map<ID, ID> = new Map();
  private minimap!: Minimap;
  private followCameraTimeout: ReturnType<typeof setTimeout> | null = null;
  private notifiedBattleEvents = new Set<string>();
  private previouslyHoveredHex: HexPosition | null = null;
  private async ensureStructureSynced(structureId: ID, hexCoords: HexPosition) {
    const components = this.dojo.components as any;
    const toriiClient = this.dojo.network?.toriiClient;
    const contractComponents = this.dojo.network?.contractComponents;

    const contractCoords = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();

    if (!components?.Structure || !toriiClient || !contractComponents) {
      return;
    }

    let entityKey: any;
    try {
      entityKey = getEntityIdFromKeys([BigInt(structureId)]);
    } catch (error) {
      console.warn("[WorldmapScene] Unable to build entity key for structure", structureId, error);
      return;
    }

    const existing = getComponentValue(components.Structure, entityKey);
    if (existing) {
      return;
    }

    const numericId = Number(structureId);
    if (!Number.isFinite(hexCoords.col) || !Number.isFinite(hexCoords.row)) {
      console.warn("[WorldmapScene] Unable to determine coordinates for structure", structureId);
      return;
    }
    if (!Number.isFinite(numericId)) {
      console.warn("[WorldmapScene] Structure id is not a finite number", structureId);
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";

    try {
      await getStructuresDataFromTorii(toriiClient, contractComponents as any, [
        {
          entityId: numericId,
          position: { col: contractCoords.x, row: contractCoords.y },
        },
      ]);
    } catch (error) {
      console.error("[WorldmapScene] Failed to fetch structure data from Torii", error);
    } finally {
      document.body.style.cursor = previousCursor;
    }
  }

  private cachedMatrices: Map<string, Map<string, { matrices: InstancedBufferAttribute | null; count: number }>> =
    new Map();
  private cachedMatrixOrder: string[] = [];
  private readonly maxMatrixCacheSize = 6;
  private updateHexagonGridPromise: Promise<void> | null = null;
  private hexGridFrameHandle: number | null = null;
  private currentHexGridTask: symbol | null = null;
  private readonly hexGridFrameBudgetMs = 6.5;
  private readonly hexGridMinBatch = 120;
  private readonly hexGridMaxBatch = 900;
  private travelEffects: Map<string, () => void> = new Map();

  // Pending relic effects store - holds relic effects for entities that aren't loaded yet
  private pendingRelicEffects: Map<ID, Map<RelicSource, Set<{ relicResourceId: number; effect: RelicEffect }>>> =
    new Map();

  // Relic effect validation timer
  private relicValidationInterval: NodeJS.Timeout | null = null;

  // Global chunk switching coordination
  private globalChunkSwitchPromise: Promise<void> | null = null;

  // Label groups
  private armyLabelsGroup: Group;
  private structureLabelsGroup: Group;
  private questLabelsGroup: Group;
  private chestLabelsGroup: Group;

  private storeSubscriptions: Array<() => void> = [];

  dojo: SetupResult;

  private fetchedChunks: Set<string> = new Set();
  private pendingChunks: Map<string, Promise<void>> = new Map();
  private pendingArmyRemovals: Map<ID, NodeJS.Timeout> = new Map();
  private pendingArmyRemovalMeta: Map<ID, { scheduledAt: number; chunkKey: string; reason: "tile" | "zero" }> =
    new Map();

  private fxManager: FXManager;
  private resourceFXManager: ResourceFXManager;
  private questManager: QuestManager;
  private armyIndex: number = 0;
  private selectableArmies: SelectableArmy[] = [];
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];

  // Hover-based label expansion manager
  private hoverLabelManager: HoverLabelManager;

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;
    this.fxManager = new FXManager(this.scene, 1);
    this.resourceFXManager = new ResourceFXManager(this.scene, 1.2);

    // Initialize memory monitor for worldmap operations
    if (MEMORY_MONITORING_ENABLED) {
      this.memoryMonitor = new MemoryMonitor({
        spikeThresholdMB: 30, // Higher threshold for world operations
        onMemorySpike: (spike) => {
          console.warn(`🗺️  WorldMap Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
        },
      });
    }

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    // Initialize label groups
    this.armyLabelsGroup = new Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";
    this.questLabelsGroup = new Group();
    this.questLabelsGroup.name = "QuestLabelsGroup";
    this.chestLabelsGroup = new Group();
    this.chestLabelsGroup.name = "ChestLabelsGroup";

    this.armyManager = new ArmyManager(
      this.scene,
      this.renderChunkSize,
      this.armyLabelsGroup,
      this,
      this.dojo,
      (entityId: ID) => this.applyPendingRelicEffects(entityId),
      (entityId: ID) => this.clearPendingRelicEffects(entityId),
    );

    // Expose material sharing debug to global console
    (window as any).testMaterialSharing = () => this.armyManager.logMaterialSharingStats();
    this.structureManager = new StructureManager(
      this.scene,
      this.renderChunkSize,
      this.structureLabelsGroup,
      this,
      this.fxManager,
      this.dojo,
      (entityId: ID) => this.applyPendingRelicEffects(entityId),
      (entityId: ID) => this.clearPendingRelicEffects(entityId),
    );

    // Initialize the quest manager
    this.questManager = new QuestManager(this.scene, this.renderChunkSize, this.questLabelsGroup, this);

    // Initialize the chest manager
    this.chestManager = new ChestManager(this.scene, this.renderChunkSize, this.chestLabelsGroup, this);

    // Initialize the battle direction manager
    this.battleDirectionManager = new BattleDirectionManager(
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.armyManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID, direction: Direction | undefined, role: "attacker" | "defender") =>
        this.structureManager.updateBattleDirection(entityId, direction, role),
      (entityId: ID) => this.armiesPositions.get(entityId) || this.structuresPositions.get(entityId),
    );

    // Initialize the hover label manager
    this.hoverLabelManager = new HoverLabelManager(
      {
        army: {
          show: (entityId: ID) => this.armyManager.showLabel(entityId),
          hide: (entityId: ID) => this.armyManager.hideLabel(entityId),
          hideAll: () => this.armyManager.hideAllLabels(),
        },
        structure: {
          show: (entityId: ID) => this.structureManager.showLabel(entityId),
          hide: (entityId: ID) => this.structureManager.hideLabel(entityId),
          hideAll: () => this.structureManager.hideAllLabels(),
        },
        quest: {
          show: (entityId: ID) => this.questManager.showLabel(entityId),
          hide: (entityId: ID) => this.questManager.hideLabel(entityId),
          hideAll: () => this.questManager.hideAllLabels(),
        },
        chest: {
          show: (entityId: ID) => this.chestManager.showLabel(entityId),
          hide: (entityId: ID) => this.chestManager.hideLabel(entityId),
          hideAll: () => this.chestManager.hideAllLabels(),
        },
      },
      (hexCoords: HexPosition) => this.getHexagonEntity(hexCoords),
      this.currentCameraView,
    );

    // Subscribe hover label manager to camera view changes
    this.addCameraViewListener((view: CameraView) => {
      this.hoverLabelManager.updateCameraView(view);
    });

    // Store the unsubscribe function for Army updates
    this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {
      this.cancelPendingArmyRemoval(update.entityId);

      if (update.removed) {
        console.debug(`[WorldMap] Tile update indicates removal for entity ${update.entityId}`);
        this.scheduleArmyRemoval(update.entityId, "tile");
        return;
      }

      console.debug(`[WorldMap] Army tile update received for entity ${update.entityId}`);
      this.updateArmyHexes(update);

      // Add combat relationship
      if (update.battleData?.latestAttackerId) {
        this.addCombatRelationship(update.battleData.latestAttackerId, update.entityId);
      }
      if (update.battleData?.latestDefenderId) {
        this.addCombatRelationship(update.entityId, update.battleData.latestDefenderId);
      }

      // Ensure army spawn location is marked as explored for pathfinding
      // This fixes the bug where newly spawned armies can't see movement options
      const normalizedPos = new Position({ x: update.hexCoords.col, y: update.hexCoords.row }).getNormalized();
      if (!this.exploredTiles.has(normalizedPos.x)) {
        this.exploredTiles.set(normalizedPos.x, new Map());
      }
      if (!this.exploredTiles.get(normalizedPos.x)!.has(normalizedPos.y)) {
        // Mark spawn location as grassland (default safe biome for pathfinding)
        this.exploredTiles.get(normalizedPos.x)!.set(normalizedPos.y, BiomeType.Grassland);
      }

      await this.armyManager.onTileUpdate(update, this.armyHexes, this.structureHexes, this.exploredTiles);

      this.invalidateAllChunkCachesContainingHex(normalizedPos.x, normalizedPos.y);

      // Update positions for the moved army
      const armyEntityId = update.entityId;
      const prevPosition = this.armiesPositions.get(armyEntityId);
      // this.armiesPositions.set(armyEntityId, normalizedPos);

      // Recalculate arrows for this army when it moves
      this.recalculateArrowsForEntity(armyEntityId);

      // Check if any other entities had relationships with this army at its previous position
      // and update their arrows too
      if (prevPosition) {
        this.recalculateArrowsForEntitiesRelatedTo(armyEntityId);
      }
    });

    // Listen for troop count and stamina changes
    this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {
      this.cancelPendingArmyRemoval(update.entityId);
      console.debug(`[WorldMap] ExplorerTroops update received for entity ${update.entityId}`, {
        troopCount: update.troopCount,
        owner: update.ownerAddress,
      });

      if (update.troopCount <= 0) {
        console.debug(`[WorldMap] ExplorerTroops update indicates removal for entity ${update.entityId}`);
        this.scheduleArmyRemoval(update.entityId, "zero");
        return;
      }
      this.updateArmyHexes(update);
      this.armyManager.updateArmyFromExplorerTroopsUpdate(update);
    });

    // Listen for dead army updates
    this.worldUpdateListener.Army.onDeadArmy((entityId) => {
      console.debug(`[WorldMap] onDeadArmy received for entity ${entityId}`);

      // Remove the army visuals/hex before dropping tracking data so we can clean up the correct tile
      this.deleteArmy(entityId);

      // Remove from attacker-defender tracking
      this.removeEntityFromTracking(entityId);
      this.updateVisibleChunks().catch((error) => console.error("Failed to update visible chunks:", error));
    });

    // Listen for battle events and update army/structure labels
    this.worldUpdateListener.BattleEvent.onBattleUpdate((update: BattleEventSystemUpdate) => {
      console.debug(`[WorldMap] BattleEvent update received for battle entity ${update.entityId}`);
      console.log("🗺️ WorldMap: Received battle event update:", update);

      // Update both attacker and defender information using the public methods
      const { attackerId, defenderId } = update.battleData;

      // Add combat relationship
      if (attackerId && defenderId) {
        this.addCombatRelationship(attackerId, defenderId);
        this.recalculateArrowsForEntity(attackerId);
        this.recalculateArrowsForEntity(defenderId);
      }

      const uiStore = useUIStore.getState();
      const followArmyCombats = uiStore.followArmyCombats;
      const currentScene = this.sceneManager.getCurrentScene();

      if (followArmyCombats && currentScene === SceneName.WorldMap) {
        const attackerPosition =
          attackerId !== undefined
            ? (this.armiesPositions.get(attackerId) ?? this.structuresPositions.get(attackerId))
            : undefined;
        const defenderPosition =
          defenderId !== undefined
            ? (this.armiesPositions.get(defenderId) ?? this.structuresPositions.get(defenderId))
            : undefined;

        const targetPosition = defenderPosition ?? attackerPosition;

        if (targetPosition) {
          this.focusCameraOnEvent(targetPosition.col, targetPosition.row, "Following Army Combat");
        }
      }

      this.notifyArmyUnderAttack(update);
    });

    // Listen for structure guard updates
    this.worldUpdateListener.Structure.onStructureUpdate((update) => {
      this.updateStructureHexes(update);
      this.structureManager.updateStructureLabelFromStructureUpdate(update);
    });

    // Listen for structure building updates
    this.worldUpdateListener.Structure.onStructureBuildingsUpdate((update) => {
      this.structureManager.updateStructureLabelFromBuildingUpdate(update);
    });

    // Store the unsubscribe function for Tile updates
    this.worldUpdateListener.Tile.onTileUpdate((value) => this.updateExploredHex(value));

    // Store the unsubscribe function for Structure updates
    this.worldUpdateListener.Structure.onTileUpdate(async (value) => {
      this.updateStructureHexes(value);

      const optimisticStructure = this.structureManager.structures.removeStructure(
        Number(DUMMY_HYPERSTRUCTURE_ENTITY_ID),
      );
      if (optimisticStructure) {
        this.dojo.components.Structure.removeOverride(DUMMY_HYPERSTRUCTURE_ENTITY_ID.toString());
        this.structureManager.structureHexCoords
          .get(optimisticStructure.hexCoords.col)
          ?.delete(optimisticStructure.hexCoords.row);
        this.structureManager.updateChunk(this.currentChunk);
      }

      await this.structureManager.onUpdate(value);
      if (this.totalStructures !== this.structureManager.getTotalStructures()) {
        this.totalStructures = this.structureManager.getTotalStructures();
        this.clearCache();
        this.updateVisibleChunks(true).catch((error) => console.error("Failed to update visible chunks:", error));
      }
    });

    // Store the unsubscribe function for Structure contributions
    this.worldUpdateListener.Structure.onContribution((value) => {
      this.structureManager.structures.updateStructureStage(value.entityId, value.structureType, value.stage);
      this.structureManager.updateChunk(this.currentChunk);
    });

    // perform some updates for the quest manager
    this.worldUpdateListener.Quest.onTileUpdate((update: QuestSystemUpdate) => {
      this.updateQuestHexes(update);
      this.questManager.onUpdate(update);
    });

    // perform some updates for the chest manager
    this.worldUpdateListener.Chest.onTileUpdate((update: ChestSystemUpdate) => {
      this.updateChestHexes(update);
      this.chestManager.onUpdate(update);
    });
    this.worldUpdateListener.Chest.onDeadChest((entityId) => {
      // If the chest is opened, remove it from the map
      this.deleteChest(entityId);
    });

    // Store the unsubscribe function for Relic Effect updates
    this.worldUpdateListener.RelicEffect.onExplorerTroopsUpdate(async (update: RelicEffectSystemUpdate) => {
      this.handleRelicEffectUpdate(update);
    });

    this.worldUpdateListener.RelicEffect.onStructureGuardUpdate((update: RelicEffectSystemUpdate) => {
      this.handleRelicEffectUpdate(update, RelicSource.Guard);
    });

    this.worldUpdateListener.RelicEffect.onStructureProductionUpdate((update: RelicEffectSystemUpdate) => {
      this.handleRelicEffectUpdate(update, RelicSource.Production);
    });

    this.worldUpdateListener.ExplorerMove.onExplorerMoveEventUpdate((update: ExplorerMoveSystemUpdate) => {
      const { explorerId, resourceId, amount } = update;

      // Find the army position using explorerId
      setTimeout(() => {
        const armyPosition = this.armiesPositions.get(explorerId);

        if (armyPosition) {
          // Check if user has camera follow enabled and is on worldmap
          const followArmyMoves = useUIStore.getState().followArmyMoves;
          const currentScene = this.sceneManager.getCurrentScene();

          if (followArmyMoves && currentScene === SceneName.WorldMap) {
            this.focusCameraOnEvent(armyPosition.col, armyPosition.row, "Following Army Movement");
          }
          if (resourceId === 0) {
            return;
          }
          const resource = findResourceById(resourceId);
          const ownerAddress = this.getEntityOwnerAddress(explorerId);
          const isOwnArmy = ownerAddress !== undefined && isAddressEqualToAccount(ownerAddress);
          if (isOwnArmy) {
            // Play the sound for the resource gain only when it belongs to the local player
            playResourceSound(resourceId, this.state.isSoundOn, this.state.effectsLevel);
          }
          // Display the resource gain at the army's position
          this.displayResourceGain(resourceId, amount, armyPosition.col, armyPosition.row, resource?.trait + " found");
        } else {
          console.warn(`Could not find army with ID ${explorerId} for resource gain display`);
        }
      }, 500);
    });

    // add particles
    this.selectedHexManager = new SelectedHexManager(this.scene);
    this.selectionPulseManager = new SelectionPulseManager(this.scene);

    this.minimap = new Minimap(this, this.camera);

    // Initialize SceneShortcutManager for WorldMap shortcuts
    this.shortcutManager = new SceneShortcutManager("worldmap", this.sceneManager);

    // Only register shortcuts if they haven't been registered already
    if (!this.shortcutManager.hasShortcuts()) {
      this.shortcutManager.registerShortcut({
        id: "cycle-armies",
        key: "Tab",
        description: "Cycle through armies",
        sceneRestriction: SceneName.WorldMap,
        condition: () => this.selectableArmies.length > 0,
        action: () => void this.selectNextArmy(),
      });

      this.shortcutManager.registerShortcut({
        id: "cycle-structures",
        key: "Tab",
        modifiers: { shift: true },
        description: "Cycle through structures",
        sceneRestriction: SceneName.WorldMap,
        condition: () => this.playerStructures.length > 0,
        action: () => this.selectNextStructure(),
      });

      this.shortcutManager.registerShortcut({
        id: "toggle-view",
        key: "v",
        description: "Toggle between world and local view",
        sceneRestriction: SceneName.WorldMap,
        action: () => toggleMapHexView(),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-close",
        key: "1",
        description: "Zoom to close view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Close),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-medium",
        key: "2",
        description: "Zoom to medium view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Medium),
      });

      this.shortcutManager.registerShortcut({
        id: "camera-view-far",
        key: "3",
        description: "Zoom to far view",
        sceneRestriction: SceneName.WorldMap,
        action: () => this.changeCameraView(CameraView.Far),
      });

      // Register escape key handler
      this.shortcutManager.registerShortcut({
        id: "escape-handler",
        key: "Escape",
        description: "Clear selection or close navigation views",
        sceneRestriction: SceneName.WorldMap,
        action: () => {
          if (this.isNavigationViewOpen()) {
            this.closeNavigationViews();
          } else {
            this.clearSelection();
          }
        },
      });
    }

    window.addEventListener("urlChanged", () => {
      this.clearSelection();
    });

    // Start relic effect validation timer (every 5 seconds)
    this.startRelicValidationTimer();
  }

  private setupCameraZoomHandler() {
    this.resetWheelState();

    this.wheelHandler = (event: WheelEvent) => {
      const enableSmoothZoom = useUIStore.getState().enableMapZoom;

      if (enableSmoothZoom) {
        // Let MapControls handle zooming when smooth zoom is enabled.
        this.resetWheelState();
        return;
      }

      const normalizedDelta = this.normalizeWheelDelta(event);
      const mostlyVertical = Math.abs(normalizedDelta) >= Math.abs(event.deltaX);

      if (!normalizedDelta || !mostlyVertical) {
        return;
      }

      const direction = Math.sign(normalizedDelta) as -1 | 0 | 1;
      if (direction === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (this.wheelDirection !== direction) {
        this.wheelDirection = direction;
        this.wheelStepsThisGesture = 0;
        this.wheelAccumulator = 0;
      }

      this.wheelAccumulator += normalizedDelta;

      if (Math.abs(this.wheelAccumulator) < this.wheelThreshold) {
        this.scheduleWheelAccumulatorReset();
        return;
      }

      if (this.wheelStepsThisGesture >= 1) {
        const saturatingDirection = (Math.sign(this.wheelAccumulator) as -1 | 0 | 1) || direction;
        this.wheelAccumulator = saturatingDirection * this.wheelThreshold;
        this.scheduleWheelAccumulatorReset();
        return;
      }

      this.stepCameraView(direction > 0);
      this.wheelStepsThisGesture = 1;
      this.wheelAccumulator = 0;
      this.scheduleWheelAccumulatorReset();
    };

    const canvas = document.getElementById("main-canvas");
    if (canvas) {
      canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    }
  }

  private stepCameraView(zoomOut: boolean) {
    const nextView = zoomOut
      ? Math.min(CameraView.Far, this.currentCameraView + 1)
      : Math.max(CameraView.Close, this.currentCameraView - 1);

    if (nextView === this.currentCameraView) {
      if (this.isCameraDistanceOutOfSync(this.currentCameraView)) {
        this.changeCameraView(this.currentCameraView);
      }
      return;
    }

    this.changeCameraView(nextView);
  }

  public changeCameraView(position: CameraView) {
    super.changeCameraView(position);
    if (!this.mainDirectionalLight) {
      return;
    }
    this.configureWorldmapShadows();
  }

  private configureWorldmapShadows() {
    if (!this.mainDirectionalLight) {
      return;
    }
    this.mainDirectionalLight.castShadow = true;
    this.mainDirectionalLight.shadow.mapSize.set(2048, 2048);
    this.mainDirectionalLight.shadow.camera.left = -60;
    this.mainDirectionalLight.shadow.camera.right = 60;
    this.mainDirectionalLight.shadow.camera.top = 45;
    this.mainDirectionalLight.shadow.camera.bottom = -45;
    this.mainDirectionalLight.shadow.camera.far = 110;
    this.mainDirectionalLight.shadow.camera.near = 8;
    this.mainDirectionalLight.shadow.bias = -0.02;
    this.mainDirectionalLight.shadow.camera.updateProjectionMatrix();
  }

  private getTargetDistanceForCameraView(view: CameraView): number {
    switch (view) {
      case CameraView.Close:
        return 10;
      case CameraView.Far:
        return 40;
      case CameraView.Medium:
      default:
        return 20;
    }
  }

  private getCurrentCameraDistance(): number {
    return this.controls.object.position.distanceTo(this.controls.target);
  }

  private isCameraDistanceOutOfSync(view: CameraView, tolerance: number = 1): boolean {
    const currentDistance = this.getCurrentCameraDistance();
    const targetDistance = this.getTargetDistanceForCameraView(view);
    return Math.abs(currentDistance - targetDistance) > tolerance;
  }

  private normalizeWheelDelta(event: WheelEvent): number {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * window.innerHeight;
    }

    return event.deltaY;
  }

  private scheduleWheelAccumulatorReset() {
    if (this.wheelResetTimeout) {
      clearTimeout(this.wheelResetTimeout);
    }

    this.wheelResetTimeout = setTimeout(() => {
      this.resetWheelState();
    }, this.wheelGestureTimeoutMs);
  }

  private resetWheelState() {
    const timeoutId = this.wheelResetTimeout;
    this.wheelResetTimeout = null;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    this.wheelAccumulator = 0;
    this.wheelDirection = 0;
    this.wheelStepsThisGesture = 0;
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col !== undefined && row !== undefined) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  private focusCameraOnEvent(col: number, row: number, message: string) {
    this.moveCameraToColRow(col, row, 2);

    const uiStore = useUIStore.getState();
    uiStore.setFollowingArmyMessage(message);
    uiStore.setIsFollowingArmy(true);

    if (this.followCameraTimeout) {
      clearTimeout(this.followCameraTimeout);
    }

    this.followCameraTimeout = setTimeout(() => {
      const store = useUIStore.getState();
      store.setIsFollowingArmy(false);
      store.setFollowingArmyMessage(null);
      this.followCameraTimeout = null;
    }, 3000);
  }

  private getEntityOwnerAddress(entityId: ID): ContractAddress | undefined {
    const armyPosition = this.armiesPositions.get(entityId);
    if (armyPosition) {
      return this.armyHexes.get(armyPosition.col)?.get(armyPosition.row)?.owner;
    }

    const structurePosition = this.structuresPositions.get(entityId);
    if (structurePosition) {
      return this.structureHexes.get(structurePosition.col)?.get(structurePosition.row)?.owner;
    }

    return undefined;
  }

  private getEntityLabel(entityId: ID): string {
    if (this.armiesPositions.has(entityId)) {
      return `Army #${entityId}`;
    }
    if (this.structuresPositions.has(entityId)) {
      return `Structure #${entityId}`;
    }
    return `Entity #${entityId}`;
  }

  private markBattleNotificationHandled(key: string) {
    this.notifiedBattleEvents.add(key);
    if (this.notifiedBattleEvents.size > 100) {
      const iterator = this.notifiedBattleEvents.values().next();
      if (!iterator.done) {
        this.notifiedBattleEvents.delete(iterator.value);
      }
    }
  }

  private openBattleLogsPanel() {
    const uiStore = useUIStore.getState();
    uiStore.setRightNavigationView(RightView.StoryEvents);
  }

  private notifyArmyUnderAttack(update: BattleEventSystemUpdate) {
    const defenderId = update.battleData.defenderId;
    if (typeof defenderId !== "number") {
      return;
    }

    const defenderOwner = this.getEntityOwnerAddress(defenderId);
    if (!defenderOwner || !isAddressEqualToAccount(defenderOwner)) {
      return;
    }

    const focusPosition = this.armiesPositions.get(defenderId) ?? this.structuresPositions.get(defenderId);

    const notificationKey = `${update.entityId}-${update.battleData.timestamp}`;
    if (this.notifiedBattleEvents.has(notificationKey)) {
      return;
    }

    this.markBattleNotificationHandled(notificationKey);

    const attackerId = update.battleData.attackerId;
    const defenderLabel = this.getEntityLabel(defenderId);
    const attackerLabel = typeof attackerId === "number" ? this.getEntityLabel(attackerId) : "Unknown attacker";

    toast(
      <div className="flex flex-col gap-2">
        <div className="text-gold font-bold">⚠️ {defenderLabel} under attack</div>
        <div className="text-light-pink">Engaged by {attackerLabel}.</div>
        <div className="flex gap-2 mt-2">
          <button
            className="bg-gold text-brown font-semibold px-3 py-1 rounded"
            onClick={() => this.openBattleLogsPanel()}
          >
            View logs
          </button>
          {focusPosition && (
            <button
              className="bg-gold text-brown font-semibold px-3 py-1 rounded"
              onClick={() => this.focusCameraOnEvent(focusPosition.col, focusPosition.row, "Following Combat Alert")}
            >
              Focus camera
            </button>
          )}
        </div>
      </div>,
      {
        classNames: {
          toast: "!bg-dark-brown !border-gold/30",
        },
      },
    );
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove(hex: { hexCoords: HexPosition; position: Vector3 } | null): void {
    if (hex === null) {
      this.state.updateEntityActionHoveredHex(null);
      this.state.setHoveredHex(null);

      // Reset cursor when leaving hex
      document.body.style.cursor = "default";

      // Handle label collapse on hex leave
      this.hoverLabelManager.onHexLeave();
      return;
    }
    const { hexCoords } = hex;

    // Handle label expansion on hover
    this.hoverLabelManager.onHexHover(hexCoords);

    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateEntityActionHoveredHex(hexCoords);
    }
  }

  // double-click to enter hex view; spectate when the structure is not yours
  protected onHexagonDoubleClick(hexCoords: HexPosition) {
    const { structure } = this.getHexagonEntity(hexCoords);
    if (!structure) {
      return;
    }

    void this.enterStructureFromWorldmap(structure, hexCoords);
  }

  private async enterStructureFromWorldmap(structure: HexEntityInfo, hexCoords: HexPosition) {
    const accountAddress = ContractAddress(useAccountStore.getState().account?.address || "");
    const isMine = structure.owner === accountAddress;

    try {
      console.log("[WorldmapScene] Syncing structure before entry", structure.id, hexCoords);
      await this.ensureStructureSynced(structure.id, hexCoords);
    } catch (error) {
      console.error("[WorldmapScene] Failed to sync structure before entry", error);
    }

    const contractPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const worldMapPosition =
      Number.isFinite(Number(contractPosition?.x)) && Number.isFinite(Number(contractPosition?.y))
        ? { col: Number(contractPosition?.x), row: Number(contractPosition?.y) }
        : undefined;

    const shouldSpectate = this.state.isSpectating || !isMine;

    this.state.setStructureEntityId(structure.id, {
      spectator: shouldSpectate,
      worldMapPosition,
    });

    navigateToStructure(hexCoords.col, hexCoords.row, "hex");
  }

  protected getHexagonEntity(hexCoords: HexPosition) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const army = this.armyHexes.get(hex.x)?.get(hex.y);
    const structure = this.structureHexes.get(hex.x)?.get(hex.y);
    const quest = this.questHexes.get(hex.x)?.get(hex.y);
    const chest = this.chestHexes.get(hex.x)?.get(hex.y);

    return { army, structure, quest, chest };
  }

  // hexcoords is normalized
  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (!hexCoords) return;

    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const isMine = isAddressEqualToAccount(army?.owner || structure?.owner || 0n);
    this.handleHexSelection(hexCoords, isMine);

    if (army?.owner === account) {
      this.onArmySelection(army.id, account);
    } else if (structure?.owner === account) {
      this.onStructureSelection(structure.id, hexCoords);
    } else if (quest) {
      // Handle quest click
      this.clearEntitySelection();
    } else if (chest) {
      // Handle chest click - chests can be interacted with by anyone
      this.clearEntitySelection();
    } else {
      this.clearEntitySelection();
    }
  }

  protected handleHexSelection(hexCoords: HexPosition, isMine: boolean) {
    const contractHexPosition = new Position({ x: hexCoords.col, y: hexCoords.row }).getContract();
    const position = getWorldPositionForHex(hexCoords);
    if (contractHexPosition.x !== this.state.selectedHex?.col || contractHexPosition.y !== this.state.selectedHex.row) {
      this.selectedHexManager.setPosition(position.x, position.z);
      this.state.setSelectedHex({
        col: contractHexPosition.x,
        row: contractHexPosition.y,
      });

      if (isMine) {
        if (this.state.isSoundOn) {
          AudioManager.getInstance().play("ui.click", { volume: this.state.effectsLevel / 100 });
        }
        // Note: Label filtering is now handled in entity selection methods
        // to avoid removing labels too aggressively on initial selection
      }
    }
  }

  protected onHexagonRightClick(event: MouseEvent, hexCoords: HexPosition | null): void {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;

    if (!hexCoords) {
      return;
    }

    const { structure } = this.getHexagonEntity(hexCoords);
    const { selectedEntityId, actionPaths } = this.state.entityActions;
    const hasActiveEntityAction = Boolean(selectedEntityId && actionPaths.size > 0);

    const isMineStructure = structure?.owner !== undefined ? isAddressEqualToAccount(structure.owner) : false;

    if (structure && isMineStructure && !hasActiveEntityAction) {
      openStructureContextMenu({
        event,
        structure,
        hexCoords,
        components: this.dojo.components,
        isSoundOn: this.state.isSoundOn,
        effectsLevel: this.state.effectsLevel,
      });
      return;
    }

    if (selectedEntityId && actionPaths.size > 0 && hexCoords) {
      const actionPath = actionPaths.get(ActionPaths.posKey(hexCoords, true));
      if (actionPath && account) {
        const actionType = ActionPaths.getActionType(actionPath);

        // Only validate army availability for army-specific actions
        const armyActions = [ActionType.Explore, ActionType.Move, ActionType.Attack];
        if (actionType && armyActions.includes(actionType)) {
          if (this.armyManager && !this.armyManager.isArmySelectable(selectedEntityId)) {
            console.warn(`Army ${selectedEntityId} no longer available for movement`);
            this.clearEntitySelection();
            return;
          }
        }

        if (actionType === ActionType.Explore || actionType === ActionType.Move) {
          this.onArmyMovement(account, actionPath, selectedEntityId);
        } else if (actionType === ActionType.Attack) {
          this.onArmyAttack(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Help) {
          this.onArmyHelp(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Quest) {
          this.onQuestSelection(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Chest) {
          this.onChestSelection(actionPath, selectedEntityId);
        } else if (actionType === ActionType.CreateArmy) {
          this.onArmyCreate(actionPath, selectedEntityId);
        }
      }
    }
  }

  private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID) {
    // can only move on explored hexes
    const isExplored = ActionPaths.getActionType(actionPath) === ActionType.Move;
    if (actionPath.length > 0) {
      const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);
      if (this.state.isSoundOn) {
        AudioManager.getInstance().play("unit.march", { volume: this.state.effectsLevel / 100 });
      }

      // Get the target position for the effect
      const targetHex = actionPath[actionPath.length - 1].hex;
      const position = getWorldPositionForHex({ col: targetHex.col - FELT_CENTER, row: targetHex.row - FELT_CENTER });

      // Play effect based on action type: compass for exploring, travel for moving
      const key = `${targetHex.col},${targetHex.row}`;
      const effectType = isExplored ? "travel" : "compass";
      const effectLabel = isExplored ? "Traveling" : "Exploring";

      const existingEffect = this.travelEffects.get(key);
      if (existingEffect) {
        existingEffect();
        this.travelEffects.delete(key);
      }

      const { end } = this.fxManager.playFxAtCoords(
        effectType,
        position.x,
        position.y + 2.5,
        position.z,
        0.95,
        effectLabel,
        true,
      );

      // Store the end function with the hex coordinates as key
      this.travelEffects.set(key, end);

      const cleanup = () => {
        const endEffect = this.travelEffects.get(key);
        if (endEffect) {
          endEffect();
          this.travelEffects.delete(key);
        }
      };

      // Mark army as having pending movement transaction
      this.pendingArmyMovements.add(selectedEntityId);

      // Monitor memory usage before army movement action
      this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-start-${selectedEntityId}`);

      armyActionManager
        .moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick)
        .then(() => {
          // Transaction submitted successfully, cleanup visual effects
          cleanup();
          // Monitor memory usage after army movement completion
          this.memoryMonitor?.getCurrentStats(`worldmap-moveArmy-complete-${selectedEntityId}`);
        })
        .catch((e) => {
          // Transaction failed, remove from pending and cleanup
          this.pendingArmyMovements.delete(selectedEntityId);
          cleanup();
          console.error("Army movement failed:", e);
        });

      this.state.updateEntityActionHoveredHex(null);
    }
    // clear after movement
    this.clearSelection();
  }

  private onArmyAttack(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    const targetHex = selectedPath[selectedPath.length - 1];
    const target = this.getHexagonEntity(targetHex);
    const selected = this.getHexagonEntity(selectedPath[0]);

    const attackerSummary = {
      type: selected.army ? ActorType.Explorer : ActorType.Structure,
      id: selectedEntityId,
      hex: new Position({ x: selectedPath[0].col, y: selectedPath[0].row }).getContract(),
    };
    const targetSummary = {
      type: target.army ? ActorType.Explorer : ActorType.Structure,
      id: target.army?.id || target.structure?.id || 0,
      hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
    };

    this.state.toggleModal(<QuickAttackPreview attacker={attackerSummary} target={targetSummary} />);
  }

  private onArmyCreate(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];
    const direction = getDirectionBetweenAdjacentHexes(
      { col: selectedPath[0].col, row: selectedPath[0].row },
      { col: targetHex.col, row: targetHex.row },
    );

    if (direction === undefined || direction === null) return;

    this.state.toggleModal(
      <UnifiedArmyCreationModal structureId={selectedEntityId} direction={direction} isExplorer={true} />,
    );
  }

  // actionPath is not normalized
  private onArmyHelp(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];
    const selectedHex = selectedPath[0];
    const selected = this.getHexagonEntity(selectedHex);
    const target = this.getHexagonEntity(targetHex);
    const account = ContractAddress(useAccountStore.getState().account?.address || "");
    const isTargetMine = target.army?.owner === account || target.structure?.owner === account;
    const isSelectedMine = selected.army?.owner === account || selected.structure?.owner === account;

    this.state.toggleModal(
      <HelpModal
        selected={{
          type: selected.army ? ActorType.Explorer : ActorType.Structure,
          id: selectedEntityId,
          hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
        }}
        target={{
          type: target.army ? ActorType.Explorer : ActorType.Structure,
          id: target.army?.id || target.structure?.id || 0,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        }}
        allowBothDirections={isTargetMine && isSelectedMine}
      />,
    );
  }

  private onStructureSelection(selectedEntityId: ID, hexCoords?: HexPosition) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const structure = new StructureActionManager(this.dojo.components, selectedEntityId);

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(this.armyHexes, this.exploredTiles, ContractAddress(playerAddress));

    this.state.updateEntityActionActionPaths(actionPaths.getPaths());

    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());

    // Show selection pulse for the selected structure
    if (hexCoords) {
      const worldPos = getWorldPositionForHex(hexCoords);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      // Set structure-specific pulse colors (orange/gold for structures)
      this.selectionPulseManager.setPulseColor(
        new Color(1.0, 0.6, 0.2), // Orange base
        new Color(1.0, 0.9, 0.4), // Gold pulse
      );
    }

    const extraHexes: HexPosition[] = [];
    if (hexCoords) {
      extraHexes.push(hexCoords);
    }
    this.updateStructureOwnershipPulses(selectedEntityId, extraHexes);
  }

  private onArmySelection(selectedEntityId: ID, playerAddress: ContractAddress) {
    // Check if army has pending movement transactions
    if (this.pendingArmyMovements.has(selectedEntityId)) {
      return;
    }

    // Check if army is currently being rendered or is in chunk transition
    if (this.globalChunkSwitchPromise) {
      // Defer selection until chunk switch completes
      this.globalChunkSwitchPromise.then(() => {
        // Retry selection after chunk switch
        if (this.armyManager.hasArmy(selectedEntityId)) {
          this.onArmySelection(selectedEntityId, playerAddress);
        } else {
          console.warn(`[DEBUG] Army ${selectedEntityId} not available after chunk switch`);
        }
      });
      return;
    }

    // Ensure army is available for selection
    if (!this.armyManager.hasArmy(selectedEntityId)) {
      console.warn(`[DEBUG] Army ${selectedEntityId} not available in current chunk for selection`);

      return;
    }

    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.questHexes,
      this.chestHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );

    const paths = actionPaths.getPaths();
    const highlightedHexes = actionPaths.getHighlightedHexes();

    this.state.updateEntityActionActionPaths(paths);
    this.highlightHexManager.highlightHexes(highlightedHexes);

    // Show selection pulse for the selected army
    const selectedArmyData = this.armyManager
      .getArmies()
      .find((army) => Number(army.entityId) === Number(selectedEntityId));
    const armyPosition = this.armiesPositions.get(selectedEntityId);
    if (armyPosition) {
      const worldPos = getWorldPositionForHex(armyPosition);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      // Set army-specific pulse colors (blue/cyan for armies)
      this.selectionPulseManager.setPulseColor(
        new Color(0.2, 0.6, 1.0), // Blue base
        new Color(0.8, 1.0, 1.0), // Cyan pulse
      );
    } else {
      console.warn(`[DEBUG] No army position found for ${selectedEntityId} in armiesPositions map`);
    }

    const extraHexes: HexPosition[] = [];
    if (armyPosition) {
      extraHexes.push(armyPosition);
    }

    const owningStructureId =
      selectedArmyData?.owningStructureId ?? this.armyStructureOwners.get(selectedEntityId) ?? null;

    this.updateStructureOwnershipPulses(owningStructureId ?? undefined, extraHexes);
  }

  // handle quest selection
  private onQuestSelection(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    // Get the target hex (last hex in the path)
    const targetHex = selectedPath[selectedPath.length - 1];

    this.state.toggleModal(
      <QuestModal
        explorerEntityId={selectedEntityId}
        targetHex={new Position({ x: targetHex.col, y: targetHex.row }).getContract()}
      />,
    );
  }

  private onChestSelection(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);

    // Get the target hex (last hex in the path)
    const targetHex = selectedPath[selectedPath.length - 1];

    this.state.toggleModal(
      <ChestModal
        selected={{
          type: ActorType.Explorer,
          id: selectedEntityId,
          hex: { x: targetHex.col, y: targetHex.row },
        }}
        chestHex={{ x: targetHex.col, y: targetHex.row }}
      />,
    );
  }

  private clearSelection() {
    this.selectedHexManager.resetPosition();
    this.state.setSelectedHex(null);
    this.clearEntitySelection();
  }

  private clearEntitySelection() {
    this.highlightHexManager.highlightHexes([]);
    this.state.updateEntityActionActionPaths(new Map());
    this.state.updateEntityActionSelectedEntityId(null);
    this.selectionPulseManager.hideSelection(); // Hide selection pulse
    this.selectionPulseManager.clearOwnershipPulses();
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();
  }

  private updateStructureOwnershipPulses(structureId: ID | undefined, extraHexes: HexPosition[] = []) {
    if (structureId === undefined || structureId === null) {
      this.selectionPulseManager.clearOwnershipPulses();
      return;
    }

    const colors = this.getStructurePulseColors(structureId);
    const positions: Array<{ x: number; z: number }> = [];
    const seenHexes = new Set<string>();

    const addHex = (hex: HexPosition | null | undefined) => {
      if (!hex) return;
      const key = `${hex.col},${hex.row}`;
      if (seenHexes.has(key)) {
        return;
      }
      seenHexes.add(key);
      const worldPos = getWorldPositionForHex(hex);
      positions.push({ x: worldPos.x, z: worldPos.z });
    };

    addHex(this.getStructureHexPosition(structureId));

    this.armyManager.getArmies().forEach((army) => {
      if (army.owningStructureId === structureId) {
        const normalized = army.hexCoords.getNormalized();
        addHex({ col: normalized.x, row: normalized.y });
      }
    });

    this.armyStructureOwners.forEach((ownerStructureId, armyId) => {
      if (ownerStructureId === structureId) {
        addHex(this.armiesPositions.get(armyId));
      }
    });

    extraHexes.forEach((hex) => addHex(hex));

    if (positions.length === 0) {
      this.selectionPulseManager.clearOwnershipPulses();
      return;
    }

    this.selectionPulseManager.showOwnershipPulses(positions, colors.base, colors.pulse);
  }

  private getStructurePulseColors(structureId: ID) {
    const key = structureId.toString();
    const cached = this.structurePulseColorCache.get(key);
    if (cached) {
      return cached;
    }

    const numericId = Number(structureId);
    const hue = (((numericId % 360) + 360) % 360) / 360;
    const base = new Color().setHSL(hue, 0.65, 0.4);
    const pulse = new Color().setHSL(hue, 0.65, 0.6);
    const colors = { base, pulse };
    this.structurePulseColorCache.set(key, colors);
    return colors;
  }

  private getStructureHexPosition(structureId: ID): HexPosition | null {
    const cached = this.structuresPositions.get(structureId);
    if (cached) {
      return cached;
    }

    for (const [col, rowMap] of this.structureHexes) {
      for (const [row, info] of rowMap) {
        if (info.id === structureId) {
          const hex = { col, row };
          this.structuresPositions.set(structureId, hex);
          return hex;
        }
      }
    }

    return null;
  }

  setup() {
    this.controls.maxDistance = 40;
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.configureWorldmapShadows();
    this.controls.enablePan = true;
    this.controls.enableZoom = useUIStore.getState().enableMapZoom;
    this.controls.zoomToCursor = false;
    this.highlightHexManager.setYOffset(0.025);

    // Clear any cached chunk data before moving the camera, so subsequent loads rebuild fresh state
    this.clearTileEntityCache();

    this.moveCameraToURLLocation();
    // this.changeCameraView(2);
    this.minimap.moveMinimapCenterToUrlLocation();
    this.minimap.showMinimap();

    // Configure thunder bolts for worldmap - dramatic storm effect
    this.getThunderBoltManager().setConfig({
      radius: 18, // Large spread across the visible area
      count: 6, // Many thunder bolts for dramatic effect
      duration: 400, // Medium duration for good visibility
      persistent: false, // Auto-fade for production use
      debug: false, // Disable logging for performance
    });

    // Close left navigation on world map load
    useUIStore.getState().setLeftNavigationView(LeftView.None);

    // Add label groups to scene
    this.scene.add(this.armyLabelsGroup);
    this.scene.add(this.structureLabelsGroup);
    this.scene.add(this.questLabelsGroup);
    this.scene.add(this.chestLabelsGroup);

    // Update army and structure managers
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();

    this.registerStoreSubscriptions();

    this.setupCameraZoomHandler();

    // Ensure interactive hexes/chunks are initialized now that managers exist and caches are reset
    this.updateVisibleChunks(true).catch((error) => console.error("Failed to update visible chunks:", error));
  }

  onSwitchOff() {
    this.disposeStoreSubscriptions();

    // Remove label groups from scene
    this.scene.remove(this.armyLabelsGroup);
    this.scene.remove(this.structureLabelsGroup);
    this.scene.remove(this.questLabelsGroup);
    this.scene.remove(this.chestLabelsGroup);

    // Clean up labels
    this.minimap.hideMinimap();
    this.armyManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing army labels from scene");
    this.structureManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing structure labels from scene");
    this.questManager.removeLabelsFromScene();
    this.chestManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing quest labels from scene");

    // Clear any pending army removals
    this.pendingArmyRemovals.forEach((timeout) => clearTimeout(timeout));
    this.pendingArmyRemovals.clear();
    this.pendingArmyRemovalMeta.clear();
    this.armyLastUpdateAt.clear();

    this.armyStructureOwners.clear();

    // Clean up wheel event listener
    if (this.wheelHandler) {
      const canvas = document.getElementById("main-canvas");
      if (canvas) {
        canvas.removeEventListener("wheel", this.wheelHandler);
      }
      this.wheelHandler = null;
    }
    this.resetWheelState();

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  public deleteArmy(entityId: ID, options: { playDefeatFx?: boolean } = {}) {
    const { playDefeatFx = true } = options;
    this.cancelPendingArmyRemoval(entityId);
    console.debug(`[WorldMap] deleteArmy invoked for entity ${entityId}`);
    this.armyManager.removeArmy(entityId, { playDefeatFx });
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
    } else {
      // Fallback: scan hex cache in case tracking was cleared before cleanup
      for (const rowMap of this.armyHexes.values()) {
        const entry = Array.from(rowMap.entries()).find(([, data]) => data.id === entityId);
        if (entry) {
          rowMap.delete(entry[0]);
          break;
        }
      }
    }
    this.armiesPositions.delete(entityId);
    this.armyLastUpdateAt.delete(entityId);
    this.pendingArmyRemovalMeta.delete(entityId);
    this.armyStructureOwners.delete(entityId);
    this.pendingArmyMovements.delete(entityId);
  }

  private scheduleArmyRemoval(entityId: ID, reason: "tile" | "zero" = "tile") {
    const existing = this.pendingArmyRemovals.get(entityId);
    if (existing) {
      clearTimeout(existing);
    }

    const hasPendingMovement = reason === "tile" && this.pendingArmyMovements.has(entityId);
    // Increased delays to allow tile updates to propagate properly
    // - tile removals now wait longer (1500ms instead of 600ms) to ensure movement updates arrive
    // - zero troop removals are immediate (0ms) since they're confirmed deaths
    const baseDelay = reason === "tile" ? 1500 : 0;
    const initialDelay = hasPendingMovement ? 3000 : baseDelay;
    const retryDelay = 500;
    const maxPendingWaitMs = 10000; // Increased from 8000ms to 10000ms

    console.debug(
      `[WorldMap] Scheduling army removal for entity ${entityId} (reason: ${reason}, delay: ${initialDelay}ms, hasPendingMovement: ${hasPendingMovement})`,
    );

    const scheduledAt = Date.now();
    this.pendingArmyRemovalMeta.set(entityId, {
      scheduledAt,
      chunkKey: this.currentChunk,
      reason,
    });

    const schedule = (delay: number) => {
      const timeout = setTimeout(() => {
        const meta = this.pendingArmyRemovalMeta.get(entityId);
        if (!meta) {
          this.pendingArmyRemovals.delete(entityId);
          return;
        }

        if (reason === "tile") {
          const lastUpdate = this.armyLastUpdateAt.get(entityId) ?? 0;
          if (lastUpdate > meta.scheduledAt) {
            console.debug(
              `[WorldMap] Skipping removal for entity ${entityId} - newer tile data detected (${lastUpdate - meta.scheduledAt}ms delta)`,
            );
            this.pendingArmyRemovalMeta.delete(entityId);
            this.pendingArmyRemovals.delete(entityId);
            return;
          }

          if (this.currentChunk !== meta.chunkKey) {
            console.debug(
              `[WorldMap] Aborting tile-based removal for entity ${entityId} due to chunk switch (${meta.chunkKey} -> ${this.currentChunk})`,
            );
            this.pendingArmyRemovalMeta.delete(entityId);
            this.pendingArmyRemovals.delete(entityId);
            return;
          }

          if (this.pendingArmyMovements.has(entityId)) {
            const elapsed = Date.now() - meta.scheduledAt;
            if (elapsed < maxPendingWaitMs) {
              console.debug(
                `[WorldMap] Army ${entityId} still has pending movement, retrying removal in ${retryDelay}ms (elapsed: ${elapsed.toFixed(
                  0,
                )}ms)`,
              );
              schedule(retryDelay);
              return;
            }

            console.warn(
              `[WorldMap] Pending movement timeout while removing entity ${entityId}, forcing cleanup after ${elapsed.toFixed(
                0,
              )}ms`,
            );
            this.pendingArmyMovements.delete(entityId);
          }
        }

        this.pendingArmyRemovals.delete(entityId);
        this.pendingArmyRemovalMeta.delete(entityId);
        console.debug(`[WorldMap] Finalizing pending removal for entity ${entityId} (reason: ${reason})`);
        const playDefeatFx = reason !== "tile";
        this.deleteArmy(entityId, { playDefeatFx });
      }, delay);

      this.pendingArmyRemovals.set(entityId, timeout);
    };

    schedule(initialDelay);
  }

  private cancelPendingArmyRemoval(entityId: ID) {
    const timeout = this.pendingArmyRemovals.get(entityId);
    if (!timeout) return;

    clearTimeout(timeout);
    this.pendingArmyRemovals.delete(entityId);
    this.pendingArmyRemovalMeta.delete(entityId);
    console.debug(`[WorldMap] Cancelled pending removal for entity ${entityId}`);
  }

  public deleteChest(entityId: ID) {
    this.chestManager.removeChest(entityId);
    // Find and remove from chestHexes
    this.chestHexes.forEach((rowMap) => {
      rowMap.forEach((hex, row) => {
        if (hex.id === entityId) {
          rowMap.delete(row);
        }
      });
    });
  }

  // used to track the position of the armies on the map
  public updateArmyHexes(update: {
    entityId: ID;
    hexCoords: HexPosition;
    ownerAddress?: bigint | undefined;
    ownerStructureId?: ID | null;
  }) {
    const {
      hexCoords: { col, row },
      ownerAddress,
      entityId,
      ownerStructureId,
    } = update;

    if (ownerAddress === undefined) {
      console.warn(`[DEBUG] Army ${entityId} has undefined owner address, skipping update`);
      return;
    }

    if (ownerStructureId !== undefined && ownerStructureId !== null && ownerStructureId !== 0) {
      this.armyStructureOwners.set(entityId, ownerStructureId);
    } else {
      this.armyStructureOwners.delete(entityId);
    }

    let actualOwnerAddress = ownerAddress;
    if (ownerAddress === 0n) {
      console.warn(`[DEBUG] Army ${entityId} has zero owner address (0n) - army defeated/deleted`);

      // Check if we already have this army with a valid owner
      const existingArmy = this.armiesPositions.has(entityId);
      if (existingArmy) {
        // Try to find existing army data in armyHexes to preserve owner
        for (const [col, rowMap] of this.armyHexes) {
          for (const [row, armyData] of rowMap) {
            if (armyData.id === entityId && armyData.owner !== 0n) {
              actualOwnerAddress = armyData.owner;
              break;
            }
          }
          if (actualOwnerAddress !== 0n) break;
        }

        // If we still have 0n owner, the army was defeated/deleted - clean up the cache
        if (actualOwnerAddress === 0n) {
          console.warn(`[DEBUG] Removing army ${entityId} from cache (0n owner indicates defeat/deletion)`);
          const oldPos = this.armiesPositions.get(entityId);
          if (oldPos) {
            this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
            this.invalidateAllChunkCachesContainingHex(oldPos.col, oldPos.row);
          }
          this.armiesPositions.delete(entityId);
          this.armyStructureOwners.delete(entityId);
          return;
        }
      }
    }

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    // Update army position
    this.armiesPositions.set(entityId, newPos);
    this.armyLastUpdateAt.set(entityId, Date.now());

    // Remove from old position if it changed
    if (
      oldPos &&
      (oldPos.col !== newPos.col || oldPos.row !== newPos.row) &&
      this.armyHexes.get(oldPos.col)?.get(oldPos.row)?.id === entityId
    ) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.invalidateAllChunkCachesContainingHex(oldPos.col, oldPos.row);
    }

    // Add to new position
    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }

    const armyHexData = { id: entityId, owner: actualOwnerAddress };

    this.armyHexes.get(newPos.col)?.set(newPos.row, armyHexData);
    this.invalidateAllChunkCachesContainingHex(newPos.col, newPos.row);

    // Verify what was actually stored
    const storedArmy = this.armyHexes.get(newPos.col)?.get(newPos.row);

    // Remove from pending movements when position is updated from blockchain
    if (this.pendingArmyMovements.has(entityId)) {
      this.pendingArmyMovements.delete(entityId);
    }
  }

  public updateStructureHexes(update: {
    entityId: ID;
    hexCoords: HexPosition;
    owner: { address: bigint | undefined };
  }) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

    if (address === undefined) return;
    const normalized = new Position({ x: col, y: row }).getNormalized();

    // Update structure position
    this.structuresPositions.set(entityId, { col: normalized.x, row: normalized.y });

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.structureHexes.has(newCol)) {
      this.structureHexes.set(newCol, new Map());
    }
    this.structureHexes.get(newCol)?.set(newRow, { id: entityId, owner: address });
  }

  // update quest hexes on the map
  public updateQuestHexes(update: QuestSystemUpdate) {
    const {
      hexCoords: { col, row },
      entityId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.questHexes.has(newCol)) {
      this.questHexes.set(newCol, new Map());
    }
    this.questHexes.get(newCol)?.set(newRow, { id: entityId, owner: 0n });
  }

  // update chest hexes on the map
  public updateChestHexes(update: ChestSystemUpdate) {
    const {
      hexCoords: { col, row },
      occupierId,
    } = update;

    const normalized = new Position({ x: col, y: row }).getNormalized();

    const newCol = normalized.x;
    const newRow = normalized.y;

    if (!this.chestHexes.has(newCol)) {
      this.chestHexes.set(newCol, new Map());
    }
    this.chestHexes.get(newCol)?.set(newRow, { id: occupierId, owner: 0n });
  }

  public async updateExploredHex(update: TileSystemUpdate) {
    const { hexCoords, removeExplored, biome } = update;

    const normalized = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();

    const col = normalized.x;
    const row = normalized.y;

    // Check if there's a compass effect for this hex and end it
    const key = `${hexCoords.col},${hexCoords.row}`;
    const endCompass = this.travelEffects.get(key);
    if (endCompass) {
      endCompass();
      this.travelEffects.delete(key);
    }

    if (removeExplored) {
      const chunkRow = parseInt(this.currentChunk.split(",")[0]);
      const chunkCol = parseInt(this.currentChunk.split(",")[1]);
      this.exploredTiles.get(col)?.delete(row);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
      this.removeCachedMatricesAroundColRow(chunkRow, chunkCol);
      this.currentChunk = "null"; // reset the current chunk to force a recomputation
      this.updateVisibleChunks().catch((error) => console.error("Failed to update visible chunks:", error));
      return;
    }

    if (!this.exploredTiles.has(col)) {
      this.exploredTiles.set(col, new Map());
    }
    if (!this.exploredTiles.get(col)!.has(row)) {
      this.exploredTiles.get(col)!.set(row, biome);
    } else {
      return;
    }

    const pos = getWorldPositionForHex({ row, col });

    const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
    const isQuest = this.questManager.questHexCoords.get(col)?.has(row) || false;
    const shouldHideTile = isStructure || isQuest;

    const renderedChunkStartRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkStartCol = parseInt(this.currentChunk.split(",")[1]);
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(
      renderedChunkStartRow,
      renderedChunkStartCol,
    );

    this.invalidateAllChunkCachesContainingHex(col, row);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (this.isColRowInVisibleChunk(col, row)) {
      await this.updateHexagonGridPromise;
      const chunkWidth = this.renderChunkSize.width;
      const chunkHeight = this.renderChunkSize.height;
      if (shouldHideTile) {
        await this.updateHexagonGrid(renderedChunkStartRow, renderedChunkStartCol, chunkHeight, chunkWidth);
        return;
      }

      // Add hex to all interactive hexes
      this.interactiveHexManager.addHex({ col, row });

      // Update which hexes are visible in the current chunk
      this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, chunkWidth, chunkHeight);

      await Promise.all(this.modelLoadPromises);
      dummy.position.copy(pos);
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);

      if (!IS_FLAT_MODE) {
        const rotationSeed = this.hashCoordinates(col, row);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;
        dummy.rotation.y = randomRotation;
        dummy.position.y += 0.05;
      } else {
        dummy.position.y += 0.1;
        dummy.rotation.y = 0;
      }

      dummy.updateMatrix();

      const biomeVariant = getBiomeVariant(biome, col, row);
      const hexMesh = this.biomeModels.get(biomeVariant as any)!;
      const currentCount = hexMesh.getCount();
      hexMesh.setMatrixAt(currentCount, dummy.matrix);
      hexMesh.setCount(currentCount + 1);
      hexMesh.needsUpdate();

      // Cache the updated matrices for the chunk
      this.cacheMatricesForChunk(renderedChunkStartRow, renderedChunkStartCol);
    }
  }

  isColRowInVisibleChunk(col: number, row: number) {
    const startRow = parseInt(this.currentChunk.split(",")[0]);
    const startCol = parseInt(this.currentChunk.split(",")[1]);
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);

    if (
      col >= chunkCenterCol - this.renderChunkSize.width / 2 &&
      col <= chunkCenterCol + this.renderChunkSize.width / 2 &&
      row >= chunkCenterRow - this.renderChunkSize.height / 2 &&
      row <= chunkCenterRow + this.renderChunkSize.height / 2
    ) {
      return true;
    }
    return false;
  }

  private getSurroundingChunkKeys(centerRow: number, centerCol: number): string[] {
    const chunkKeys: string[] = [];

    // Load an asymmetric grid - more chunks toward the top of the screen (negative row direction)
    // due to the oblique camera angle
    for (let rowOffset = -2; rowOffset <= 1; rowOffset++) {
      // More chunks above (-2) than below (+1)
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        const row = centerRow + rowOffset * this.chunkSize;
        const col = centerCol + colOffset * this.chunkSize;
        chunkKeys.push(`${row},${col}`);
      }
    }

    return chunkKeys;
  }

  getChunksAround(chunkKey: string) {
    const startRow = parseInt(chunkKey.split(",")[0]);
    const startCol = parseInt(chunkKey.split(",")[1]);
    const chunks: string[] = [];
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += this.chunkSize) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += this.chunkSize) {
        const { x, z } = getWorldPositionForHex({ row: startRow + i, col: startCol + j });
        const { chunkX, chunkZ } = this.worldToChunkCoordinates(x, z);
        const _chunkKey = `${chunkZ * this.chunkSize},${chunkX * this.chunkSize}`;
        if (!chunks.includes(_chunkKey)) {
          chunks.push(_chunkKey);
        }
      }
    }
    return chunks;
  }

  removeCachedMatricesAroundColRow(col: number, row: number) {
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += this.chunkSize) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += this.chunkSize) {
        if (i === 0 && j === 0) {
          continue;
        }
        this.removeCachedMatricesForChunk(row + i, col + j);
      }
    }
  }

  private invalidateAllChunkCachesContainingHex(col: number, row: number) {
    const pos = getWorldPositionForHex({ row, col });
    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);

    const baseChunkCol = chunkX * this.chunkSize;
    const baseChunkRow = chunkZ * this.chunkSize;

    const chunksToInvalidate = [
      `${baseChunkRow},${baseChunkCol}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol}`,
      `${baseChunkRow - this.chunkSize},${baseChunkCol + this.chunkSize}`,
      `${baseChunkRow},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow},${baseChunkCol + this.chunkSize}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol - this.chunkSize}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol}`,
      `${baseChunkRow + this.chunkSize},${baseChunkCol + this.chunkSize}`,
    ];

    for (const chunkKey of chunksToInvalidate) {
      const [chunkRowStr, chunkColStr] = chunkKey.split(",");
      const chunkRow = parseInt(chunkRowStr);
      const chunkCol = parseInt(chunkColStr);
      this.removeCachedMatricesForChunk(chunkRow, chunkCol);
    }
  }

  clearCache() {
    for (const chunkKey of this.cachedMatrices.keys()) {
      this.disposeCachedMatrices(chunkKey);
    }
    this.cachedMatrices.clear();
    this.cachedMatrixOrder = [];
    MatrixPool.getInstance().clear();
    InstancedMatrixAttributePool.getInstance().clear();
  }

  private computeInteractiveHexes(startRow: number, startCol: number, width: number, height: number) {
    // Instead of clearing and recomputing all hexes, just update which ones are visible
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, width, height);
  }

  async updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    const memoryMonitor = (window as any).__gameRenderer?.memoryMonitor;
    const preUpdateStats = memoryMonitor?.getCurrentStats(`hex-grid-update-${startRow}-${startCol}`);

    const matrixPoolInstance = MatrixPool.getInstance();
    const totalHexes = rows * cols;
    matrixPoolInstance.ensureCapacity(totalHexes + 512);

    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      this.computeInteractiveHexes(startRow, startCol, cols, rows);

      if (memoryMonitor && preUpdateStats) {
        const postStats = memoryMonitor.getCurrentStats(`hex-grid-cached-${startRow}-${startCol}`);
        const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
        if (Math.abs(memoryDelta) > 10) {
          // Keep hook for future instrumentation
        }
      }
      this.updateHexagonGridPromise = null;
      return;
    }

    const taskToken = Symbol("hex-grid-task");
    this.currentHexGridTask = taskToken;
    if (this.hexGridFrameHandle !== null) {
      cancelAnimationFrame(this.hexGridFrameHandle);
      this.hexGridFrameHandle = null;
    }

    const halfRows = rows / 2;
    const halfCols = cols / 2;
    const minBatch = Math.min(this.hexGridMinBatch, totalHexes);
    const maxBatch = Math.max(minBatch, Math.min(this.hexGridMaxBatch, totalHexes));
    const frameBudget = this.hexGridFrameBudgetMs;

    this.updateHexagonGridPromise = new Promise((resolve) => {
      const biomeHexes: Record<BiomeType | "Outline" | string, Matrix4[]> = {
        None: [],
        Ocean: [],
        DeepOcean: [],
        Beach: [],
        Scorched: [],
        Bare: [],
        Tundra: [],
        Snow: [],
        TemperateDesert: [],
        Shrubland: [],
        ShrublandAlt: [],
        Taiga: [],
        Grassland: [],
        GrasslandAlt: [],
        TemperateDeciduousForest: [],
        TemperateDeciduousForestAlt: [],
        TemperateRainForest: [],
        SubtropicalDesert: [],
        TropicalSeasonalForest: [],
        TropicalRainForest: [],
        Outline: [],
      };

      let currentIndex = 0;
      let resolved = false;

      const tempMatrix = new Matrix4();
      const tempPosition = new Vector3();
      const rotationMatrix = new Matrix4();
      const matrixPool = matrixPoolInstance;
      const hexRadius = HEX_SIZE;
      const hexHeight = hexRadius * 2;
      const hexWidth = Math.sqrt(3) * hexRadius;
      const vertDist = hexHeight * 0.75;
      const horizDist = hexWidth;
      const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);

      this.computeTileEntities(this.currentChunk);

      const cleanupTask = () => {
        if (this.hexGridFrameHandle !== null) {
          cancelAnimationFrame(this.hexGridFrameHandle);
          this.hexGridFrameHandle = null;
        }
        if (this.currentHexGridTask === taskToken) {
          this.currentHexGridTask = null;
        }
      };

      const releaseAllMatrices = () => {
        let totalReleased = 0;
        Object.values(biomeHexes).forEach((matrices) => {
          matrices.forEach((matrix) => matrixPool.releaseMatrix(matrix));
          totalReleased += matrices.length;
        });
        (Object.keys(biomeHexes) as Array<keyof typeof biomeHexes>).forEach((key) => {
          biomeHexes[key].length = 0;
        });
        return totalReleased;
      };

      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          cleanupTask();
          resolve();
        }
      };

      const abortTask = () => {
        const released = releaseAllMatrices();
        if (released > 0) {
          console.log(`🔄 Released ${released} matrices back to pool (aborted)`);
        }
        resolveOnce();
      };

      const finalizeSuccess = () => {
        for (const [biome, matrices] of Object.entries(biomeHexes)) {
          const hexMesh = this.biomeModels.get(biome as any);

          if (!hexMesh) {
            if (matrices.length > 0) {
              console.error(`❌ Missing biome model for: ${biome}`);
              console.log(`Available biome models:`, Array.from(this.biomeModels.keys()));
            }
            continue;
          }

          if (matrices.length === 0) {
            hexMesh.setCount(0);
            continue;
          }

          console.log(`✅ Applied ${matrices.length} ${biome} hexes`);

          matrices.forEach((matrix, index) => {
            hexMesh.setMatrixAt(index, matrix);
          });
          hexMesh.setCount(matrices.length);
          hexMesh.needsUpdate();
        }

        this.cacheMatricesForChunk(startRow, startCol);
        this.interactiveHexManager.updateVisibleHexes(chunkCenterRow, chunkCenterCol, cols, rows);

        const biomeCountsSnapshot = Object.fromEntries(
          Object.entries(biomeHexes)
            .map(([key, value]) => [key, value.length])
            .filter(([, count]) => Number(count) > 0),
        );

        const released = releaseAllMatrices();
        console.log(`🔄 Released ${released} matrices back to pool`);

        if (memoryMonitor && preUpdateStats) {
          const postStats = memoryMonitor.getCurrentStats(`hex-grid-generated-${startRow}-${startCol}`);
          const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
          const poolStats = matrixPool.getStats();
          console.log(
            `[HEX GRID] OPTIMIZED generation memory impact: ${memoryDelta.toFixed(1)}MB (${rows}x${cols} hexes)`,
          );
          console.log(
            `📊 Matrix Pool Stats: ${poolStats.available} available, ${poolStats.inUse} in use, ${poolStats.memoryEstimateMB.toFixed(1)}MB pool memory`,
          );

          console.log(`📊 Biome distribution:`, biomeCountsSnapshot);

          if (memoryDelta > 15) {
            console.warn(`[HEX GRID] Unexpected memory usage: ${memoryDelta.toFixed(1)}MB`);
          } else {
            console.log(`✅ [HEX GRID] Memory optimization successful! Saved ~${(82 - memoryDelta).toFixed(1)}MB`);
          }
        }

        resolveOnce();
      };

      const processCell = (index: number) => {
        const rowOffset = Math.floor(index / cols) - halfRows;
        const colOffset = (index % cols) - halfCols;

        const globalRow = chunkCenterRow + rowOffset;
        const globalCol = chunkCenterCol + colOffset;

        const rowOffsetValue = ((globalRow % 2) * Math.sign(globalRow) * horizDist) / 2;
        const baseX = globalCol * horizDist - rowOffsetValue;
        const baseZ = globalRow * vertDist;
        tempPosition.set(baseX, 0, baseZ);

        const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;
        const isQuest = this.questManager.questHexCoords.get(globalCol)?.has(globalRow) || false;
        const shouldHideTile = isStructure || isQuest;
        const isExplored = this.exploredTiles.get(globalCol)?.get(globalRow) || false;

        this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });

        if (shouldHideTile) {
          return;
        }

        tempMatrix.makeScale(HEX_SIZE, HEX_SIZE, HEX_SIZE);

        const rotationSeed = this.hashCoordinates(globalCol, globalRow);
        const rotationIndex = Math.floor(rotationSeed * 6);
        const randomRotation = (rotationIndex * Math.PI) / 3;

        if (!IS_FLAT_MODE) {
          tempPosition.y += 0.05;
          rotationMatrix.makeRotationY(randomRotation);
          tempMatrix.multiply(rotationMatrix);
        } else {
          tempPosition.y += 0.05;
        }

        if (isExplored) {
          const biome = isExplored as BiomeType;
          const biomeVariant = getBiomeVariant(biome, globalCol, globalRow);
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes[biomeVariant].push(pooledMatrix);
        } else {
          tempPosition.y = 0.01;
          tempMatrix.setPosition(tempPosition);

          const pooledMatrix = matrixPool.getMatrix();
          pooledMatrix.copy(tempMatrix);
          biomeHexes.Outline.push(pooledMatrix);
        }
      };

      const processFrame = () => {
        if (this.currentHexGridTask !== taskToken) {
          abortTask();
          return;
        }

        const frameStart = performance.now();
        let processedThisFrame = 0;

        while (currentIndex < totalHexes) {
          processCell(currentIndex);
          currentIndex += 1;
          processedThisFrame += 1;

          if (currentIndex >= totalHexes) {
            break;
          }

          if (processedThisFrame >= minBatch) {
            const elapsed = performance.now() - frameStart;
            if (elapsed >= frameBudget || processedThisFrame >= maxBatch) {
              break;
            }
          }
        }

        if (currentIndex < totalHexes) {
          this.hexGridFrameHandle = requestAnimationFrame(processFrame);
        } else {
          finalizeSuccess();
        }
      };

      this.hexGridFrameHandle = requestAnimationFrame(processFrame);
    });

    await this.updateHexagonGridPromise;
    this.updateHexagonGridPromise = null;
  }

  private async computeTileEntities(chunkKey: string): Promise<void> {
    // Skip if we've already fetched this chunk
    if (this.fetchedChunks.has(chunkKey)) {
      return;
    }

    // If there's already a pending request for this chunk, return the existing promise
    const existingPromise = this.pendingChunks.get(chunkKey);
    if (existingPromise) {
      return existingPromise;
    }

    // Parse chunk coordinates
    const chunkRow = parseInt(chunkKey.split(",")[0]);
    const chunkCol = parseInt(chunkKey.split(",")[1]);

    // Calculate exact chunk boundaries
    const minCol = chunkCol;
    const maxCol = chunkCol + this.chunkSize - 1;
    const minRow = chunkRow;
    const maxRow = chunkRow + this.chunkSize - 1;

    console.log(
      "[CHUNK KEY]",
      chunkKey,
      `cols: ${minCol}-${maxCol}`,
      `rows: ${minRow}-${maxRow}`,
      "fetched chunks",
      this.fetchedChunks,
    );

    // Create the promise and add it to pending chunks immediately
    const fetchPromise = this.executeTileEntitiesFetch(chunkKey, minCol, maxCol, minRow, maxRow);
    this.pendingChunks.set(chunkKey, fetchPromise);

    return fetchPromise;
  }

  private async executeTileEntitiesFetch(
    chunkKey: string,
    minCol: number,
    maxCol: number,
    minRow: number,
    maxRow: number,
  ): Promise<void> {
    const start = performance.now();
    try {
      this.state.setLoading(LoadingStateKey.Map, true);
      await getMapFromToriiExact(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as any,
        minCol + FELT_CENTER,
        maxCol + FELT_CENTER,
        minRow + FELT_CENTER,
        maxRow + FELT_CENTER,
      );
      // Only add to fetched chunks on success
      this.fetchedChunks.add(chunkKey);
    } catch (error) {
      console.error("Error fetching tile entities:", error);
      // Don't add to fetchedChunks on error so it can be retried
    } finally {
      // Always remove from pending chunks
      this.pendingChunks.delete(chunkKey);
      this.state.setLoading(LoadingStateKey.Map, false);
      //const end = performance.now();
    }
  }

  private touchMatrixCache(chunkKey: string) {
    const existingIndex = this.cachedMatrixOrder.indexOf(chunkKey);
    if (existingIndex !== -1) {
      this.cachedMatrixOrder.splice(existingIndex, 1);
    }
    this.cachedMatrixOrder.push(chunkKey);
  }

  private disposeCachedMatrices(chunkKey: string) {
    const cached = this.cachedMatrices.get(chunkKey);
    if (!cached) return;

    cached.forEach(({ matrices }) => {
      if (matrices) {
        this.releaseInstancedAttribute(matrices);
      }
    });
  }

  private releaseInstancedAttribute(attribute: InstancedBufferAttribute) {
    InstancedMatrixAttributePool.getInstance().release(attribute);
  }

  private ensureMatrixCacheLimit() {
    while (this.cachedMatrixOrder.length > this.maxMatrixCacheSize) {
      const oldestKey = this.cachedMatrixOrder.shift();
      if (!oldestKey) {
        break;
      }
      this.disposeCachedMatrices(oldestKey);
      this.cachedMatrices.delete(oldestKey);
    }
  }

  private cacheMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    if (!this.cachedMatrices.has(chunkKey)) {
      this.cachedMatrices.set(chunkKey, new Map());
    }

    const cachedChunk = this.cachedMatrices.get(chunkKey)!;

    for (const [biome, model] of this.biomeModels) {
      const existing = cachedChunk.get(biome);
      if (existing) {
        if (existing.matrices) {
          this.releaseInstancedAttribute(existing.matrices);
        }
      }
      const { matrices, count } = model.getMatricesAndCount();
      if (count === 0) {
        this.releaseInstancedAttribute(matrices);
        cachedChunk.set(biome, { matrices: null, count });
        continue;
      }
      cachedChunk.set(biome, { matrices, count });
    }

    this.touchMatrixCache(chunkKey);
    this.ensureMatrixCacheLimit();
  }

  removeCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    this.disposeCachedMatrices(chunkKey);
    this.cachedMatrices.delete(chunkKey);
    const index = this.cachedMatrixOrder.indexOf(chunkKey);
    if (index !== -1) {
      this.cachedMatrixOrder.splice(index, 1);
    }
  }

  private applyCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (cachedMatrices) {
      this.touchMatrixCache(chunkKey);
      for (const [biome, { matrices, count }] of cachedMatrices) {
        const hexMesh = this.biomeModels.get(biome as any)!;
        if (matrices) {
          hexMesh.setMatricesAndCount(matrices, count);
        } else {
          hexMesh.setCount(count);
        }
      }
      this.ensureMatrixCacheLimit();
      return true;
    }
    return false;
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  private getChunkCenter(startRow: number, startCol: number): { row: number; col: number } {
    const halfChunk = this.chunkSize / 2;
    return {
      row: Math.round(startRow + halfChunk),
      col: Math.round(startCol + halfChunk),
    };
  }

  async updateVisibleChunks(force: boolean = false) {
    // Wait for any ongoing global chunk switch to complete first
    if (this.globalChunkSwitchPromise) {
      try {
        await this.globalChunkSwitchPromise;
      } catch (error) {
        console.warn(`Previous global chunk switch failed:`, error);
      }
    }

    const cameraPosition = dummyVector;
    cameraPosition.copy(this.controls.target);
    // Adjust the camera position to load chunks earlier in both directions
    const adjustedX = cameraPosition.x + (this.chunkSize * HEX_SIZE * Math.sqrt(3)) / 2;
    const adjustedZ = cameraPosition.z + (this.chunkSize * HEX_SIZE * 1.5) / 3;

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(adjustedX, adjustedZ);
    const startCol = chunkX * this.chunkSize;
    const startRow = chunkZ * this.chunkSize;
    const chunkKey = `${startRow},${startCol}`;

    if (this.currentChunk !== chunkKey || force) {
      // Create and track the global chunk switch promise
      this.globalChunkSwitchPromise = this.performChunkSwitch(chunkKey, startCol, startRow, force);

      try {
        await this.globalChunkSwitchPromise;
      } finally {
        this.globalChunkSwitchPromise = null;
      }
    }
  }

  private async performChunkSwitch(chunkKey: string, startCol: number, startRow: number, force: boolean) {
    // Track memory usage during chunk switch
    const memoryMonitor = (window as any).__gameRenderer?.memoryMonitor;
    const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-switch-pre-${chunkKey}`);

    // Clear any existing selections to prevent interaction during switch
    this.clearEntitySelection();

    this.currentChunk = chunkKey;

    if (!force) {
      this.removeCachedMatricesForChunk(startRow, startCol);
    }

    // Load surrounding chunks for better UX (3x3 grid)
    const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);

    // Start loading all surrounding chunks (they will deduplicate automatically)
    surroundingChunks.forEach((chunk) => this.computeTileEntities(chunk));

    // Calculate the starting position for the new chunk
    await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

    // Update which interactive hexes are visible in the new chunk
    const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
    this.interactiveHexManager.updateVisibleHexes(
      chunkCenterRow,
      chunkCenterCol,
      this.renderChunkSize.width,
      this.renderChunkSize.height,
    );

    // Update all managers in sequence to prevent race conditions
    // Changed from Promise.all to sequential execution
    await this.armyManager.updateChunk(chunkKey);
    await this.structureManager.updateChunk(chunkKey);
    await this.questManager.updateChunk(chunkKey);
    await this.chestManager.updateChunk(chunkKey);

    // Track memory usage after chunk switch
    if (memoryMonitor) {
      const postChunkStats = memoryMonitor.getCurrentStats(`chunk-switch-post-${chunkKey}`);
      if (preChunkStats && postChunkStats) {
        const memoryDelta = postChunkStats.heapUsedMB - preChunkStats.heapUsedMB;
        console.log(
          `[CHUNK SYNC] Chunk switch memory impact: ${memoryDelta > 0 ? "+" : ""}${memoryDelta.toFixed(1)}MB`,
        );

        if (Math.abs(memoryDelta) > 20) {
          console.warn(`[CHUNK SYNC] Large memory change during chunk switch: ${memoryDelta.toFixed(1)}MB`);
        }
      }
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime);
    this.chestManager.update(deltaTime);
    this.minimap.update();
  }

  public clearTileEntityCache() {
    this.fetchedChunks.clear();
    this.pendingChunks.clear();
    this.clearCache();
    this.armyLastUpdateAt.clear();
    // Also clear the interactive hexes when clearing the entire cache
    this.interactiveHexManager.clearHexes();
  }

  /**
   * Handle relic effect updates from the game system
   * @param update The relic effect update containing entity ID and array of relic effects
   * @param relicSource Optional source of the relic effects (for structures)
   */
  private async handleRelicEffectUpdate(update: RelicEffectSystemUpdate, relicSource?: RelicSource) {
    const { entityId, relicEffects } = update;

    let entityFound = false;

    // Check if this is an army entity
    if (this.armyManager.hasArmy(entityId)) {
      // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
      const { currentArmiesTick } = getBlockTimestamp();
      const newEffects = relicEffects.map((relicEffect) => ({
        relicNumber: relicEffect.id,
        effect: {
          start_tick: currentArmiesTick,
          end_tick: relicEffect.endTick,
          usage_left: 1,
        },
      }));

      await this.armyManager.updateRelicEffects(entityId, newEffects);
      entityFound = true;
    }

    // Check if this is a structure entity
    if (!entityFound && relicSource) {
      const structureHexes = this.structureManager.structures.getStructures();
      for (const [, structures] of structureHexes) {
        if (structures.has(entityId)) {
          // Convert RelicEffectWithEndTick to the format expected by updateRelicEffects
          const { currentArmiesTick } = getBlockTimestamp();
          const newEffects = relicEffects.map((relicEffect) => ({
            relicNumber: relicEffect.id,
            effect: {
              start_tick: currentArmiesTick,
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          }));

          await this.structureManager.updateRelicEffects(entityId, newEffects, relicSource);
          entityFound = true;
          break;
        }
      }
    }

    // If entity is not currently loaded, store as pending effects
    if (!entityFound) {
      // Get or create the entity's pending effects map
      let entityPendingMap = this.pendingRelicEffects.get(entityId);
      if (!entityPendingMap) {
        entityPendingMap = new Map();
        this.pendingRelicEffects.set(entityId, entityPendingMap);
      }

      // Determine the source for pending effects
      const pendingSource = relicSource || RelicSource.Guard;

      // Clear existing pending effects for this entity/source and add new ones
      if (relicEffects.length > 0) {
        const pendingRelicsSet = new Set<{ relicResourceId: number; effect: RelicEffect }>();
        for (const relicEffect of relicEffects) {
          pendingRelicsSet.add({
            relicResourceId: relicEffect.id,
            effect: {
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          });
        }
        entityPendingMap.set(pendingSource, pendingRelicsSet);
      } else {
        entityPendingMap.delete(pendingSource);
        // If no sources have pending effects, remove the entity
        if (entityPendingMap.size === 0) {
          this.pendingRelicEffects.delete(entityId);
        }
      }
    } else {
      // Update pending effects store even for loaded entities to keep it in sync
      // Get or create the entity's pending effects map
      let entityPendingMap = this.pendingRelicEffects.get(entityId);
      if (!entityPendingMap) {
        entityPendingMap = new Map();
        this.pendingRelicEffects.set(entityId, entityPendingMap);
      }

      const pendingSource = relicSource || RelicSource.Guard;

      if (relicEffects.length > 0) {
        const pendingRelicsSet = new Set<{ relicResourceId: number; effect: RelicEffect }>();
        for (const relicEffect of relicEffects) {
          pendingRelicsSet.add({
            relicResourceId: relicEffect.id,
            effect: {
              end_tick: relicEffect.endTick,
              usage_left: 1,
            },
          });
        }
        entityPendingMap.set(pendingSource, pendingRelicsSet);
      } else {
        entityPendingMap.delete(pendingSource);
        // If no sources have pending effects, remove the entity
        if (entityPendingMap.size === 0) {
          this.pendingRelicEffects.delete(entityId);
        }
      }
    }
  }

  /**
   * Apply all pending relic effects for an entity (called when entity is loaded)
   */
  private async applyPendingRelicEffects(entityId: ID) {
    const entityPendingMap = this.pendingRelicEffects.get(entityId);
    if (!entityPendingMap || entityPendingMap.size === 0) return;

    // Check if this is an army entity
    if (this.armyManager.hasArmy(entityId)) {
      try {
        // For armies, combine all pending effects (they don't have sources)
        const allPendingRelics: { relicResourceId: number; effect: RelicEffect }[] = [];
        for (const pendingRelics of entityPendingMap.values()) {
          allPendingRelics.push(...Array.from(pendingRelics));
        }

        // Convert pending relics to array format for updateRelicEffects
        const relicEffectsArray = allPendingRelics.map((pendingRelic) => ({
          relicNumber: pendingRelic.relicResourceId,
          effect: pendingRelic.effect,
        }));

        await this.armyManager.updateRelicEffects(entityId, relicEffectsArray);
      } catch (error) {
        console.error(`Failed to apply pending relic effects to army ${entityId}:`, error);
      }
      return;
    }

    // Check if this is a structure entity
    const structureHexes = this.structureManager.structures.getStructures();
    for (const [, structures] of structureHexes) {
      if (structures.has(entityId)) {
        try {
          // For structures, apply effects per source
          for (const [relicSource, pendingRelics] of entityPendingMap) {
            // Convert pending relics to array format for updateRelicEffects
            const relicEffectsArray = Array.from(pendingRelics).map((pendingRelic) => ({
              relicNumber: pendingRelic.relicResourceId,
              effect: pendingRelic.effect,
            }));

            await this.structureManager.updateRelicEffects(entityId, relicEffectsArray, relicSource);
            console.log(
              `Applied ${relicEffectsArray.length} pending relic effects to structure: entityId=${entityId}, source=${relicSource}`,
            );
          }
        } catch (error) {
          console.error(`Failed to apply pending relic effects to structure ${entityId}:`, error);
        }
        return;
      }
    }
  }

  /**
   * Clear all pending relic effects for an entity (called when entity is removed)
   */
  private clearPendingRelicEffects(entityId: ID) {
    const entityPendingMap = this.pendingRelicEffects.get(entityId);
    if (entityPendingMap) {
      let totalEffects = 0;
      for (const pendingRelics of entityPendingMap.values()) {
        totalEffects += pendingRelics.size;
      }
      console.log(
        `Cleared ${totalEffects} pending relic effects for entity ${entityId} from ${entityPendingMap.size} sources`,
      );
      this.pendingRelicEffects.delete(entityId);
    }
  }

  destroy() {
    if (this.hexGridFrameHandle !== null) {
      cancelAnimationFrame(this.hexGridFrameHandle);
      this.hexGridFrameHandle = null;
    }
    this.currentHexGridTask = null;

    this.disposeStoreSubscriptions();
    this.disposeStateSyncSubscription();

    this.resourceFXManager.destroy();
    this.stopRelicValidationTimer();
    this.clearCache();

    // Clean up hover label manager
    // this.hoverLabelManager.dispose();

    // Clean up selection pulse manager
    this.selectionPulseManager.dispose();

    // Clean up input manager
    this.inputManager.destroy();

    // Clean up shortcuts when scene is actually destroyed
    if (this.shortcutManager instanceof SceneShortcutManager) {
      this.shortcutManager.cleanup();
    }
  }

  /**
   * Display a resource gain/loss effect at a hex position
   * @param resourceId The resource ID from ResourcesIds
   * @param amount Amount of resource (positive for gain, negative for loss)
   * @param col Hex column
   * @param row Hex row
   * @param text Optional text to display below the resource
   */
  public displayResourceGain(
    resourceId: number,
    amount: number,
    col: number,
    row: number,
    text?: string,
  ): Promise<void> {
    return this.resourceFXManager.playResourceFx(resourceId, amount, col, row, text, { duration: 3.0 });
  }

  /**
   * Display multiple resource changes in sequence
   * @param resources Array of resource changes to display
   * @param col Hex column
   * @param row Hex row
   */
  public displayMultipleResources(
    resources: Array<{ resourceId: number; amount: number; text?: string }>,
    col: number,
    row: number,
  ): Promise<void> {
    return this.resourceFXManager.playMultipleResourceFx(resources, col, row);
  }

  /**
   * Start the periodic relic effect validation timer
   */
  private startRelicValidationTimer() {
    // Clear any existing timer
    this.stopRelicValidationTimer();

    // Set up new timer to run every 5 seconds
    this.relicValidationInterval = setInterval(() => {
      this.validateActiveRelicEffects();
    }, 5000);
  }

  /**
   * Stop the periodic relic effect validation timer
   */
  private stopRelicValidationTimer() {
    if (this.relicValidationInterval) {
      clearInterval(this.relicValidationInterval);
      this.relicValidationInterval = null;
    }
  }

  /**
   * Validate all currently displayed relic effects and remove inactive ones
   */
  private async validateActiveRelicEffects() {
    try {
      const { currentArmiesTick } = getBlockTimestamp();
      let removedCount = 0;

      // Validate army relic effects
      const armies = this.armyManager.getArmies();
      for (const army of armies) {
        const currentRelics = this.armyManager.getArmyRelicEffects(army.entityId);
        if (currentRelics.length > 0) {
          // Filter out inactive relics
          const activeRelics = currentRelics.filter((relic) => isRelicActive(relic.effect, currentArmiesTick));

          // If some relics were removed, update the effects
          if (activeRelics.length < currentRelics.length) {
            const removedThisArmy = currentRelics.length - activeRelics.length;

            await this.armyManager.updateRelicEffects(
              army.entityId,
              activeRelics.map((r) => ({ relicNumber: r.relicId, effect: r.effect })),
            );
            removedCount += removedThisArmy;
          }
        }
      }

      // Validate structure relic effects
      const structureHexes = this.structureManager.structures.getStructures();
      for (const [, structures] of structureHexes) {
        for (const [entityId] of structures) {
          const currentRelics = this.structureManager.getStructureRelicEffects(entityId);
          if (currentRelics.length > 0) {
            // Filter out inactive relics
            const activeRelics = currentRelics.filter((relic) => isRelicActive(relic.effect, currentArmiesTick));

            // If some relics were removed, update the effects
            if (activeRelics.length < currentRelics.length) {
              const removedThisStructure = currentRelics.length - activeRelics.length;
              console.log(
                `Removing ${removedThisStructure} inactive relic effect(s) from structure: entityId=${entityId}`,
              );
              // For validation, we need to update each source separately
              // Get effects by source and update them
              for (const source of [RelicSource.Guard, RelicSource.Production]) {
                const sourceRelics = this.structureManager.getStructureRelicEffectsBySource(entityId, source);
                if (sourceRelics.length > 0) {
                  const activeSourceRelics = sourceRelics.filter((relic) =>
                    isRelicActive(relic.effect, currentArmiesTick),
                  );
                  if (activeSourceRelics.length < sourceRelics.length) {
                    await this.structureManager.updateRelicEffects(
                      entityId,
                      activeSourceRelics.map((r) => ({ relicNumber: r.relicId, effect: r.effect })),
                      source,
                    );
                  }
                }
              }
              removedCount += removedThisStructure;
            }
          }
        }
      }

      if (removedCount > 0) {
      }
    } catch (error) {
      console.error("Error during relic effect validation:", error);
    }
  }

  private async selectNextArmy(): Promise<void> {
    if (this.selectableArmies.length === 0) return;
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    // Find the next army that doesn't have a pending movement transaction
    let attempts = 0;
    while (attempts < this.selectableArmies.length) {
      this.armyIndex = (this.armyIndex + 1) % this.selectableArmies.length;
      const army = this.selectableArmies[this.armyIndex];

      // Skip armies with pending movement transactions
      if (!this.pendingArmyMovements.has(army.entityId)) {
        const normalizedPosition = new Position({ x: army.position.col, y: army.position.row }).getNormalized();
        // Use 0 duration for instant camera teleportation
        this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);

        try {
          await this.updateVisibleChunks();
        } catch (error) {
          console.error(
            `[WorldMap] Failed to update visible chunks while cycling armies (entityId=${army.entityId}):`,
            error,
          );
        }

        // army.position is already in contract coordinates, pass it directly
        // handleHexSelection will normalize it internally when calling getHexagonEntity
        this.handleHexSelection(army.position, true);
        this.onArmySelection(army.entityId, account);
        this.state.setLeftNavigationView(LeftView.EntityView);
        break;
      }
      attempts++;
    }
    // If all armies have pending movements, do nothing
  }

  private updateSelectableArmies(armies: SelectableArmy[]) {
    this.selectableArmies = armies;
    if (this.armyIndex >= armies.length) {
      this.armyIndex = 0;
    }
  }

  private registerStoreSubscriptions() {
    if (this.storeSubscriptions.length > 0) {
      return;
    }

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.selectableArmies,
        (selectableArmies) => {
          this.updateSelectableArmies(selectableArmies);
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.playerStructures,
        (playerStructures) => {
          this.updatePlayerStructures(playerStructures);
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.entityActions,
        (armyActions) => {
          this.state.entityActions = armyActions;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.selectedHex,
        (selectedHex) => {
          this.state.selectedHex = selectedHex;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.isSoundOn,
        (isSoundOn) => {
          this.state.isSoundOn = isSoundOn;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.effectsLevel,
        (effectsLevel) => {
          this.state.effectsLevel = effectsLevel;
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.enableMapZoom,
        (enableMapZoom) => {
          if (this.controls) {
            this.controls.enableZoom = enableMapZoom;
          }
        },
      ),
    );

    this.storeSubscriptions.push(
      useUIStore.subscribe(
        (state) => state.entityActions.selectedEntityId,
        (selectedEntityId) => {
          if (!selectedEntityId) this.clearEntitySelection();
        },
      ),
    );

    this.syncStateFromStore();
  }

  private disposeStoreSubscriptions() {
    if (this.storeSubscriptions.length === 0) {
      return;
    }

    this.storeSubscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("[WorldMap] Failed to unsubscribe store listener", error);
      }
    });
    this.storeSubscriptions = [];
  }

  private syncStateFromStore() {
    const uiState = useUIStore.getState();

    this.updateSelectableArmies(uiState.selectableArmies);
    this.updatePlayerStructures(uiState.playerStructures);

    this.state.entityActions = uiState.entityActions;
    this.state.selectedHex = uiState.selectedHex;
    this.state.isSoundOn = uiState.isSoundOn;
    this.state.effectsLevel = uiState.effectsLevel;

    if (this.controls) {
      this.controls.enableZoom = uiState.enableMapZoom;
    }

    const selectedEntityId = uiState.entityActions.selectedEntityId;
    if (!selectedEntityId) {
      this.clearEntitySelection();
    } else {
      this.state.updateEntityActionSelectedEntityId(selectedEntityId);
    }
  }

  private updatePlayerStructures(structures: Structure[]) {
    this.playerStructures = structures;
    if (this.structureIndex >= structures.length) {
      this.structureIndex = 0;
    }
  }

  private selectNextStructure() {
    this.structureIndex = utilSelectNextStructure(this.playerStructures, this.structureIndex, "map");
    if (this.playerStructures.length > 0) {
      const structure = this.playerStructures[this.structureIndex];
      // structure.position is in contract coordinates, pass it directly
      // handleHexSelection will normalize it internally when calling getHexagonEntity
      this.handleHexSelection({ col: structure.position.x, row: structure.position.y }, true);
      this.onStructureSelection(structure.entityId, { col: structure.position.x, row: structure.position.y });
      // Set the structure entity ID in the UI store
      const worldMapPosition = { col: Number(structure.position.x), row: Number(structure.position.y) };
      this.state.setStructureEntityId(structure.entityId, {
        worldMapPosition,
        spectator: this.state.isSpectating,
      });
      const normalizedPosition = new Position({ x: structure.position.x, y: structure.position.y }).getNormalized();
      // Use 0 duration for instant camera teleportation
      this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);
    }
  }

  protected shouldEnableStormEffects(): boolean {
    // Disable storm effects for worldmap scene
    return true;
  }

  /**
   * Add a new combat relationship
   */
  private addCombatRelationship(attackerId: ID, defenderId: ID) {
    this.battleDirectionManager.addCombatRelationship(attackerId, defenderId);
    console.log(`[ATTACKER-DEFENDER] Added relationship: ${attackerId} attacked ${defenderId}`);
  }

  /**
   * Recalculate arrow directions for a specific entity
   */
  private recalculateArrowsForEntity(entityId: ID) {
    console.log(`[RECALCULATE ARROWS FOR ENTITY] Recalculating arrows for entity ${entityId}`);
    this.battleDirectionManager.recalculateArrowsForEntity(entityId);
  }

  /**
   * Recalculate arrows for all entities that have relationships with the given entity
   */
  private recalculateArrowsForEntitiesRelatedTo(entityId: ID) {
    console.log(
      `[RECALCULATE ARROWS FOR ENTITIES RELATED TO] Recalculating arrows for entities related to ${entityId}`,
    );
    this.battleDirectionManager.recalculateArrowsForEntitiesRelatedTo(entityId);
  }

  /**
   * Remove entity from tracking when it's destroyed
   */
  private removeEntityFromTracking(entityId: ID) {
    // Remove from position tracking
    this.armiesPositions.delete(entityId);
    this.structuresPositions.delete(entityId);

    // Remove from battle direction relationships
    this.battleDirectionManager.removeEntityFromTracking(entityId);

    console.log(`[ATTACKER-DEFENDER] Removed entity ${entityId} from tracking`);
  }
}
