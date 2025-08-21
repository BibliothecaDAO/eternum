import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  BUILDINGS_CATEGORIES_TYPES,
  BUILDINGS_GROUPS,
  HEX_SIZE,
  MinesMaterialsParams,
  WONDER_REALM,
  buildingModelPaths,
  castleLevelToRealmCastle,
  getBiomeVariant,
  hyperstructureStageToModel,
  structureTypeToBuildingType,
} from "@/three/constants";
import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { BIOME_COLORS } from "@/three/managers/biome-colors";
import { BuildingPreview } from "@/three/managers/building-preview";
import { SMALL_DETAILS_NAME } from "@/three/managers/instanced-model";
import { SceneManager } from "@/three/scene-manager";
import { HexagonScene } from "@/three/scenes/hexagon-scene";
import { playBuildingSound } from "@/three/sound/utils";
import { MatrixPool } from "@/three/utils/matrix-pool";
import { toggleMapHexView, selectNextStructure as utilSelectNextStructure } from "@/three/utils/navigation";
import { SceneShortcutManager } from "@/three/utils/shortcuts";
import { createPausedLabel, gltfLoader } from "@/three/utils/utils";
import { LeftView } from "@/types";
import { BuildingSystemUpdate, Position, StructureProgress } from "@bibliothecadao/eternum";

import { IS_FLAT_MODE } from "@/ui/config";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SetupResult } from "@bibliothecadao/dojo";
import {
  ActionType,
  Biome,
  ResourceIdToMiningType,
  ResourceManager,
  TileManager,
  getEntityIdFromKeys,
  getStructureStage,
} from "@bibliothecadao/eternum";
import {
  BUILDINGS_CENTER,
  BiomeType,
  BuildingType,
  HexPosition,
  RealmLevels,
  ResourceMiningTypes,
  ResourcesIds,
  Structure,
  StructureType,
  findResourceById,
  getNeighborHexes,
  getProducedResource,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import gsap from "gsap";
import {
  AnimationClip,
  AnimationMixer,
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { CSS2DObject } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { SceneName } from "../types";
import { getHexForWorldPosition, getWorldPositionForHex } from "../utils";

const loader = gltfLoader;

const generateHexPositions = (center: HexPosition, radius: number) => {
  const color = new Color("gray");
  const positions: any[] = [];
  const positionSet = new Set(); // To track existing positions

  // Helper function to add position if not already added
  const addPosition = (col: number, row: number, isBorder: boolean) => {
    const key = `${col},${row}`;
    if (!positionSet.has(key)) {
      const position = {
        ...getWorldPositionForHex({ col, row }, false),
        color,
        col,
        row,
        isBorder,
      };
      positions.push(position);
      positionSet.add(key);
    }
  };

  // Add center position
  addPosition(center.col, center.row, false);

  // Generate positions in expanding hexagonal layers
  let currentLayer = [center];
  for (let i = 0; i < radius; i++) {
    const nextLayer: any = [];
    currentLayer.forEach((pos) => {
      getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
        if (!positionSet.has(`${neighbor.col},${neighbor.row}`)) {
          addPosition(neighbor.col, neighbor.row, i === radius - 1);
          nextLayer.push({ col: neighbor.col, row: neighbor.row });
        }
      });
    });
    currentLayer = nextLayer; // Move to the next layer
  }

  return positions;
};

