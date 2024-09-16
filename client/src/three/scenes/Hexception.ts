import * as THREE from "three";

import { TileManager } from "@/dojo/modelManager/TileManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { HexPosition, SceneName } from "@/types";
import { Position } from "@/types/Position";
import { View } from "@/ui/modules/navigation/LeftNavigationModule";
import { getHexForWorldPosition, getWorldPositionForHex } from "@/ui/utils/utils";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Biome, BiomeType } from "../components/Biome";
import { BuildingPreview } from "../components/BuildingPreview";
import { LAND_NAME, SMALL_DETAILS_NAME } from "../components/InstancedModel";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { SceneManager } from "../SceneManager";
import { BuildingSystemUpdate } from "../systems/types";
import { buildingModelPaths, BUILDINGS_CENTER, HEX_SIZE, structureTypeToBuildingType } from "./constants";
import { HexagonScene } from "./HexagonScene";

const loader = new GLTFLoader();

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

export default class HexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<BuildingType, { model: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private buildingInstances: Map<string, THREE.Group> = new Map();
  private buildingMixers: Map<string, THREE.AnimationMixer> = new Map();
  private pillars: THREE.InstancedMesh | null = null;
  private buildings: any = [];
  centerColRow: number[] = [0, 0];
  private biome!: Biome;
  private highlights: { col: number; row: number }[] = [];
  private buildingPreview: BuildingPreview | null = null;
  private tileManager: TileManager;
  private subscription: any;
  private buildingInstanceIds: Map<string, { index: number; category: string }> = new Map();

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
    this.pillars = new THREE.InstancedMesh(pillarGeometry, new THREE.MeshStandardMaterial({ color: 0xffce31 }), 1000);
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
                }
                if (child.name.includes(LAND_NAME) || child.parent?.name.includes(LAND_NAME)) {
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
    this.subscription?.unsubscribe();
    this.subscription = this.systemManager.Buildings.subscribeToHexUpdates(
      { col: this.centerColRow[0], row: this.centerColRow[1] },
      (update: BuildingSystemUpdate) => {
        const { innerCol, innerRow, buildingType } = update;
        if (buildingType === BuildingType[BuildingType.None] && innerCol && innerRow) {
          this.removeBuilding(innerCol, innerRow);
        }
        this.updateHexceptionGrid(this.hexceptionRadius);
      },
    );

    this.updateHexceptionGrid(this.hexceptionRadius);
    this.controls.maxDistance = 18;
    this.controls.enablePan = false;
    this.controls.zoomToCursor = false;

    this.moveCameraToURLLocation();
  }

  protected onHexagonClick(hexCoords: HexPosition | null): void {
    if (hexCoords === null) return;
    const normalizedCoords = { col: hexCoords.col, row: hexCoords.row };
    const buildingType = this.buildingPreview?.getPreviewBuilding();
    if (buildingType) {
      // if building mode
      if (!this.tileManager.isHexOccupied(normalizedCoords)) {
        this.tileManager.placeBuilding(buildingType.type, normalizedCoords, buildingType.resource);
        this.clearBuildingMode();
        this.updateHexceptionGrid(this.hexceptionRadius);
      }
    } else {
      // if not building mode
      const { col: outerCol, row: outerRow } = this.tileManager.getHexCoords();
      if (this.tileManager.isHexOccupied(normalizedCoords)) {
        this.state.setSelectedBuildingHex({
          outerCol,
          outerRow,
          innerCol: normalizedCoords.col,
          innerRow: normalizedCoords.row,
        });
        this.state.setLeftNavigationView(View.EntityView);
      }
    }
  }
  protected onHexagonMouseMove(hex: { position: THREE.Vector3; hexCoords: HexPosition } | null): void {
    if (hex === null) return;
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
  }
  protected onHexagonRightClick(): void {}
  protected onHexagonDoubleClick(): void {}

  public moveCameraToURLLocation() {
    this.moveCameraToColRow(10, 10, 0);
  }

  updateHexceptionGrid(radius: number) {
    const dummy = new THREE.Object3D();
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
          const buildingData = this.buildingModels.get(BuildingType[building.category].toString() as any);
          if (buildingData) {
            const instance = buildingData.model.clone();
            instance.applyMatrix4(building.matrix);
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
      }

      // update neighbor hexes around the center hex
      let i = 0;
      const tmpCol = new THREE.Color(0xffce31);
      for (const [biome, matrices] of Object.entries(biomeHexes)) {
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        matrices.forEach((matrix, index) => {
          hexMesh.setMatrixAt(index, matrix);
          this.pillars!.setMatrixAt(index + i, matrix);
          this.pillars!.setColorAt(index + i, tmpCol);
        });
        this.pillars!.count = i + matrices.length;
        this.pillars!.instanceMatrix.needsUpdate = true;
        this.pillars!.computeBoundingSphere();
        hexMesh.setCount(matrices.length);
        i += matrices.length;
      }

      this.interactiveHexManager.renderHexes();
    });
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
    const biome = existingBuildings.length === 0 ? this.biome.getBiome(targetHex.col, targetHex.row) : "Grassland";
    const isFlat = biome === "Ocean" || biome === "DeepOcean" || isMainHex;

    // reset buildings
    if (isMainHex) {
      this.buildings = [];
    }

    const positions = generateHexPositions(
      { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
      radius,
    );

    const label = new THREE.Group();
    this.scene.add(label);

    positions.forEach((position) => {
      dummy.position.x = position.x;
      dummy.position.z = position.z;
      dummy.position.y = isMainHex || isFlat || position.isBorder ? 0 : position.y / 2;
      dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
      dummy.updateMatrix();
      if (isMainHex) {
        this.interactiveHexManager.addHex({ col: position.col, row: position.row });
      }
      let withBuilding = false;
      const building = existingBuildings.find((value) => value.col === position.col && value.row === position.row);
      if (building) {
        withBuilding = true;
        const buildingObj = dummy.clone();
        const rotation = Math.PI / 3;
        if (building.category === BuildingType[BuildingType.Castle]) {
          buildingObj.rotation.y = rotation * 2;
        } else {
          buildingObj.rotation.y = rotation * 4;
        }
        buildingObj.updateMatrix();
        this.buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
      } else if (isMainHex) {
        this.highlights.push(getHexForWorldPosition(dummy.position));
      }

      if (!withBuilding) {
        biomeHexes[biome].push(dummy.matrix.clone());
      }
    });
  };

  computeMainHexMatrices = (
    radius: number,
    dummy: THREE.Object3D,
    center: number[],
    targetHex: HexPosition,
    biomeHexes: Record<BiomeType, THREE.Matrix4[]>,
  ) => {
    const existingBuildings = this.tileManager.existingBuildings();
    const structureType = this.tileManager.structureType();
    if (structureType) {
      existingBuildings.push({
        col: BUILDINGS_CENTER[0],
        row: BUILDINGS_CENTER[1],
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
