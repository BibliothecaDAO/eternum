import { AudioManager } from "@/audio/core/AudioManager";
import throttle from "lodash/throttle";

import { getMapFromToriiExact } from "@/dojo/queries";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { HEX_SIZE } from "@/three/constants";
import { ArmyManager } from "@/three/managers/army-manager";
import { ChestManager } from "@/three/managers/chest-manager";
import Minimap from "@/three/managers/minimap";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { SelectionPulseManager } from "@/three/managers/selection-pulse-manager";
import { RelicSource, StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playResourceSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { Position } from "@bibliothecadao/eternum";

import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { ChestModal, CombatModal, HelpModal } from "@/ui/features/military";
import { UnifiedArmyCreationModal } from "@/ui/features/military/components/unified-army-creation-modal";
import { QuestModal } from "@/ui/features/progression";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  ArmySystemUpdate,
  ChestSystemUpdate,
  ExplorerMoveSystemUpdate,
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
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  findResourceById,
  getDirectionBetweenAdjacentHexes,
  HexEntityInfo,
  HexPosition,
  ID,
  RelicEffect,
  Structure,
} from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";
import * as THREE from "three";
import { Raycaster } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { FXManager } from "../managers/fx-manager";
import { MemoryMonitor } from "../utils/memory-monitor";
import { HoverLabelManager } from "../managers/hover-label-manager";
import { QuestManager } from "../managers/quest-manager";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import { SceneName } from "../types/common";
import { getWorldPositionForHex, isAddressEqualToAccount } from "../utils";
import {
  navigateToStructure,
  toggleMapHexView,
  selectNextStructure as utilSelectNextStructure,
} from "../utils/navigation";
import { SceneShortcutManager } from "../utils/shortcuts";

const dummyObject = new THREE.Object3D();
const dummyVector = new THREE.Vector3();

export default class WorldmapScene extends HexagonScene {
  private chunkSize = 8; // Size of each chunk
  private wheelHandler: ((event: WheelEvent) => void) | null = null;
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
  private memoryMonitor: MemoryMonitor;
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
  private armiesPositions: Map<ID, HexPosition> = new Map();
  private selectedHexManager: SelectedHexManager;
  private selectionPulseManager: SelectionPulseManager;
  private minimap!: Minimap;
  private previouslyHoveredHex: HexPosition | null = null;
  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();
  private updateHexagonGridPromise: Promise<void> | null = null;
  private travelEffects: Map<string, () => void> = new Map();

  // Pending relic effects store - holds relic effects for entities that aren't loaded yet
  private pendingRelicEffects: Map<ID, Map<RelicSource, Set<{ relicResourceId: number; effect: RelicEffect }>>> =
    new Map();

  // Relic effect validation timer
  private relicValidationInterval: NodeJS.Timeout | null = null;

  // Global chunk switching coordination
  private globalChunkSwitchPromise: Promise<void> | null = null;

  // Label groups
  private armyLabelsGroup: THREE.Group;
  private structureLabelsGroup: THREE.Group;
  private questLabelsGroup: THREE.Group;
  private chestLabelsGroup: THREE.Group;

  dojo: SetupResult;

