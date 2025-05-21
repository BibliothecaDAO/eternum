import { soundSelector } from "@/hooks/helpers/use-ui-sound";
import throttle from "lodash/throttle";

import { getMapFromTorii } from "@/dojo/queries";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LoadingStateKey } from "@/hooks/store/use-world-loading";
import { ArmyManager } from "@/three/managers/army-manager";
import Minimap from "@/three/managers/minimap";
import { SelectedHexManager } from "@/three/managers/selected-hex-manager";
import { StructureManager } from "@/three/managers/structure-manager";
import { SceneManager } from "@/three/scene-manager";
import { HEX_SIZE } from "@/three/scenes/constants";
import { CameraView, HexagonScene } from "@/three/scenes/hexagon-scene";
import { playResourceSound, playSound } from "@/three/sound/utils";
import { LeftView } from "@/types";
import { Position } from "@/types/position";
import { FELT_CENTER, IS_FLAT_MODE } from "@/ui/config";
import { CombatModal } from "@/ui/modules/military/combat-modal";
import { HelpModal } from "@/ui/modules/military/help-modal";
import { QuestModal } from "@/ui/modules/quests/quest-modal";
import { getBlockTimestamp } from "@/utils/timestamp";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  ArmyActionManager,
  StructureActionManager,
} from "@bibliothecadao/eternum";
import {
  BiomeType,
  ContractAddress,
  DUMMY_HYPERSTRUCTURE_ENTITY_ID,
  findResourceById,
  getNeighborOffsets,
  HexEntityInfo,
  HexPosition,
  ID,
} from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";
import * as THREE from "three";
import { Raycaster } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { FXManager } from "../managers/fx-manager";
import { QuestManager } from "../managers/quest-manager";
import { ResourceFXManager } from "../managers/resource-fx-manager";
import {
  ArmySystemUpdate,
  ExplorerRewardSystemUpdate,
  QuestSystemUpdate,
  SceneName,
  StructureSystemUpdate,
  TileSystemUpdate,
} from "../types";
import { getWorldPositionForHex } from "../utils";

const dummyObject = new THREE.Object3D();
const dummyVector = new THREE.Vector3();

export default class WorldmapScene extends HexagonScene {
  private chunkSize = 10; // Size of each chunk
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
  private structureManager: StructureManager;
  private exploredTiles: Map<number, Map<number, BiomeType>> = new Map();
  // normalized positions and if they are allied or not
  private armyHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private structureHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // normalized positions and if they are allied or not
  private questHexes: Map<number, Map<number, HexEntityInfo>> = new Map();
  // store armies positions by ID, to remove previous positions when army moves
  private armiesPositions: Map<ID, HexPosition> = new Map();
  private selectedHexManager: SelectedHexManager;
  private minimap!: Minimap;
  private previouslyHoveredHex: HexPosition | null = null;
  private cachedMatrices: Map<string, Map<string, { matrices: THREE.InstancedBufferAttribute; count: number }>> =
    new Map();
  private updateHexagonGridPromise: Promise<void> | null = null;
  private travelEffects: Map<string, () => void> = new Map();

  // Label groups
  private armyLabelsGroup: THREE.Group;
  private structureLabelsGroup: THREE.Group;
  private questLabelsGroup: THREE.Group;

  dojo: SetupResult;

  private fetchedChunks: Set<string> = new Set();

  private fxManager: FXManager;
  private resourceFXManager: ResourceFXManager;
  private questManager: QuestManager;

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

    this.GUIFolder.add(this, "moveCameraToURLLocation");

    this.loadBiomeModels(this.renderChunkSize.width * this.renderChunkSize.height);

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

    this.armyManager = new ArmyManager(this.scene, this.renderChunkSize, this.armyLabelsGroup, this);
    this.structureManager = new StructureManager(this.scene, this.renderChunkSize, this.structureLabelsGroup, this);