export default class HexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<
    BUILDINGS_GROUPS,
    Map<BUILDINGS_CATEGORIES_TYPES, { model: Group; animations: AnimationClip[] }>
  > = new Map();
  private buildingInstances: Map<string, Group> = new Map();
  private wonderInstances: Map<string, Group> = new Map();
  private buildingMixers: Map<string, AnimationMixer> = new Map();
  private pillars: InstancedMesh | null = null;
  private buildings: any = [];
  centerColRow: number[] = [0, 0];
  private highlights: { col: number; row: number }[] = [];
  private buildingPreview: BuildingPreview | null = null;
  private tileManager: TileManager;
  private labels: {
    col: number;
    row: number;
    label: CSS2DObject;
  }[] = [];
  private structureStage: RealmLevels | StructureProgress = RealmLevels.Settlement;
  private minesMaterials: Map<number, MeshStandardMaterial> = new Map();
  private structureIndex: number = 0;
  private playerStructures: Structure[] = [];
  private isBlitz: boolean;
  private structureUpdateSubscription: any | null = null;

  constructor(
    controls: MapControls,
    dojo: SetupResult,
    mouse: Vector2,
    raycaster: Raycaster,
    sceneManager: SceneManager,
  ) {
    super(SceneName.Hexception, controls, dojo, mouse, raycaster, sceneManager);

    this.isBlitz = getIsBlitz();
    this.buildingPreview = new BuildingPreview(this.scene);

    const pillarGeometry = new ExtrudeGeometry(createHexagonShape(1), { depth: 2, bevelEnabled: false });
    pillarGeometry.rotateX(Math.PI / 2);
    this.pillars = new InstancedMesh(pillarGeometry, new MeshStandardMaterial(), 1000);
    this.pillars.position.y = 0.05;
    this.pillars.count = 0;
    this.scene.add(this.pillars);

    this.loadBuildingModels();
    this.loadBiomeModels(900);

    this.tileManager = new TileManager(this.dojo.components, this.dojo.systemCalls, { col: 0, row: 0 });

    this.setup();

    this.inputManager.addListener("contextmenu", (raycaster) => {
      this.clearBuildingMode();
    });

    this.state = useUIStore.getState();

    this.shortcutManager = new SceneShortcutManager("hexception", this.sceneManager);

    // Only register shortcuts if they haven't been registered already
    if (!this.shortcutManager.hasShortcuts()) {
      this.shortcutManager.registerShortcut({
        id: "cycle-structures",
        key: "Tab",
        description: "Cycle through structures",
        sceneRestriction: SceneName.Hexception,
        condition: () => this.playerStructures.length > 0,
        action: () => this.selectNextStructure(),
      });

      this.shortcutManager.registerShortcut({
        id: "toggle-view",
        key: "v",
        description: "Toggle between map and hex view",
        sceneRestriction: SceneName.Hexception,
        action: () => toggleMapHexView(),
      });

      this.shortcutManager.registerShortcut({
        id: "escape-handler",
        key: "Escape",
        description: "Return to world map from hexagon view",
        sceneRestriction: SceneName.Hexception,
        action: () => {
          if (this.isNavigationViewOpen()) {
            this.closeNavigationViews();
          } else {
            this.clearBuildingMode();
          }
        },
      });
    }

    // add gui to change castle level
    this.GUIFolder.add(this, "structureStage", 0, 3).onFinishChange((value: RealmLevels) => {
      this.structureStage = value;
      this.removeCastleFromScene();
      this.updateHexceptionGrid(this.hexceptionRadius);
    });

    useUIStore.subscribe(
      (state) => state.playerStructures,
      (playerStructures) => {
        if (playerStructures.length > 0) {
          this.updatePlayerStructures(playerStructures);
        }
      },
    );

    useUIStore.subscribe(
      (state) => state.previewBuilding,
      (building) => {
        if (building) {
          this.interactiveHexManager.setAuraVisibility(false);
          this.buildingPreview?.setPreviewBuilding(building as any);
          this.highlightHexManager.highlightHexes(
            this.highlights.map((hex) => ({
              hex: { col: hex.col, row: hex.row },
              actionType: ActionType.Build,
            })),
          );
        } else {
          this.interactiveHexManager.setAuraVisibility(true);
          this.clearBuildingMode();
        }
      },
    );

    useUIStore.subscribe(
      (state) => state.useSimpleCost,
      (useSimpleCost) => {
        this.state.useSimpleCost = useSimpleCost;
      },
    );

    // Subscribe to structureEntityId changes
    useUIStore.subscribe(
      (state) => state.structureEntityId,
      (structureEntityId) => {
        // Clean up previous subscription if it exists
        if (this.structureUpdateSubscription) {
          this.structureUpdateSubscription.unsubscribe();
          this.structureUpdateSubscription = null;
        }

        // Only create a new subscription if we have a valid entity ID
        if (structureEntityId && structureEntityId !== 0) {
          console.log(`Setting up Structure listener for entity ID: ${structureEntityId}`);

          this.structureUpdateSubscription = this.worldUpdateListener.StructureEntityListener.onLevelUpdate(
            structureEntityId,
            (update) => {
              this.structureStage = update.level as RealmLevels;
              this.removeCastleFromScene();
              this.updateHexceptionGrid(this.hexceptionRadius);
            },
          );
        }
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
  }

  private clearBuildingMode() {
    this.buildingPreview?.clearPreviewBuilding();
    this.highlightHexManager.highlightHexes([]);
    this.state.setPreviewBuilding(null);
  }

  private loadBuildingModels() {
    for (const category of Object.values(BUILDINGS_GROUPS)) {
      const categoryPaths = buildingModelPaths(this.isBlitz)[category];
      if (!this.buildingModels.has(category)) {
        this.buildingModels.set(category, new Map());
      }
      const categoryMap = this.buildingModels.get(category)!;

      for (const [building, path] of Object.entries(categoryPaths)) {
        const loadPromise = new Promise<void>((resolve, reject) => {
          loader.load(
            path,
            (gltf) => {
              const model = gltf.scene as Group;
              model.position.set(0, 0, 0);
              model.rotation.y = Math.PI;

              model.traverse((child) => {
                if (child instanceof Mesh) {
                  if (!child.name.includes(SMALL_DETAILS_NAME) && !child.parent?.name.includes(SMALL_DETAILS_NAME)) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                  }
                }
              });

              // Store the model and animations in the nested map
              categoryMap.set(building as BUILDINGS_CATEGORIES_TYPES, { model, animations: gltf.animations });
              resolve();
            },
            undefined,
            (error) => {
              console.error(`Error loading ${building} model:`, error);
              reject(error);
            },
          );
        });
        this.modelLoadPromises.push(loadPromise);
      }
    }

    Promise.all(this.modelLoadPromises).then(() => {});
  }

  setup() {
    this.labels.forEach((label) => {
      this.scene.remove(label.label);
    });
    this.labels = [];

    const col = this.locationManager.getCol();
    const row = this.locationManager.getRow();

    const contractPosition = new Position({ x: col, y: row }).getContract();

    this.centerColRow = [contractPosition.x, contractPosition.y];

    this.tileManager.setTile({ col, row });

    // remove all previous building instances
    this.buildingInstances.forEach((instance) => {
      this.scene.remove(instance);
    });
    this.buildingInstances.clear();

    // remove all previous wonder instances
    this.wonderInstances.forEach((instance) => {
      this.scene.remove(instance);
    });
    this.wonderInstances.clear();

    // clear all animation mixers
    this.buildingMixers.clear();

    // subscribe to buiding updates (create and destroy)
    this.worldUpdateListener.Buildings.onBuildingUpdate(
      { col: this.centerColRow[0], row: this.centerColRow[1] },
      (update: BuildingSystemUpdate) => {
        const { innerCol, innerRow, buildingType } = update;
        if (buildingType === BuildingType.None && innerCol && innerRow) {
          this.removeBuilding(innerCol, innerRow);
        }
        this.updateHexceptionGrid(this.hexceptionRadius);
      },
    );

    this.removeCastleFromScene();
    this.updateHexceptionGrid(this.hexceptionRadius);
    this.controls.maxDistance = IS_FLAT_MODE ? 36 : 20;
    this.controls.enablePan = false;
    this.controls.enableZoom = useUIStore.getState().enableMapZoom;
    this.controls.zoomToCursor = false;

    this.moveCameraToURLLocation();
    this.changeCameraView(2);

    // Configure thunder bolts for hexception - focused storm effect
    this.getThunderBoltManager().setConfig({
      radius: 6, // Medium spread around the hex settlement
      count: 4, // Moderate number of bolts for hex view
      duration: 400, // Longer duration for better visibility in close view
      persistent: false, // Auto-fade for production use
      debug: false, // Disable logging for performance
    });

    // select center hex
    this.state.setSelectedBuildingHex({
      outerCol: col,
      outerRow: row,
      innerCol: BUILDINGS_CENTER[0],
      innerRow: BUILDINGS_CENTER[1],
    });
  }

  onSwitchOff() {
    this.labels.forEach((label) => {
      this.scene.remove(label.label);
    });

    // Note: Don't clean up shortcuts here - they should persist across scene switches
    // Shortcuts will be cleaned up when the scene is actually destroyed
  }

  destroy() {
    // Clean up shortcuts when scene is actually destroyed
    if (this.shortcutManager instanceof SceneShortcutManager) {
      this.shortcutManager.cleanup();
    }

    // Clean up structure update subscription
    if (this.structureUpdateSubscription) {
      this.structureUpdateSubscription.unsubscribe();
      this.structureUpdateSubscription = null;
    }

    // Clean up input manager event listeners
    this.inputManager.destroy();

    // OPTIMIZED: Release any matrices back to the pool
    console.log("🧹 Hexception scene cleanup - releasing matrices");
  }

  protected async onHexagonClick(hexCoords: HexPosition | null): Promise<void> {
    const overlay = document.querySelector(".shepherd-modal-is-visible");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (hexCoords === null) return;

    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    const buildingType = this.buildingPreview?.getPreviewBuilding();

    // Check if account exists before allowing actions
    const account = useAccountStore.getState().account;
    if (buildingType) {
      // if building mode
      if (!this.tileManager.isHexOccupied(normalizedCoords)) {
        this.clearBuildingMode();
        const useSimpleCost = this.state.useSimpleCost;
        try {
          console.log("Placing building at:", {
            dojo: account!,
            entityId: useUIStore.getState().structureEntityId,
            col: normalizedCoords.col,
            row: normalizedCoords.row,
            buildingId: buildingType.type,
          });

          await this.tileManager.placeBuilding(
            account!,
            useUIStore.getState().structureEntityId,
            buildingType.type,
            normalizedCoords,
            useSimpleCost,
          );
        } catch (error) {
          console.log("catched error so removing building", error);
          this.removeBuilding(normalizedCoords.col, normalizedCoords.row);
        }
        this.updateHexceptionGrid(this.hexceptionRadius);
      }
    } else {
      // if not building mode
      const { col: outerCol, row: outerRow } = this.tileManager.getHexCoords();

      const { isSoundOn, effectsLevel } = useUIStore.getState();

      if (BUILDINGS_CENTER[0] === hexCoords.col && BUILDINGS_CENTER[1] === hexCoords.row) {
        const building = getComponentValue(
          this.dojo.components.Building,
          getEntityIdFromKeys([BigInt(outerCol), BigInt(outerRow), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
        );

        playBuildingSound(building?.category as BuildingType, isSoundOn, effectsLevel);

        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: hexCoords.col,
          innerRow: hexCoords.row,
        });
        this.state.setLeftNavigationView(LeftView.EntityView);
      } else if (this.tileManager.isHexOccupied(normalizedCoords)) {
        const building = getComponentValue(
          this.dojo.components.Building,
          getEntityIdFromKeys([BigInt(outerCol), BigInt(outerRow), BigInt(hexCoords.col), BigInt(hexCoords.row)]),
        );

        playBuildingSound(building?.category as BuildingType, isSoundOn, effectsLevel);

        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: normalizedCoords.col,
          innerRow: normalizedCoords.row,
        });
        this.state.setLeftNavigationView(LeftView.EntityView);
      }
    }
  }
  protected onHexagonMouseMove(hex: { position: Vector3; hexCoords: HexPosition } | null): void {
    // Always clear the tooltip first to prevent it from persisting when other elements overlap
    this.state.setTooltip(null);

    if (hex === null) {
      return;
    }

    const { position, hexCoords } = hex;
    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    //check if it on main hex

    this.buildingPreview?.setBuildingPosition(position);

    if (
      this.tileManager.isHexOccupied(normalizedCoords) ||
      (normalizedCoords.col === BUILDINGS_CENTER[0] && normalizedCoords.row === BUILDINGS_CENTER[1])
    ) {
      this.buildingPreview?.setBuildingColor(new Color(0xff0000));
    } else {
      this.buildingPreview?.resetBuildingColor();
    }
    const building = this.tileManager.getBuilding(normalizedCoords);

    const productionManager = building
      ? new ResourceManager(this.dojo.components, this.state.structureEntityId)
      : undefined;

    const producedResource = getProducedResource(building?.category as BuildingType);

    const isActive = producedResource ? productionManager?.isActive(producedResource) : false;

    if (building && producedResource) {
      this.state.setTooltip({
        content: (
          <div className="flex items-center text-lg space-x-1">
            <ResourceIcon size="lg" resource={findResourceById(producedResource as ResourcesIds)?.trait ?? ""} />
            <div>Producing {findResourceById(producedResource as ResourcesIds)?.trait}</div>
            <div>—</div>
            <div className={clsx(!isActive ? "text-order-giants" : "text-order-brilliance")}>
              {!isActive ? "Paused" : "Active"}
            </div>
          </div>
        ),
        position: "bottom",
      });
    }
  }
  protected onHexagonRightClick(): void {}
  protected onHexagonDoubleClick(): void {}

  public moveCameraToURLLocation() {
    this.moveCameraToColRow(10, 10, 0);
  }

  updateCastleLevel() {
    const structureType = this.tileManager.structureType();
    if (structureType === StructureType.Realm || structureType === StructureType.Village) {
      this.structureStage = this.tileManager.getRealmLevel(this.state.structureEntityId);
    } else if (structureType === StructureType.Hyperstructure) {
      this.structureStage = getStructureStage(
        structureType,
        useUIStore.getState().structureEntityId,
        this.dojo.components,
      );
    }
  }

  updateHexceptionGrid(radius: number) {
    const dummy = new Object3D();
    const mainStructureType = this.tileManager.structureType();
    this.updateCastleLevel();

    const biomeHexes: Record<BiomeType | "Empty" | string, Matrix4[]> = {
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
      Empty: [],
    };

    Promise.all(this.modelLoadPromises).then(() => {
      const centers = [
        [0, 0], //0, 0 (Main hex)
        [-6, 5], //-1, 1
        [7, 4], //1, 0
        [1, 9], //0, 1
        [-7, -4], //-1, 0
        [0, -9], //0, -1
        [7, -5], //1, -1
      ];
      const neighbors = getNeighborHexes(this.centerColRow[0], this.centerColRow[1]);
      const label = new Group();
      this.scene.add(label);
      this.highlights = [];

      // compute matrices to update biome models for each of the large hexes
      for (const center in centers) {
        const isMainHex = centers[center][0] === 0 && centers[center][1] === 0;
        if (isMainHex) {
          this.computeMainHexMatrices(radius, dummy, centers[center], this.tileManager.getHexCoords(), biomeHexes);
        } else {
          this.computeNeighborHexMatrices(radius, dummy, centers[center], neighbors[Number(center) - 1], biomeHexes);
        }
      }

      // add buildings to the scene in the center hex
      for (const building of this.buildings) {
        const key = `${building.col},${building.row}`;
        if (!this.buildingInstances.has(key)) {
          let buildingGroup: BUILDINGS_GROUPS;
          let buildingType: BUILDINGS_CATEGORIES_TYPES;

          if (building.resource && (building.resource < 23 || building.resource === ResourcesIds.AncientFragment)) {
            buildingGroup = BUILDINGS_GROUPS.RESOURCES_MINING;
            buildingType = ResourceIdToMiningType[building.resource as ResourcesIds] as ResourceMiningTypes;
          } else {
            buildingGroup = BUILDINGS_GROUPS.BUILDINGS;
            buildingType = building.category as BUILDINGS_CATEGORIES_TYPES;
          }

          if (buildingGroup === BUILDINGS_GROUPS.BUILDINGS && buildingType === BuildingType.ResourceLabor) {
            buildingType = castleLevelToRealmCastle[this.structureStage];
            buildingGroup = BUILDINGS_GROUPS.REALMS;
          }

          if (mainStructureType === StructureType.Village) {
            // Only apply Village model to the central building (castle position)
            if (building.col === BUILDINGS_CENTER[0] && building.row === BUILDINGS_CENTER[1]) {
              buildingGroup = BUILDINGS_GROUPS.VILLAGE;
              buildingType = StructureType.Village;
            }
          }

          // Handle hyperstructure type
          if (building.structureType === StructureType.Hyperstructure) {
            buildingGroup = BUILDINGS_GROUPS.HYPERSTRUCTURE;
            buildingType = hyperstructureStageToModel[this.structureStage as StructureProgress];
          }

          // Store original building group and type for potential wonder addition
          const originalBuildingGroup = buildingGroup;
          const originalBuildingType = buildingType;

          // Check if the realm has a wonder
          const hasWonder = this.tileManager.getWonder(this.state.structureEntityId);

          // If the realm has a wonder and it's not a hyperstructure, we'll add both models
          // But only for the central building (castle) at BUILDINGS_CENTER coordinates
          if (
            hasWonder &&
            building.structureType !== StructureType.Hyperstructure &&
            building.col === BUILDINGS_CENTER[0] &&
            building.row === BUILDINGS_CENTER[1]
          ) {
            // First, create the wonder model
            const wonderGroup = BUILDINGS_GROUPS.WONDER;
            const wonderType = WONDER_REALM;

            const wonderData = this.buildingModels
              .get(wonderGroup)
              ?.get(wonderType.toString() as BUILDINGS_CATEGORIES_TYPES);

            if (wonderData) {
              const wonderInstance = wonderData.model.clone();
              wonderInstance.applyMatrix4(building.matrix);

              // Set initial scale for animation
              wonderInstance.scale.set(0.01, 0.01, 0.01);

              // Add wonder instance to scene
              this.scene.add(wonderInstance);
              // Store the wonder instance for later removal
              this.wonderInstances.set(`${key}_wonder`, wonderInstance);

              // Animate scale using gsap
              gsap.to(wonderInstance.scale, {
                duration: 0.5,
                x: 1,
                y: 1,
                z: 1,
                ease: "power2.out",
              });

              // Check if the model has animations and start them
              const wonderAnimations = wonderData.animations;
              if (wonderAnimations && wonderAnimations.length > 0) {
                const wonderMixer = new AnimationMixer(wonderInstance);
                wonderAnimations.forEach((clip: AnimationClip) => {
                  wonderMixer.clipAction(clip).play();
                });
                // Store the mixer for later use
                this.buildingMixers.set(`${key}_wonder`, wonderMixer);
              }
            }
          }

          // Now create the original building model (Realm or other)
          const buildingData = this.buildingModels
            .get(originalBuildingGroup)
            ?.get(originalBuildingType.toString() as BUILDINGS_CATEGORIES_TYPES);

          if (buildingData) {
            const instance = buildingData.model.clone();

            instance.applyMatrix4(building.matrix);

            // Set initial scale for animation
            instance.scale.set(0.01, 0.01, 0.01);

            if (buildingType === ResourceMiningTypes.Forge) {
              instance.traverse((child) => {
                if (child.name === "Grassland003_1" && child instanceof Mesh) {
                  if (!this.minesMaterials.has(building.resource)) {
                    const material = new MeshStandardMaterial(MinesMaterialsParams[building.resource]);
                    this.minesMaterials.set(building.resource, material);
                  }
                  child.material = this.minesMaterials.get(building.resource);
                }
              });
            }
            if (buildingType === ResourceMiningTypes.Mine) {
              instance.traverse((child) => {
                // @ts-ignore
                if (child?.material?.name === "crystal" && child instanceof Mesh) {
                  if (!this.minesMaterials.has(building.resource)) {
                    const material = new MeshStandardMaterial(MinesMaterialsParams[building.resource]);
                    this.minesMaterials.set(building.resource, material);
                  }
                  child.material = this.minesMaterials.get(building.resource);
                }
              });
            }

            // Add instance to scene BEFORE starting animation
            this.scene.add(instance);
            this.buildingInstances.set(key, instance);

            // Animate scale using gsap
            gsap.to(instance.scale, {
              duration: 0.5,
              x: 1,
              y: 1,
              z: 1,
              ease: "power2.out",
            });

            // Check if the model has animations and start them
            const animations = buildingData.animations;
            if (animations && animations.length > 0) {
              const mixer = new AnimationMixer(instance);
              animations.forEach((clip: AnimationClip) => {
                mixer.clipAction(clip).play();
              });
              // Store the mixer for later use (e.g., updating in the animation loop)
              this.buildingMixers.set(key, mixer);
            }
          }
        }
        const needPausedLabel =
          building.paused &&
          this.labels.findIndex((label) => label.col === building.col && label.row === building.row) < 0;
        if (needPausedLabel) {
          this.addPausedLabelToBuilding(building);
        } else if (!building.paused) {
          this.removePausedLabelFromBuilding(building);
        }
      }

      // update neighbor hexes around the center hex
      let pillarOffset = 0;
      for (const [biome, matrices] of Object.entries(biomeHexes)) {
        const hexMesh = this.biomeModels.get(biome as any)!;
        matrices.forEach((matrix, index) => {
          hexMesh.setMatrixAt(index, matrix);
          this.pillars!.setMatrixAt(index + pillarOffset, matrix);
          // Use base biome type for color lookup (remove 'Alt' suffix if present)
          const baseBiome = biome.endsWith("Alt") ? biome.slice(0, -3) : biome;
          this.pillars!.setColorAt(index + pillarOffset, BIOME_COLORS[baseBiome as BiomeType]);
        });
        pillarOffset += matrices.length;
        this.pillars!.position.y = -0.01;
        this.pillars!.count = pillarOffset;
        this.pillars!.computeBoundingSphere();
        hexMesh.setCount(matrices.length);
      }
      this.pillars!.instanceMatrix.needsUpdate = true;
      this.pillars!.instanceColor!.needsUpdate = true;
      this.interactiveHexManager.renderAllHexes();
    });
  }

  addPausedLabelToBuilding(building: { col: number; row: number; matrix: any }) {
    const pausedDiv = createPausedLabel();
    const pausedLabel = new CSS2DObject(pausedDiv);
    pausedLabel.position.setFromMatrixPosition(building.matrix);
    pausedLabel.position.y += 1;
    this.scene.add(pausedLabel);
    this.labels.push({ col: building.col, row: building.row, label: pausedLabel });
  }

  removePausedLabelFromBuilding(building: { col: number; row: number }) {
    const index = this.labels.findIndex((label) => label.col === building.col && label.row === building.row);
    if (index >= 0) {
      this.scene.remove(this.labels[index].label);
      this.labels.splice(index, 1);
    }
  }

  removeCastleFromScene() {
    const key = `${BUILDINGS_CENTER[0]},${BUILDINGS_CENTER[1]}`;
    const instance = this.buildingInstances.get(key);
    if (instance) {
      this.scene.remove(instance);
      this.buildingInstances.delete(key);
    }

    // Also remove any associated wonder instance
    const wonderKey = `${key}_wonder`;
    const wonderInstance = this.wonderInstances.get(wonderKey);
    if (wonderInstance) {
      this.scene.remove(wonderInstance);
      this.wonderInstances.delete(wonderKey);
    }

    // Remove any mixers
    this.buildingMixers.delete(key);
    this.buildingMixers.delete(wonderKey);
  }

  computeHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    isMainHex: boolean,
    existingBuildings: any[],
    biomeHexes: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    const biome = Biome.getBiome(targetHex.col, targetHex.row);
    const biomeVariant = getBiomeVariant(biome, targetHex.col, targetHex.row);
    const buildableAreaBiome = "Empty";
    const isFlat = biome === "Ocean" || biome === "DeepOcean" || isMainHex;

    // reset buildings
    if (isMainHex) {
      this.buildings = [];
    }

    let positions = generateHexPositions(
      { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
      radius,
    );

    if (isMainHex) {
      const buildablePositions = generateHexPositions(
        { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
        this.structureStage + 1,
      );

      positions = positions.filter(
        (position) =>
          !buildablePositions.some(
            (buildablePosition) => buildablePosition.col === position.col && buildablePosition.row === position.row,
          ),
      );

      buildablePositions.forEach((position) => {
        dummy.position.x = position.x;
        dummy.position.z = position.z;
        dummy.position.y = isMainHex || isFlat || position.isBorder ? 0.05 : 0.05 + position.y / 2;
        dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        dummy.updateMatrix();

        this.interactiveHexManager.addHex({ col: position.col, row: position.row });

        let withBuilding = false;
        const building = existingBuildings.find((value) => value.col === position.col && value.row === position.row);

        if (building) {
          withBuilding = true;
          const buildingObj = dummy.clone();
          // --- Deterministic Rotation ---
          const rotationSeed = this.hashCoordinates(position.col, position.row);
          const rotationIndex = Math.floor(rotationSeed * 6); // Map 0-1 to 0-5
          const deterministicRotation = (rotationIndex * Math.PI) / 3; // Convert index to radians (0, pi/3, 2pi/3, ...)
          buildingObj.rotation.y = deterministicRotation;
          // --- End Deterministic Rotation ---

          buildingObj.updateMatrix();
          this.buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
        } else if (isMainHex) {
          this.highlights.push(getHexForWorldPosition(dummy.position));
        }

        if (!withBuilding) {
          // OPTIMIZED: Use matrix pool instead of clone()
          const tempMatrix = MatrixPool.getInstance().getMatrix();
          tempMatrix.copy(dummy.matrix);
          biomeHexes[buildableAreaBiome as BiomeType].push(tempMatrix);
        }
      });
    }

    positions.forEach((position) => {
      dummy.position.x = position.x;
      dummy.position.z = position.z;
      dummy.position.y = isMainHex || isFlat || position.isBorder || IS_FLAT_MODE ? 0.05 : 0.05 + position.y / 2;
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
      const rotationSeed = this.hashCoordinates(position.col, position.row);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      if (!IS_FLAT_MODE) {
        dummy.rotation.y = randomRotation;
      } else {
        dummy.rotation.y = 0;
      }
      dummy.updateMatrix();
      // OPTIMIZED: Use matrix pool instead of clone()
      const tempMatrix = MatrixPool.getInstance().getMatrix();
      tempMatrix.copy(dummy.matrix);
      biomeHexes[biomeVariant].push(tempMatrix);
    });
  };

  computeMainHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    biomeHexes: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    const existingBuildings: any[] = this.tileManager.existingBuildings();
    const structureType = this.tileManager.structureType();

    if (structureType && structureType !== StructureType.Realm && structureType !== StructureType.Village) {
      existingBuildings.push({
        col: BUILDINGS_CENTER[0],
        row: BUILDINGS_CENTER[1],
        structureType,
        category: BuildingType[structureTypeToBuildingType[structureType]],
        resource: undefined,
        paused: false,
      });
    }
    this.computeHexMatrices(radius, dummy, center, targetHex, true, existingBuildings, biomeHexes);
  };

  computeNeighborHexMatrices = (
    radius: number,
    dummy: Object3D,
    center: number[],
    targetHex: HexPosition,
    biomeHexes: Record<BiomeType | "Empty" | string, Matrix4[]>,
  ) => {
    this.computeHexMatrices(radius, dummy, center, targetHex, false, [], biomeHexes);
  };

  removeBuilding(innerCol: number, innerRow: number) {
    const key = `${innerCol},${innerRow}`;
    const instance = this.buildingInstances.get(key);
    if (instance) {
      this.scene.remove(instance);
      this.buildingInstances.delete(key);
    }

    // Also remove any associated wonder instance
    const wonderKey = `${key}_wonder`;
    const wonderInstance = this.wonderInstances.get(wonderKey);
    if (wonderInstance) {
      this.scene.remove(wonderInstance);
      this.wonderInstances.delete(wonderKey);
    }

    // Remove any mixers
    this.buildingMixers.delete(key);
    this.buildingMixers.delete(wonderKey);
  }

  private selectNextStructure() {
    this.structureIndex = utilSelectNextStructure(this.playerStructures, this.structureIndex, "hex");
    if (this.playerStructures.length > 0) {
      const structure = this.playerStructures[this.structureIndex];
      // Set the structure entity ID in the UI store
      this.state.setStructureEntityId(structure.entityId);
    }
  }

  public updatePlayerStructures(structures: Structure[]) {
    this.playerStructures = structures;
    if (this.structureIndex >= structures.length) {
      this.structureIndex = 0;
    }
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.buildingMixers.forEach((mixer) => {
      mixer.update(deltaTime);
    });
  }
}