  private fetchedChunks: Set<string> = new Set();
  private pendingChunks: Map<string, Promise<void>> = new Map();

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
    mouse: THREE.Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.WorldMap, controls, dojoContext, mouse, raycaster, sceneManager);

    this.dojo = dojoContext;
    this.fxManager = new FXManager(this.scene, 1);
    this.resourceFXManager = new ResourceFXManager(this.scene, 1.2);

    // Initialize memory monitor for worldmap operations
    this.memoryMonitor = new MemoryMonitor({
      spikeThresholdMB: 30, // Higher threshold for world operations
      onMemorySpike: (spike) => {
        console.warn(`🗺️  WorldMap Memory Spike: +${spike.increaseMB.toFixed(1)}MB in ${spike.context}`);
      },
    });

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

    useUIStore.subscribe(
      (state) => state.selectableArmies,
      (selectableArmies) => {
        this.updateSelectableArmies(selectableArmies);
      },
    );

    useUIStore.subscribe(
      (state) => state.playerStructures,
      (playerStructures) => {
        this.updatePlayerStructures(playerStructures);
      },
    );

    useUIStore.subscribe(
      (state) => state.entityActions,
      (armyActions) => {
        this.state.entityActions = armyActions;
      },
    );
    useUIStore.subscribe(
      (state) => state.selectedHex,
      (selectedHex) => {
        this.state.selectedHex = selectedHex;
      },
    );
    useUIStore.subscribe(
      (state) => state.isSoundOn,
      (isSoundOn) => {
        this.state.isSoundOn = isSoundOn;
      },
    );
    useUIStore.subscribe(
      (state) => state.effectsLevel,
      (effectsLevel) => {
        this.state.effectsLevel = effectsLevel;
      },
    );

    // Subscribe to zoom setting changes
    useUIStore.subscribe(
      (state) => state.enableMapZoom,
      (enableMapZoom) => {
        if (this.controls) {
          this.controls.enableZoom = enableMapZoom;
        }
      },
    );

    useUIStore.subscribe(
      (state) => state.entityActions.selectedEntityId,
      (selectedEntityId) => {
        if (!selectedEntityId) this.clearEntitySelection();
      },
    );

    // Initialize label groups
    this.armyLabelsGroup = new THREE.Group();
    this.armyLabelsGroup.name = "ArmyLabelsGroup";
    this.structureLabelsGroup = new THREE.Group();
    this.structureLabelsGroup.name = "StructureLabelsGroup";
    this.questLabelsGroup = new THREE.Group();
    this.questLabelsGroup.name = "QuestLabelsGroup";
    this.chestLabelsGroup = new THREE.Group();
    this.chestLabelsGroup.name = "ChestLabelsGroup";

    this.armyManager = new ArmyManager(
      this.scene,
      this.renderChunkSize,
      this.armyLabelsGroup,
      this,
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
      (entityId: ID) => this.applyPendingRelicEffects(entityId),
      (entityId: ID) => this.clearPendingRelicEffects(entityId),
    );

    // Initialize the quest manager
    this.questManager = new QuestManager(this.scene, this.renderChunkSize, this.questLabelsGroup, this);

    // Initialize the chest manager
    this.chestManager = new ChestManager(this.scene, this.renderChunkSize, this.chestLabelsGroup, this);

    // Initialize the hover label manager
    this.hoverLabelManager = new HoverLabelManager(
      {
        army: this.armyLabelsGroup,
        structure: this.structureLabelsGroup,
        quest: this.questLabelsGroup,
        chest: this.chestLabelsGroup,
      },
      (hexCoords: HexPosition) => this.getHexagonEntity(hexCoords),
      this.currentCameraView,
    );

    // Subscribe hover label manager to camera view changes
    this.addCameraViewListener((view: CameraView) => {
      this.hoverLabelManager.updateCameraView(view);
    });

    // Store the unsubscribe function for Army updates
    this.worldUpdateListener.Army.onTileUpdate(async (update: ArmySystemUpdate) => {
      this.updateArmyHexes(update);

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
    });

    // Listen for troop count and stamina changes
    this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {
      this.updateArmyHexes(update);
      this.armyManager.updateArmyFromExplorerTroopsUpdate(update);
    });

    // Listen for dead army updates
    this.worldUpdateListener.Army.onDeadArmy((entityId) => {
      // If the army is marked as deleted, remove it from the map
      this.deleteArmy(entityId);
      this.updateVisibleChunks().catch((error) => console.error("Failed to update visible chunks:", error));
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

          if (followArmyMoves && currentScene === SceneName.WorldMap && armyPosition) {
            // Move camera to the reward location when follow is enabled
            this.moveCameraToColRow(armyPosition.col, armyPosition.row, 2);

            // Set the following state to true temporarily
            useUIStore.getState().setIsFollowingArmy(true);

            // Clear the following state after camera movement
            setTimeout(() => {
              useUIStore.getState().setIsFollowingArmy(false);
            }, 3000); // Show for 3 seconds
          }
          if (resourceId === 0) {
            return;
          }
          const resource = findResourceById(resourceId);
          // Play the sound for the resource gain
          playResourceSound(resourceId, this.state.isSoundOn, this.state.effectsLevel);
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
        action: () => this.selectNextArmy(),
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
        description: "Toggle between map and hex view",
        sceneRestriction: SceneName.WorldMap,
        action: () => toggleMapHexView(),
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
    // Add mouse wheel handler
    this.wheelHandler = throttle(
      (event: WheelEvent) => {
        // Expand labels temporarily during scroll in Medium view
        this.expandLabelsTemporarily();

        if (event.deltaY > 0) {
          // Zoom out
          const newView = Math.min(CameraView.Far, this.currentCameraView + 1);
          this.changeCameraView(newView);
        } else {
          // Zoom in
          const newView = Math.max(CameraView.Close, this.currentCameraView - 1);
          this.changeCameraView(newView);
        }
      },
      1000,
      { leading: true, trailing: false },
    );

    // Get the main canvas by its ID
    const canvas = document.getElementById("main-canvas");
    if (canvas) {
      // Add a simple, non-throttled wheel handler to expand labels on every scroll
      canvas.addEventListener(
        "wheel",
        () => {
          this.expandLabelsTemporarily();
        },
        { passive: true },
      );

      // Add the throttled handler for camera view changes
      canvas.addEventListener("wheel", this.wheelHandler, { passive: true });
    }
  }

  public moveCameraToURLLocation() {
    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();
    if (col !== undefined && row !== undefined) {
      this.moveCameraToColRow(col, row, 0);
    }
  }

  // methods needed to add worldmap specific behavior to the click events
  protected onHexagonMouseMove(hex: { hexCoords: HexPosition; position: THREE.Vector3 } | null): void {
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

  // go into hex view if it's a structure you own
  protected onHexagonDoubleClick(hexCoords: HexPosition) {
    const { structure } = this.getHexagonEntity(hexCoords);
    if (structure && structure.owner === ContractAddress(useAccountStore.getState().account?.address || "")) {
      this.state.setStructureEntityId(structure.id);
      // remove this for now because not sure if best ux
      navigateToStructure(hexCoords.col, hexCoords.row, "hex");
    }
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

    const { army, structure, quest, chest } = this.getHexagonEntity(hexCoords);
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

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
    } else {
      this.state.setLeftNavigationView(LeftView.EntityView);
    }
  }

  protected onHexagonRightClick(hexCoords: HexPosition | null): void {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;

    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0 && hexCoords) {
      const actionPath = actionPaths.get(ActionPaths.posKey(hexCoords, true));
      if (actionPath && account) {
        const actionType = ActionPaths.getActionType(actionPath);

        // Only validate army availability for army-specific actions
        const armyActions = [ActionType.Explore, ActionType.Move, ActionType.Attack, ActionType.Help];
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
      this.memoryMonitor.getCurrentStats(`worldmap-moveArmy-start-${selectedEntityId}`);

      armyActionManager
        .moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick)
        .then(() => {
          // Transaction submitted successfully, cleanup visual effects
          cleanup();
          // Monitor memory usage after army movement completion
          this.memoryMonitor.getCurrentStats(`worldmap-moveArmy-complete-${selectedEntityId}`);
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

    // Find the army at the target position
    this.state.toggleModal(
      <CombatModal
        selected={{
          type: selected.army ? ActorType.Explorer : ActorType.Structure,
          id: selectedEntityId,
          hex: new Position({ x: selectedPath[0].col, y: selectedPath[0].row }).getContract(),
        }}
        target={{
          type: target.army ? ActorType.Explorer : ActorType.Structure,
          id: target.army?.id || target.structure?.id || 0,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        }}
      />,
    );
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
        new THREE.Color(1.0, 0.6, 0.2), // Orange base
        new THREE.Color(1.0, 0.9, 0.4)  // Gold pulse
      );
    }
  }

  private onArmySelection(selectedEntityId: ID, playerAddress: ContractAddress) {
    // Check if army has pending movement transactions
    if (this.pendingArmyMovements.has(selectedEntityId)) {
      return;
    }

    // Check if army is currently being rendered or is in chunk transition
    if (this.globalChunkSwitchPromise) {
      console.log("Chunk switch in progress, deferring army selection");
      // Defer selection until chunk switch completes
      this.globalChunkSwitchPromise.then(() => {
        // Retry selection after chunk switch
        if (this.armyManager.hasArmy(selectedEntityId)) {
          this.onArmySelection(selectedEntityId, playerAddress);
        }
      });
      return;
    }

    // Ensure army is available for selection
    if (!this.armyManager.hasArmy(selectedEntityId)) {
      console.warn(`Army ${selectedEntityId} not available in current chunk for selection`);
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
    this.state.updateEntityActionActionPaths(actionPaths.getPaths());
    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());
    
    // Show selection pulse for the selected army
    const armyPosition = this.armiesPositions.get(selectedEntityId);
    if (armyPosition) {
      const worldPos = getWorldPositionForHex(armyPosition);
      this.selectionPulseManager.showSelection(worldPos.x, worldPos.z, selectedEntityId);
      // Set army-specific pulse colors (blue/cyan for armies)
      this.selectionPulseManager.setPulseColor(
        new THREE.Color(0.2, 0.6, 1.0), // Blue base
        new THREE.Color(0.8, 1.0, 1.0)  // Cyan pulse
      );
    }
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
    console.log("clearSelection");
    this.selectedHexManager.resetPosition();
    this.state.setSelectedHex(null);
    this.clearEntitySelection();
  }

  private clearEntitySelection() {
    console.log("clearEntitySelection");
    this.highlightHexManager.highlightHexes([]);
    this.state.updateEntityActionActionPaths(new Map());
    this.state.updateEntityActionSelectedEntityId(null);
    this.selectionPulseManager.hideSelection(); // Hide selection pulse
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.chestManager.addLabelsToScene();
  }

  setup() {
    this.controls.maxDistance = 40;
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.mainDirectionalLight.castShadow = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = useUIStore.getState().enableMapZoom;
    this.controls.zoomToCursor = false;
    this.highlightHexManager.setYOffset(0.025);
    this.moveCameraToURLLocation();
    this.changeCameraView(2);
    this.minimap.moveMinimapCenterToUrlLocation();
    this.minimap.showMinimap();

    // Configure thunder bolts for worldmap - dramatic storm effect
    this.getThunderBoltManager().setConfig({
      radius: 18, // Large spread across the visible area
      count: 12, // Many thunder bolts for dramatic effect
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
    this.clearTileEntityCache();

    this.setupCameraZoomHandler();
  }

  onSwitchOff() {
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

    // Clean up wheel event listener
    if (this.wheelHandler) {
      const canvas = document.getElementById("main-canvas");
      if (canvas) {
        canvas.removeEventListener("wheel", this.wheelHandler);
      }
      this.wheelHandler = null;
    }

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  public deleteArmy(entityId: ID) {
    this.armyManager.removeArmy(entityId);
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.armiesPositions.delete(entityId);
    }
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
  public updateArmyHexes(update: { entityId: ID; hexCoords: HexPosition; ownerAddress?: bigint | undefined }) {
    const {
      hexCoords: { col, row },
      ownerAddress,
      entityId,
    } = update;

    if (ownerAddress === undefined) return;

    const normalized = new Position({ x: col, y: row }).getNormalized();
    const newPos = { col: normalized.x, row: normalized.y };
    const oldPos = this.armiesPositions.get(entityId);

    // Update army position
    this.armiesPositions.set(entityId, newPos);

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
    this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: ownerAddress });
    this.invalidateAllChunkCachesContainingHex(newPos.col, newPos.row);

    // Remove from pending movements when position is updated from blockchain
    this.pendingArmyMovements.delete(entityId);
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

    const dummy = new THREE.Object3D();
    const pos = getWorldPositionForHex({ row, col });

    dummy.position.copy(pos);

    const isStructure = this.structureManager.structureHexCoords.get(col)?.has(row) || false;
    const isQuest = this.questManager.questHexCoords.get(col)?.has(row) || false;

    if (isStructure || isQuest) {
      dummy.scale.set(0, 0, 0);
    } else {
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
    }

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


    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    this.invalidateAllChunkCachesContainingHex(col, row);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (this.isColRowInVisibleChunk(col, row)) {
      await this.updateHexagonGridPromise;
      // Add hex to all interactive hexes
      this.interactiveHexManager.addHex({ col, row });

      // Update which hexes are visible in the current chunk
      const chunkWidth = this.renderChunkSize.width;
      const chunkHeight = this.renderChunkSize.height;
      this.interactiveHexManager.updateVisibleHexes(
        renderedChunkCenterRow,
        renderedChunkCenterCol,
        chunkWidth,
        chunkHeight,
      );

      await Promise.all(this.modelLoadPromises);
      const hexMesh = this.biomeModels.get(biome as BiomeType)!;
      const currentCount = hexMesh.getCount();
      hexMesh.setMatrixAt(currentCount, dummy.matrix);
      hexMesh.setCount(currentCount + 1);
      hexMesh.needsUpdate();

      // Cache the updated matrices for the chunk
      this.cacheMatricesForChunk(renderedChunkCenterRow, renderedChunkCenterCol);
    }
  }

  isColRowInVisibleChunk(col: number, row: number) {
    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (
      col >= renderedChunkCenterCol - this.renderChunkSize.width / 2 &&
      col <= renderedChunkCenterCol + this.renderChunkSize.width / 2 &&
      row >= renderedChunkCenterRow - this.renderChunkSize.height / 2 &&
      row <= renderedChunkCenterRow + this.renderChunkSize.height / 2
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
    this.cachedMatrices.clear();
  }

  private computeInteractiveHexes(startRow: number, startCol: number, rows: number, cols: number) {
    // Instead of clearing and recomputing all hexes, just update which ones are visible
    this.interactiveHexManager.updateVisibleHexes(startRow, startCol, rows, cols);
  }

  async updateHexagonGrid(startRow: number, startCol: number, rows: number, cols: number) {
    const memoryMonitor = (window as any).__gameRenderer?.memoryMonitor;
    const preUpdateStats = memoryMonitor?.getCurrentStats(`hex-grid-update-${startRow}-${startCol}`);

    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      console.log("cache applied");
      this.computeInteractiveHexes(startRow, startCol, rows, cols);

      // Track memory usage for cached operation
      if (memoryMonitor && preUpdateStats) {
        const postStats = memoryMonitor.getCurrentStats(`hex-grid-cached-${startRow}-${startCol}`);
        const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
        if (Math.abs(memoryDelta) > 10) {
          console.log(`[HEX GRID] Cache application memory impact: ${memoryDelta.toFixed(1)}MB`);
        }
      }
      return;
    }

    this.updateHexagonGridPromise = new Promise((resolve) => {
      // Don't clear interactive hexes here, just update which ones are visible
      const biomeHexes: Record<BiomeType | "Outline", THREE.Matrix4[]> = {
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
        Taiga: [],
        Grassland: [],
        TemperateDeciduousForest: [],
        TemperateRainForest: [],
        SubtropicalDesert: [],
        TropicalSeasonalForest: [],
        TropicalRainForest: [],
        Outline: [],
      };

      const batchSize = 600; // Adjust batch size as needed
      let currentIndex = 0;

      this.computeTileEntities(this.currentChunk);

      const processBatch = async () => {
        const endIndex = Math.min(currentIndex + batchSize, rows * cols);

        for (let i = currentIndex; i < endIndex; i++) {
          const row = Math.floor(i / cols) - rows / 2;
          const col = (i % cols) - cols / 2;

          const globalRow = startRow + row;
          const globalCol = startCol + col;

          const pos = getWorldPositionForHex({ row: globalRow, col: globalCol });
          dummyObject.position.copy(pos);

          const isStructure = this.structureManager.structureHexCoords.get(globalCol)?.has(globalRow) || false;
          const isQuest = this.questManager.questHexCoords.get(globalCol)?.has(globalRow) || false;
          const isExplored = this.exploredTiles.get(globalCol)?.get(globalRow) || false;
          if (isStructure || isQuest) {
            dummyObject.scale.set(0, 0, 0);
          } else {
            dummyObject.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
          }

          // Make all hexes in the current chunk interactive regardless of exploration status
          this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });

          const rotationSeed = this.hashCoordinates(startCol + col, startRow + row);
          const rotationIndex = Math.floor(rotationSeed * 6);
          const randomRotation = (rotationIndex * Math.PI) / 3;
          if (!IS_FLAT_MODE) {
            dummyObject.position.y += 0.05;
            dummyObject.rotation.y = randomRotation;
          } else {
            dummyObject.position.y += 0.05;
            dummyObject.rotation.y = 0;
          }

          dummyObject.updateMatrix();

          if (isExplored) {
            const biome = isExplored as BiomeType;
            //const biome = Biome.getBiome(startCol + col + FELT_CENTER, startRow + row + FELT_CENTER);
            biomeHexes[biome].push(dummyObject.matrix.clone());
          } else {
            dummyObject.position.y = 0.01;
            dummyObject.updateMatrix();
            biomeHexes["Outline"].push(dummyObject.matrix.clone());
          }
        }

        currentIndex = endIndex;
        if (currentIndex < rows * cols) {
          requestAnimationFrame(processBatch);
        } else {
          for (const [biome, matrices] of Object.entries(biomeHexes)) {
            const hexMesh = this.biomeModels.get(biome as BiomeType)!;
            matrices.forEach((matrix, index) => {
              hexMesh.setMatrixAt(index, matrix);
            });
            hexMesh.setCount(matrices.length);
          }
          this.cacheMatricesForChunk(startRow, startCol);
          // After processing, just update visible hexes
          this.interactiveHexManager.updateVisibleHexes(startRow, startCol, rows, cols);

          // Track memory usage for full hex grid generation
          if (memoryMonitor && preUpdateStats) {
            const postStats = memoryMonitor.getCurrentStats(`hex-grid-generated-${startRow}-${startCol}`);
            const memoryDelta = postStats.heapUsedMB - preUpdateStats.heapUsedMB;
            console.log(
              `[HEX GRID] Full generation memory impact: ${memoryDelta.toFixed(1)}MB (${rows}x${cols} hexes)`,
            );

            if (memoryDelta > 50) {
              console.warn(`[HEX GRID] Large memory usage for hex generation: ${memoryDelta.toFixed(1)}MB`);
            }
          }

          resolve();
        }
      };

      Promise.all(this.modelLoadPromises).then(() => {
        requestAnimationFrame(processBatch);
      });
    });
  }

  private async computeTileEntities(chunkKey: string): Promise<void> {
    // Skip if we've already fetched this chunk
    if (this.fetchedChunks.has(chunkKey)) {
      console.log("Already fetched");
      return;
    }

    // If there's already a pending request for this chunk, return the existing promise
    const existingPromise = this.pendingChunks.get(chunkKey);
    if (existingPromise) {
      console.log("Request already pending for chunk", chunkKey);
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
      const end = performance.now();
      console.log("[sync] map query", end - start);
    }
  }

  private cacheMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    for (const [biome, model] of this.biomeModels) {
      const { matrices, count } = model.getMatricesAndCount();
      if (!this.cachedMatrices.has(chunkKey)) {
        this.cachedMatrices.set(chunkKey, new Map());
      }
      this.cachedMatrices.get(chunkKey)!.set(biome, { matrices: matrices as any, count });
    }
  }

  removeCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    this.cachedMatrices.delete(chunkKey);
  }

  private applyCachedMatricesForChunk(startRow: number, startCol: number) {
    const chunkKey = `${startRow},${startCol}`;
    const cachedMatrices = this.cachedMatrices.get(chunkKey);
    if (cachedMatrices) {
      for (const [biome, { matrices, count }] of cachedMatrices) {
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        hexMesh.setMatricesAndCount(matrices, count);
      }
      return true;
    }
    return false;
  }

  private worldToChunkCoordinates(x: number, z: number): { chunkX: number; chunkZ: number } {
    const chunkX = Math.floor(x / (this.chunkSize * HEX_SIZE * Math.sqrt(3)));
    const chunkZ = Math.floor(z / (this.chunkSize * HEX_SIZE * 1.5));
    return { chunkX, chunkZ };
  }

  async updateVisibleChunks(force: boolean = false) {
    // Wait for any ongoing global chunk switch to complete first
    if (this.globalChunkSwitchPromise) {
      console.log(`[GLOBAL CHUNK SYNC] Waiting for previous global chunk switch to complete`);
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
        console.log(`[GLOBAL CHUNK SYNC] Global chunk switch to ${chunkKey} completed`);
      } finally {
        this.globalChunkSwitchPromise = null;
      }
    }
  }

  private async performChunkSwitch(chunkKey: string, startCol: number, startRow: number, force: boolean) {
    console.log(`[CHUNK SYNC] Starting synchronized chunk switch to ${chunkKey}`);

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
    console.log("Loading chunks:", surroundingChunks);

    // Start loading all surrounding chunks (they will deduplicate automatically)
    surroundingChunks.forEach((chunk) => this.computeTileEntities(chunk));

    // Calculate the starting position for the new chunk
    await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

    // Update which interactive hexes are visible in the new chunk
    this.interactiveHexManager.updateVisibleHexes(
      startRow,
      startCol,
      this.renderChunkSize.width,
      this.renderChunkSize.height,
    );

    console.log("performChunkSwitch", chunkKey);
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

    console.log(`[CHUNK SYNC] All managers synchronized to chunk ${chunkKey}`);
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
      console.log(`Relic effect update for Army entityId: ${entityId}, effects count: ${relicEffects.length}`);
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
          console.log(
            `Relic effect update for Structure entityId: ${entityId}, source: ${relicSource}, effects count: ${relicEffects.length}`,
          );
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
      console.log(
        `Entity ${entityId} not found in current scene. Storing ${relicEffects.length} relic effects as pending`,
      );

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

    console.log(`Applying pending relic effects for entity ${entityId} from ${entityPendingMap.size} sources`);

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
        console.log(`Applied ${relicEffectsArray.length} pending relic effects to army: entityId=${entityId}`);
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
    this.resourceFXManager.destroy();
    this.stopRelicValidationTimer();

    // Clean up hover label manager
    this.hoverLabelManager.destroy();

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
            console.log(`Removing ${removedThisArmy} inactive relic effect(s) from army: entityId=${army.entityId}`);
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
            console.log({ currentRelics, activeRelics, currentArmiesTick });

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
        console.log(`Removed ${removedCount} inactive relic effects during validation`);
      }
    } catch (error) {
      console.error("Error during relic effect validation:", error);
    }
  }

  private selectNextArmy() {
    if (this.selectableArmies.length === 0) return;
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    // Find the next army that doesn't have a pending movement transaction
    let attempts = 0;
    while (attempts < this.selectableArmies.length) {
      this.armyIndex = (this.armyIndex + 1) % this.selectableArmies.length;
      const army = this.selectableArmies[this.armyIndex];

      // Skip armies with pending movement transactions
      if (!this.pendingArmyMovements.has(army.entityId)) {
        // army.position is already in contract coordinates, pass it directly
        // handleHexSelection will normalize it internally when calling getHexagonEntity
        this.handleHexSelection(army.position, true);
        this.onArmySelection(army.entityId, account);
        const normalizedPosition = new Position({ x: army.position.col, y: army.position.row }).getNormalized();
        // Use 0 duration for instant camera teleportation
        this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);
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
      this.state.setStructureEntityId(structure.entityId);
      const normalizedPosition = new Position({ x: structure.position.x, y: structure.position.y }).getNormalized();
      // Use 0 duration for instant camera teleportation
      this.moveCameraToColRow(normalizedPosition.x, normalizedPosition.y, 0);
    }
  }

  protected shouldEnableStormEffects(): boolean {
    // Disable storm effects for worldmap scene
    return true;
  }
}