    // Initialize the quest manager
    this.questManager = new QuestManager(this.scene, this.renderChunkSize, this.questLabelsGroup, this);

    // Store the unsubscribe function for Army updates
    this.systemManager.Army.onUpdate((update: ArmySystemUpdate) => {
      this.updateArmyHexes(update);
      this.armyManager.onUpdate(update, this.armyHexes, this.structureHexes, this.exploredTiles);
    });
    this.systemManager.Army.onDeadArmy((entityId) => {
      // If the army is marked as deleted, remove it from the map
      this.deleteArmy(entityId);
      this.updateVisibleChunks();
    });

    // Store the unsubscribe function for Tile updates
    this.systemManager.Tile.onUpdate((value) => this.updateExploredHex(value));

    // Store the unsubscribe function for Structure updates
    this.systemManager.Structure.onUpdate((value) => {
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
      this.structureManager.onUpdate(value);
      if (this.totalStructures !== this.structureManager.getTotalStructures()) {
        this.totalStructures = this.structureManager.getTotalStructures();
        this.clearCache();
        this.updateVisibleChunks(true);
      }
    });

    // Store the unsubscribe function for Structure contributions
    this.systemManager.Structure.onContribution((value) => {
      this.structureManager.structures.updateStructureStage(value.entityId, value.structureType, value.stage);
      this.structureManager.updateChunk(this.currentChunk);
    });

    // perform some updates for the quest manager
    this.systemManager.Quest.onUpdate((update: QuestSystemUpdate) => {
      this.updateQuestHexes(update);
      this.questManager.onUpdate(update);
    });

    this.systemManager.ExplorerReward.onUpdate((update: ExplorerRewardSystemUpdate) => {
      const { explorerId, resourceId, amount } = update;
      // Find the army position using explorerId
      setTimeout(() => {
        const armyPosition = this.armiesPositions.get(explorerId);
        if (armyPosition) {
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

    this.minimap = new Minimap(this, this.camera);

    // Add event listener for Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.sceneManager.getCurrentScene() === SceneName.WorldMap) {
        if (this.isNavigationViewOpen()) {
          this.closeNavigationViews();
        } else {
          this.clearSelection();
        }
      }
    });

    window.addEventListener("urlChanged", () => {
      this.clearSelection();
    });
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
      return;
    }
    const { hexCoords } = hex;
    this.state.setHoveredHex(hexCoords);
    const { selectedEntityId, actionPaths } = this.state.entityActions;
    if (selectedEntityId && actionPaths.size > 0) {
      if (this.previouslyHoveredHex?.col !== hexCoords.col || this.previouslyHoveredHex?.row !== hexCoords.row) {
        this.previouslyHoveredHex = hexCoords;
      }
      this.state.updateEntityActionHoveredHex(hexCoords);
    }
  }

  protected onHexagonDoubleClick(hexCoords: HexPosition) {}

  protected getHexagonEntity(hexCoords: HexPosition) {
    const hex = new Position({ x: hexCoords.col, y: hexCoords.row }).getNormalized();
    const army = this.armyHexes.get(hex.x)?.get(hex.y);
    const structure = this.structureHexes.get(hex.x)?.get(hex.y);
    return { army, structure };
  }

  // hexcoords is normalized
  protected onHexagonClick(hexCoords: HexPosition | null) {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (!hexCoords) return;

    const { army, structure } = this.getHexagonEntity(hexCoords);
    const account = ContractAddress(useAccountStore.getState().account?.address || "");

    const isMine = army?.owner === account || structure?.owner === account;
    this.handleHexSelection(hexCoords, isMine);

    if (army?.owner === account) {
      this.onArmySelection(army.id, account);
    } else if (structure?.owner === account) {
      this.onStructureSelection(structure.id);
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
        playSound(soundSelector.click, this.state.isSoundOn, this.state.effectsLevel);
        this.armyManager.removeLabelsFromScene();
        this.structureManager.removeLabelsFromScene();
        this.questManager.removeLabelsFromScene();
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
        if (actionType === ActionType.Explore || actionType === ActionType.Move) {
          this.onArmyMovement(account, actionPath, selectedEntityId);
        } else if (actionType === ActionType.Attack) {
          this.onArmyAttack(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Help) {
          this.onArmyHelp(actionPath, selectedEntityId);
        } else if (actionType === ActionType.Quest) {
          this.onQuestSelection(actionPath, selectedEntityId);
        }
      }
    }
  }

