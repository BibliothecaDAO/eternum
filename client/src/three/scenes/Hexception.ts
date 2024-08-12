import * as THREE from "three";

import { TileManager } from "@/dojo/modelManager/TileManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { HexPosition, SceneName } from "@/types";
import { Position } from "@/types/Position";
import { getHexForWorldPosition, pseudoRandom } from "@/ui/utils/utils";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Biome, BiomeType } from "../components/Biome";
import { BuildingPreview } from "../components/BuildingPreview";
import InstancedBuilding from "../components/InstancedBuilding";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { SceneManager } from "../SceneManager";
import {
  buildingModelPaths,
  BUILDINGS_CENTER,
  HEX_HORIZONTAL_SPACING,
  HEX_SIZE,
  HEX_VERTICAL_SPACING,
  structureTypeToBuildingType,
} from "./constants";
import { HexagonScene } from "./HexagonScene";

const loader = new GLTFLoader();
export default class HexceptionScene extends HexagonScene {
  private buildingModels: Map<BuildingType, InstancedBuilding> = new Map();
  private pillars: THREE.InstancedMesh | null = null;
  private buildings: any = [];
  centerColRow: number[] = [0, 0];
  private biome!: Biome;
  private highlights: { col: number; row: number }[] = [];
  private buildingPreview: BuildingPreview | null = null;
  private tileManager: TileManager;

  constructor(
    controls: MapControls,
    dojoContext: SetupResult,
    mouse: THREE.Vector2,
    raycaster: THREE.Raycaster,
    sceneManager: SceneManager,
  ) {
    super(SceneName.Hexception, controls, dojoContext, mouse, raycaster, sceneManager);

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

            const tmp = new InstancedBuilding(model, 50);
            this.buildingModels.set(building as any, tmp);
            this.scene.add(tmp.group);
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

    this.updateHexceptionGrid(4);
  }

  protected onHexagonClick(hexCoords: HexPosition): void {
    const normalizedCoords = { col: BUILDINGS_CENTER[0] - hexCoords.col, row: BUILDINGS_CENTER[1] - hexCoords.row };
    const buildingType = this.buildingPreview?.getPreviewBuilding();
    if (buildingType && !this.tileManager.isHexOccupied(normalizedCoords)) {
      this.tileManager.placeBuilding(buildingType.type, normalizedCoords, buildingType.resource);
      this.clearBuildingMode();
      this.updateHexceptionGrid(4);
    }
  }
  protected onHexagonMouseMove({ position }: { position: THREE.Vector3 }): void {
    this.buildingPreview?.setBuildingPosition(position);
  }
  protected onHexagonDoubleClick(): void {}

  public moveCameraToURLLocation() {
    this.moveCameraToColRow(0, 0, 0);
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
        [-6.5, 7.5], //-1, 1
        [7, 6], //1, 0
        [0.5, 13.5], //0, 1
        [-7, -6], //-1, 0
        [-0.5, -13.5], //0, -1
        [6.5, -7.5], //1, -1
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

      // add buildings to the instance meshes in the center hex
      let counts: Record<string, number> = {};
      for (const building of this.buildings) {
        const buildingMesh = this.buildingModels.get(BuildingType[building.category].toString() as any);
        if (buildingMesh) {
          counts[building.category] = (counts[building.category] || 0) + 1;
          buildingMesh.setMatrixAt(counts[building.category] - 1, building.matrix);
          buildingMesh.setCount(counts[building.category]);
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

    for (let q = -radius; q <= radius; q++) {
      for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        const isBorderHex =
          q === radius || q === -radius || r === Math.max(-radius, -q - radius) || r === Math.min(radius, -q + radius);
        dummy.position.x = (q + r / 2) * HEX_HORIZONTAL_SPACING + center[0] * HEX_HORIZONTAL_SPACING;
        dummy.position.z = r * HEX_VERTICAL_SPACING + center[1] * HEX_SIZE;
        dummy.position.y = isBorderHex || isFlat ? 0 : pseudoRandom(q, r);
        dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
        dummy.updateMatrix();

        const { col, row } = getHexForWorldPosition(dummy.position);
        const normalizedCoords = { col: BUILDINGS_CENTER[0] - col, row: BUILDINGS_CENTER[1] - row };

        let withBuilding = false;
        this.interactiveHexManager.addHex(getHexForWorldPosition(dummy.position));

        const building = existingBuildings.find(
          (value) => value.col === normalizedCoords.col && value.row === normalizedCoords.row,
        );
        if (building) {
          withBuilding = true;
          const buildingObj = dummy.clone();
          const rotation = Math.PI / 3;
          if (building.category === BuildingType[BuildingType.Castle]) {
            buildingObj.rotation.y = rotation * 3;
          } else {
            buildingObj.rotation.y = rotation * 4;
          }
          buildingObj.updateMatrix();
          this.buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
        } else {
          this.highlights.push(getHexForWorldPosition(dummy.position));
        }

        if (!withBuilding) {
          biomeHexes[biome].push(dummy.matrix.clone());
        }
      }
    }
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
}
