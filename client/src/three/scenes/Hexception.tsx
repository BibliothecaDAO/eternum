import * as THREE from "three";

import { TileManager } from "@/dojo/modelManager/TileManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { HexPosition, ResourceMiningTypes, SceneName } from "@/types";
import { Position } from "@/types/Position";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { LeftView } from "@/ui/modules/navigation/LeftNavigationModule";
import {
  ResourceIdToMiningType,
  getEntityIdFromKeys,
  getHexForWorldPosition,
  getWorldPositionForHex,
} from "@/ui/utils/utils";
import {
  BuildingType,
  RealmLevels,
  ResourcesIds,
  StructureType,
  findResourceById,
  getNeighborHexes,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { CSS2DObject } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { SceneManager } from "../SceneManager";
import { BIOME_COLORS, Biome, BiomeType } from "../components/Biome";
import { BuildingPreview } from "../components/BuildingPreview";
import { SMALL_DETAILS_NAME } from "../components/InstancedModel";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { createPausedLabel, gltfLoader } from "../helpers/utils";
import { playBuildingSound } from "../sound/utils";
import { BuildingSystemUpdate, RealmSystemUpdate } from "../systems/types";
import { HexagonScene } from "./HexagonScene";
import {
  BUILDINGS_CENTER,
  HEX_SIZE,
  MinesMaterialsParams,
  StructureProgress,
  WONDER_REALM,
  buildingModelPaths,
  castleLevelToRealmCastle,
  hyperstructureStageToModel,
  structureTypeToBuildingType,
} from "./constants";

const loader = gltfLoader;

const generateHexPositions = (center: HexPosition, radius: number) => {
  const color = new THREE.Color("gray");
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

interface Building {
  matrix: THREE.Matrix4;
  buildingType: BuildingType;
}

export default class HexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<
    BuildingType | ResourceMiningTypes | typeof WONDER_REALM,
    { model: THREE.Group; animations: THREE.AnimationClip[] }
  > = new Map();
  private buildingInstances: Map<string, THREE.Group> = new Map();
  private buildingMixers: Map<string, THREE.AnimationMixer> = new Map();
  private pillars: THREE.InstancedMesh | null = null;
  private buildings: any = [];
  centerColRow: number[] = [0, 0];
  private biome!: Biome;
  private highlights: { col: number; row: number }[] = [];
  private buildingPreview: BuildingPreview | null = null;
  private tileManager: TileManager;
  private buildingSubscription: any;
  private realmSubscription: any;
  private buildingInstanceIds: Map<string, { index: number; category: string }> = new Map();
  private labels: {
    col: number;
    row: number;
    label: CSS2DObject;
  }[] = [];
  private structureStage: RealmLevels | StructureProgress = RealmLevels.Settlement;
  private minesMaterials: Map<number, THREE.MeshStandardMaterial> = new Map();

  constructor(
    controls: MapControls,
    dojo: SetupResult,
    mouse: THREE.Vector2,
    raycaster: THREE.Raycaster,
    sceneManager: SceneManager,
  ) {
    super(SceneName.Hexception, controls, dojo, mouse, raycaster, sceneManager);

    this.biome = new Biome();
    this.buildingPreview = new BuildingPreview(this.scene);

    const pillarGeometry = new THREE.ExtrudeGeometry(createHexagonShape(1), { depth: 2, bevelEnabled: false });
    pillarGeometry.rotateX(Math.PI / 2);
    this.pillars = new THREE.InstancedMesh(pillarGeometry, new THREE.MeshStandardMaterial(), 1000);
    this.pillars.position.y = 0.05;
    this.pillars.count = 0;
    this.scene.add(this.pillars);

    this.loadBuildingModels();
    this.loadBiomeModels(900);

    this.tileManager = new TileManager(this.dojo, { col: 0, row: 0 });

    this.setup();

    this.inputManager.addListener("contextmenu", (raycaster) => {
      this.clearBuildingMode();
    });

    this.state = useUIStore.getState();

    // add gui to change castle level
    this.GUIFolder.add(this, "structureStage", 0, 3).onFinishChange((value: RealmLevels) => {
      this.structureStage = value;
      this.removeCastleFromScene();
      this.updateHexceptionGrid(this.hexceptionRadius);
    });

    // Add event listener for Escape key
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.sceneManager.getCurrentScene() === SceneName.Hexception) {
        if (this.isNavigationViewOpen()) {
          this.closeNavigationViews();
        } else {
          this.clearBuildingMode();
        }
      }
    });

    useUIStore.subscribe(
      (state) => state.previewBuilding,
      (building) => {
        if (building) {
          this.buildingPreview?.setPreviewBuilding(building as any);
          this.highlightHexManager.highlightHexes(this.highlights);
        } else {
          this.clearBuildingMode();
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
    for (const [building, path] of Object.entries(buildingModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            model.position.set(0, 0, 0);
            model.rotation.y = Math.PI;

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                if (!child.name.includes(SMALL_DETAILS_NAME) && !child.parent?.name.includes(SMALL_DETAILS_NAME)) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              }
            });

            // Store animations along with the model
            this.buildingModels.set(building as any, { model, animations: gltf.animations });
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

    // subscribe to buiding updates (create and destroy)
    this.buildingSubscription?.unsubscribe();
    this.buildingSubscription = this.systemManager.Buildings.subscribeToHexUpdates(
      { col: this.centerColRow[0], row: this.centerColRow[1] },
      (update: BuildingSystemUpdate) => {
        const { innerCol, innerRow, buildingType } = update;
        if (buildingType === BuildingType[BuildingType.None] && innerCol && innerRow) {
          this.removeBuilding(innerCol, innerRow);
        }
        this.updateHexceptionGrid(this.hexceptionRadius);
      },
    );

    this.realmSubscription?.unsubscribe();
    this.realmSubscription = this.systemManager.Realm.onUpdate((update: RealmSystemUpdate) => {
      if (update.hexCoords.col === this.centerColRow[0] && update.hexCoords.row === this.centerColRow[1]) {
        this.structureStage = update.level as RealmLevels;
        this.removeCastleFromScene();
        this.updateHexceptionGrid(this.hexceptionRadius);
      }
    });

    this.removeCastleFromScene();
    this.updateHexceptionGrid(this.hexceptionRadius);
    this.controls.maxDistance = 18;
    this.controls.enablePan = false;
    this.controls.zoomToCursor = false;

    this.moveCameraToURLLocation();

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
  }

  protected async onHexagonClick(hexCoords: HexPosition | null): Promise<void> {
    const overlay = document.querySelector(".shepherd-modal-overlay-container");
    const overlayClick = document.querySelector(".allow-modal-click");
    if (overlay && !overlayClick) {
      return;
    }
    if (hexCoords === null) return;

    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    const buildingType = this.buildingPreview?.getPreviewBuilding();
    if (buildingType) {
      // if building mode
      if (!this.tileManager.isHexOccupied(normalizedCoords)) {
        this.clearBuildingMode();
        try {
          await this.tileManager.placeBuilding(buildingType.type, normalizedCoords, buildingType.resource);
        } catch (error) {
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

        playBuildingSound(BuildingType[building?.category as keyof typeof BuildingType], isSoundOn, effectsLevel);

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

        playBuildingSound(BuildingType[building?.category as keyof typeof BuildingType], isSoundOn, effectsLevel);

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
  protected onHexagonMouseMove(hex: { position: THREE.Vector3; hexCoords: HexPosition } | null): void {
    if (hex === null) {
      this.state.setTooltip(null);
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
      this.buildingPreview?.setBuildingColor(new THREE.Color(0xff0000));
    } else {
      this.buildingPreview?.resetBuildingColor();
    }
    const building = this.tileManager.getBuilding(normalizedCoords);
    if (building && building.produced_resource_type) {
      this.state.setTooltip({
        content: (
          <div className="flex items-center space-x-1">
            <ResourceIcon
              size="sm"
              resource={findResourceById(building.produced_resource_type as ResourcesIds)?.trait ?? ""}
            />
            <div>Producing {findResourceById(building.produced_resource_type as ResourcesIds)?.trait}</div>
            <div>—</div>
            <div className={clsx(building.paused ? "text-order-giants" : "text-order-brilliance")}>
              {building.paused ? "Paused" : "Active"}
            </div>
          </div>
        ),
        position: "top",
      });
    } else {
      this.state.setTooltip(null);
    }
  }
  protected onHexagonRightClick(): void {}
  protected onHexagonDoubleClick(): void {}

  public moveCameraToURLLocation() {
    this.moveCameraToColRow(10, 10, 0);
  }

  updateCastleLevel() {
    const structureType = this.tileManager.structureType();
    if (structureType === StructureType.Realm) {
      this.structureStage = this.tileManager.getRealmLevel();
    } else if (structureType === StructureType.Hyperstructure) {
      this.structureStage = this.systemManager.getStructureStage(
        structureType,
        useUIStore.getState().structureEntityId,
      );
    }
  }

  updateHexceptionGrid(radius: number) {
    const dummy = new THREE.Object3D();
    this.updateCastleLevel();
    const biomeHexes: Record<BiomeType, THREE.Matrix4[]> = {
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
    };

    Promise.all(this.modelLoadPromises).then(() => {
      let centers = [
        [0, 0], //0, 0 (Main hex)
        [-6, 5], //-1, 1
        [7, 4], //1, 0
        [1, 9], //0, 1
        [-7, -4], //-1, 0
        [0, -9], //0, -1
        [7, -5], //1, -1
      ];
      const neighbors = getNeighborHexes(this.centerColRow[0], this.centerColRow[1]);
      const label = new THREE.Group();
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
          let buildingType =
            building.resource && (building.resource < 24 || building.resource === ResourcesIds.AncientFragment)
              ? ResourceIdToMiningType[building.resource as ResourcesIds]
              : (BuildingType[building.category].toString() as any);

          if (parseInt(buildingType) === BuildingType.Castle) {
            buildingType = castleLevelToRealmCastle[this.structureStage];
            if (this.tileManager.getWonder()) {
              buildingType = WONDER_REALM;
            }
          }
          if (building.structureType === StructureType.Hyperstructure) {
            buildingType = hyperstructureStageToModel[this.structureStage as StructureProgress];
          }
          const buildingData = this.buildingModels.get(buildingType);

          if (buildingData) {
            const instance = buildingData.model.clone();
            instance.applyMatrix4(building.matrix);
            if (buildingType === ResourceMiningTypes.Forge) {
              instance.traverse((child) => {
                if (child.name === "Grassland003_1" && child instanceof THREE.Mesh) {
                  if (!this.minesMaterials.has(building.resource)) {
                    const material = new THREE.MeshStandardMaterial(MinesMaterialsParams[building.resource]);
                    this.minesMaterials.set(building.resource, material);
                  }
                  child.material = this.minesMaterials.get(building.resource);
                }
              });
            }
            if (buildingType === ResourceMiningTypes.Mine) {
              const crystalMesh1 = instance.children[1] as THREE.Mesh;
              const crystalMesh2 = instance.children[2] as THREE.Mesh;
              if (!this.minesMaterials.has(building.resource)) {
                const material = new THREE.MeshStandardMaterial(MinesMaterialsParams[building.resource]);
                this.minesMaterials.set(building.resource, material);
              }
              // @ts-ignoreq
              crystalMesh1.material = this.minesMaterials.get(building.resource);
              // @ts-ignore
              crystalMesh2.material = this.minesMaterials.get(building.resource);
            }
            this.scene.add(instance);
            this.buildingInstances.set(key, instance);

            // Check if the model has animations and start them
            const animations = buildingData.animations;
            if (animations && animations.length > 0) {
              const mixer = new THREE.AnimationMixer(instance);
              animations.forEach((clip: THREE.AnimationClip) => {
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
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        matrices.forEach((matrix, index) => {
          hexMesh.setMatrixAt(index, matrix);
          this.pillars!.setMatrixAt(index + pillarOffset, matrix);
          this.pillars!.setColorAt(index + pillarOffset, BIOME_COLORS[biome as BiomeType]);
        });
        pillarOffset += matrices.length;
        this.pillars!.count = pillarOffset;
        this.pillars!.computeBoundingSphere();
        hexMesh.setCount(matrices.length);
      }
      this.pillars!.instanceMatrix.needsUpdate = true;
      this.pillars!.instanceColor!.needsUpdate = true;
      this.interactiveHexManager.renderHexes();
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
  }

  computeHexMatrices = (
    radius: number,
    dummy: THREE.Object3D,
    center: number[],
    targetHex: HexPosition,
    isMainHex: boolean,
    existingBuildings: any[],
    biomeHexes: Record<BiomeType, THREE.Matrix4[]>,
  ) => {
    const biome = this.biome.getBiome(targetHex.col, targetHex.row);
    const buildableAreaBiome = "Grassland";
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
        dummy.position.y = isMainHex || isFlat || position.isBorder ? 0 : position.y / 2;
        dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        dummy.updateMatrix();

        this.interactiveHexManager.addHex({ col: position.col, row: position.row });

        let withBuilding = false;
        const building = existingBuildings.find((value) => value.col === position.col && value.row === position.row);
        if (building) {
          withBuilding = true;
          const buildingObj = dummy.clone();
          const rotation = Math.PI / 3;
          buildingObj.rotation.y = rotation * 4;
          if (building.category === BuildingType[BuildingType.Castle]) {
            buildingObj.rotation.y = rotation * 2;
          }
          if (
            BuildingType[building.category as keyof typeof BuildingType] === BuildingType.Resource &&
            ResourceIdToMiningType[building.resource as ResourcesIds] === ResourceMiningTypes.LumberMill
          ) {
            buildingObj.rotation.y = rotation * 2;
          }
          if (
            BuildingType[building.category as keyof typeof BuildingType] === BuildingType.Resource &&
            ResourceIdToMiningType[building.resource as ResourcesIds] === ResourceMiningTypes.Dragonhide
          ) {
            buildingObj.rotation.y = rotation * 2;
          }
          if (
            BuildingType[building.category as keyof typeof BuildingType] === BuildingType.Resource &&
            ResourceIdToMiningType[building.resource as ResourcesIds] === ResourceMiningTypes.Forge
          ) {
            buildingObj.rotation.y = rotation * 6;
          }
          if (building.resource && building.resource === ResourcesIds.Crossbowman) {
            buildingObj.rotation.y = rotation;
          }
          if (building.resource && building.resource === ResourcesIds.Paladin) {
            buildingObj.rotation.y = rotation * 3;
          }
          buildingObj.updateMatrix();
          this.buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
        } else if (isMainHex) {
          this.highlights.push(getHexForWorldPosition(dummy.position));
        }

        if (!withBuilding) {
          biomeHexes[buildableAreaBiome].push(dummy.matrix.clone());
        }
      });
    }

    positions.forEach((position) => {
      dummy.position.x = position.x;
      dummy.position.z = position.z;
      dummy.position.y = isMainHex || isFlat || position.isBorder ? 0 : position.y / 2;
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
      const rotationSeed = this.hashCoordinates(position.col, position.row);
      const rotationIndex = Math.floor(rotationSeed * 6);
      const randomRotation = (rotationIndex * Math.PI) / 3;
      dummy.rotation.y = randomRotation;
      dummy.updateMatrix();
      biomeHexes[biome].push(dummy.matrix.clone());
    });
  };

  computeMainHexMatrices = (
    radius: number,
    dummy: THREE.Object3D,
    center: number[],
    targetHex: HexPosition,
    biomeHexes: Record<BiomeType, THREE.Matrix4[]>,
  ) => {
    const existingBuildings: any[] = this.tileManager.existingBuildings();
    const structureType = this.tileManager.structureType();
    if (structureType) {
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
    dummy: THREE.Object3D,
    center: number[],
    targetHex: HexPosition,
    biomeHexes: Record<BiomeType, THREE.Matrix4[]>,
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
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.buildingMixers.forEach((mixer) => {
      mixer.update(deltaTime);
    });
  }
}