  private onArmyMovement(account: Account | AccountInterface, actionPath: ActionPath[], selectedEntityId: ID) {
    // can only move on explored hexes
    const isExplored = ActionPaths.getActionType(actionPath) === ActionType.Move;
    if (actionPath.length > 0) {
      const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);
      playSound(soundSelector.unitMarching1, this.state.isSoundOn, this.state.effectsLevel);

      // Get the target position for the effect
      const targetHex = actionPath[actionPath.length - 1].hex;
      const position = getWorldPositionForHex({ col: targetHex.col - FELT_CENTER, row: targetHex.row - FELT_CENTER });

      // Play effect based on action type: compass for exploring, travel for moving
      const key = `${targetHex.col},${targetHex.row}`;
      const effectType = isExplored ? "travel" : "compass";
      const effectLabel = isExplored ? "Traveling" : "Exploring";

      const { promise, end } = this.fxManager.playFxAtCoords(
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

      armyActionManager.moveArmy(account!, actionPath, isExplored, getBlockTimestamp().currentArmiesTick).catch((e) => {
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
          type: selected.army ? "explorer" : "structure",
          id: selectedEntityId,
          hex: new Position({ x: selectedPath[0].col, y: selectedPath[0].row }).getContract(),
        }}
        target={{
          type: target.army ? "explorer" : "structure",
          id: target.army?.id || target.structure?.id || 0,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        }}
      />,
    );
  }

  // actionPath is not normalized
  private onArmyHelp(actionPath: ActionPath[], selectedEntityId: ID) {
    const selectedPath = actionPath.map((path) => path.hex);
    const targetHex = selectedPath[selectedPath.length - 1];
    const selectedHex = selectedPath[0];
    const selected = this.getHexagonEntity(selectedHex);
    const target = this.getHexagonEntity(targetHex);

    this.state.toggleModal(
      <HelpModal
        selected={{
          type: selected.army ? "explorer" : "structure",
          id: selectedEntityId,
          hex: new Position({ x: selectedHex.col, y: selectedHex.row }).getContract(),
        }}
        target={{
          type: target.army ? "explorer" : "structure",
          id: target.army?.id || target.structure?.id || 0,
          hex: new Position({ x: targetHex.col, y: targetHex.row }).getContract(),
        }}
      />,
    );
  }

  private onStructureSelection(selectedEntityId: ID) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const structure = new StructureActionManager(this.dojo.components, selectedEntityId);

    const playerAddress = useAccountStore.getState().account?.address;

    if (!playerAddress) return;

    const actionPaths = structure.findActionPaths(this.armyHexes, this.exploredTiles, ContractAddress(playerAddress));

    this.state.updateEntityActionActionPaths(actionPaths.getPaths());

    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());
  }

  private onArmySelection(selectedEntityId: ID, playerAddress: ContractAddress) {
    this.state.updateEntityActionSelectedEntityId(selectedEntityId);

    const armyActionManager = new ArmyActionManager(this.dojo.components, this.dojo.systemCalls, selectedEntityId);

    const { currentDefaultTick, currentArmiesTick } = getBlockTimestamp();

    const actionPaths = armyActionManager.findActionPaths(
      this.structureHexes,
      this.armyHexes,
      this.exploredTiles,
      this.questHexes,
      currentDefaultTick,
      currentArmiesTick,
      playerAddress,
    );
    this.state.updateEntityActionActionPaths(actionPaths.getPaths());
    this.highlightHexManager.highlightHexes(actionPaths.getHighlightedHexes());
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
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
  }

  setup() {
    this.controls.maxDistance = 40;
    this.camera.far = 65;
    this.camera.updateProjectionMatrix();
    this.mainDirectionalLight.castShadow = false;
    this.controls.enablePan = true;
    this.controls.enableZoom = false;
    this.controls.zoomToCursor = false;
    this.highlightHexManager.setYOffset(0.025);
    this.moveCameraToURLLocation();
    this.changeCameraView(2);
    this.minimap.moveMinimapCenterToUrlLocation();
    this.minimap.showMinimap();

    // Close left navigation on world map load
    useUIStore.getState().setLeftNavigationView(LeftView.None);

    // Add label groups to scene
    this.scene.add(this.armyLabelsGroup);
    this.scene.add(this.structureLabelsGroup);
    this.scene.add(this.questLabelsGroup);

    // Update army and structure managers
    this.armyManager.addLabelsToScene();
    this.structureManager.showLabels();
    this.questManager.addLabelsToScene();
    this.clearTileEntityCache();

    this.setupCameraZoomHandler();
  }

  onSwitchOff() {
    // Remove label groups from scene
    this.scene.remove(this.armyLabelsGroup);
    this.scene.remove(this.structureLabelsGroup);
    this.scene.remove(this.questLabelsGroup);

    // Clean up labels
    this.minimap.hideMinimap();
    this.armyManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing army labels from scene");
    this.structureManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing structure labels from scene");
    this.questManager.removeLabelsFromScene();
    console.debug("[WorldMap] Removing quest labels from scene");

    // Clean up wheel event listener
    if (this.wheelHandler) {
      const canvas = document.getElementById("main-canvas");
      if (canvas) {
        canvas.removeEventListener("wheel", this.wheelHandler);
      }
      this.wheelHandler = null;
    }
  }

  public deleteArmy(entityId: ID) {
    this.armyManager.removeArmy(entityId);
    const oldPos = this.armiesPositions.get(entityId);
    if (oldPos) {
      this.armyHexes.get(oldPos.col)?.delete(oldPos.row);
      this.armiesPositions.delete(entityId);
    }
  }

  // used to track the position of the armies on the map
  public updateArmyHexes(update: ArmySystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

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
    }

    // Add to new position
    if (!this.armyHexes.has(newPos.col)) {
      this.armyHexes.set(newPos.col, new Map());
    }
    this.armyHexes.get(newPos.col)?.set(newPos.row, { id: entityId, owner: address });
  }

  public updateStructureHexes(update: StructureSystemUpdate) {
    const {
      hexCoords: { col, row },
      owner: { address },
      entityId,
    } = update;

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
      this.updateVisibleChunks();
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

    const { chunkX, chunkZ } = this.worldToChunkCoordinates(pos.x, pos.z);
    const hexChunkCol = chunkX * this.chunkSize;
    const hexChunkRow = chunkZ * this.chunkSize;

    const renderedChunkCenterRow = parseInt(this.currentChunk.split(",")[0]);
    const renderedChunkCenterCol = parseInt(this.currentChunk.split(",")[1]);

    // if the hex is within the chunk, add it to the interactive hex manager and to the biome
    if (this.isColRowInVisibleChunk(col, row)) {
      await this.updateHexagonGridPromise;
      // Add hex to all interactive hexes
      this.interactiveHexManager.addHex({ col, row });

      // Add border hexes for newly explored hex
      const neighborOffsets = getNeighborOffsets(row);

      neighborOffsets.forEach(({ i, j }) => {
        const neighborCol = col + i;
        const neighborRow = row + j;
        const isNeighborExplored = this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;

        if (!isNeighborExplored) {
          this.interactiveHexManager.addHex({ col: neighborCol, row: neighborRow });
        }
      });

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
      this.removeCachedMatricesAroundColRow(renderedChunkCenterCol, renderedChunkCenterRow);
      this.cacheMatricesForChunk(renderedChunkCenterRow, renderedChunkCenterCol);
    } else {
      this.removeCachedMatricesAroundColRow(hexChunkCol, hexChunkRow);
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

  getChunksAround(chunkKey: string) {
    const startRow = parseInt(chunkKey.split(",")[0]);
    const startCol = parseInt(chunkKey.split(",")[1]);
    const chunks: string[] = [];
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += this.chunkSize) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += this.chunkSize) {
        const { x, y, z } = getWorldPositionForHex({ row: startRow + i, col: startCol + j });
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
    for (let i = -this.renderChunkSize.width / 2; i <= this.renderChunkSize.width / 2; i += 10) {
      for (let j = -this.renderChunkSize.width / 2; j <= this.renderChunkSize.height / 2; j += 10) {
        if (i === 0 && j === 0) {
          continue;
        }
        this.removeCachedMatricesForChunk(row + i, col + j);
      }
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
    await Promise.all(this.modelLoadPromises);
    if (this.applyCachedMatricesForChunk(startRow, startCol)) {
      console.log("cache applied");
      this.computeInteractiveHexes(startRow, startCol, rows, cols);
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

          if (!isExplored) {
            const neighborOffsets = getNeighborOffsets(globalRow);
            const isBorder = neighborOffsets.some(({ i, j }) => {
              const neighborCol = globalCol + i;
              const neighborRow = globalRow + j;
              return this.exploredTiles.get(neighborCol)?.has(neighborRow) || false;
            });

            if (isBorder) {
              this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
            }
          } else {
            this.interactiveHexManager.addHex({ col: globalCol, row: globalRow });
          }

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
          resolve();
        }
      };

      Promise.all(this.modelLoadPromises).then(() => {
        requestAnimationFrame(processBatch);
      });
    });
  }

  private async computeTileEntities(chunkKey: string) {
    const startCol = parseInt(chunkKey.split(",")[1]) + FELT_CENTER;
    const startRow = parseInt(chunkKey.split(",")[0]) + FELT_CENTER;

    //const range = this.chunkSize / 2;

    const { width } = this.renderChunkSize;
    const range = width / 2;

    // Skip if we've already fetched this chunk
    if (this.fetchedChunks.has(chunkKey)) {
      console.log("Already fetched");
      return;
    }

    // Add to fetched chunks before the query to prevent concurrent duplicate requests
    this.fetchedChunks.add(chunkKey);

    const start = performance.now();
    try {
      this.state.setLoading(LoadingStateKey.Map, true);
      await getMapFromTorii(
        this.dojo.network.toriiClient,
        this.dojo.network.contractComponents as any,
        startCol,
        startRow,
        range,
      );
    } catch (error) {
      // If there's an error, remove the chunk from cached set so it can be retried
      this.fetchedChunks.delete(chunkKey);
      console.error("Error fetching tile entities:", error);
    } finally {
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

  updateVisibleChunks(force: boolean = false) {
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
      this.currentChunk = chunkKey;
      // Calculate the starting position for the new chunk
      this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

      // Update which interactive hexes are visible in the new chunk
      this.interactiveHexManager.updateVisibleHexes(
        startRow,
        startCol,
        this.renderChunkSize.width,
        this.renderChunkSize.height,
      );

      this.armyManager.updateChunk(chunkKey);
      this.structureManager.updateChunk(chunkKey);
      this.questManager.updateChunk(chunkKey);
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.armyManager.update(deltaTime);
    this.selectedHexManager.update(deltaTime);
    this.structureManager.updateAnimations(deltaTime);
    this.minimap.update();
  }

  public clearTileEntityCache() {
    this.fetchedChunks.clear();
    // Also clear the interactive hexes when clearing the entire cache
    this.interactiveHexManager.clearHexes();
  }

  destroy() {
    this.resourceFXManager.destroy();
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
}
