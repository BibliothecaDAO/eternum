import * as THREE from "three";

import { BUILDINGS_CENTER, TileManager } from "@/dojo/modelManager/TileManager";
import { SetupResult } from "@/dojo/setup";
import useUIStore from "@/hooks/store/useUIStore";
import { HexPosition, SceneName } from "@/types";
import { FELT_CENTER } from "@/ui/config";
import { getHexForWorldPosition, pseudoRandom } from "@/ui/utils/utils";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import { MapControls } from "three/examples/jsm/controls/MapControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Biome, BiomeType } from "../components/Biome";
import { BuildingPreview } from "../components/BuildingPreview";
import InstancedBuilding from "../components/InstancedBuilding";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { SceneManager } from "../SceneManager";
import { HEX_HORIZONTAL_SPACING, HEX_SIZE, HEX_VERTICAL_SPACING, HexagonScene } from "./HexagonScene";

export const buildingModelPaths: Record<BuildingType, string> = {
  [BuildingType.Bank]: "/models/buildings/bank.glb",
  [BuildingType.ArcheryRange]: "/models/buildings/archer_range.glb",
  [BuildingType.Barracks]: "/models/buildings/barracks.glb",
  [BuildingType.Castle]: "/models/buildings/castle2.glb",
  [BuildingType.Farm]: "/models/buildings/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings/fishery.glb",
  [BuildingType.FragmentMine]: "/models/buildings/mine.glb",
  [BuildingType.Market]: "/models/buildings/market.glb",
  [BuildingType.Resource]: "/models/buildings/mine.glb",
  [BuildingType.Stable]: "/models/buildings/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings/market.glb",
  [BuildingType.Walls]: "/models/buildings/market.glb",
  [BuildingType.WatchTower]: "/models/buildings/market.glb",
  [BuildingType.WorkersHut]: "/models/buildings/workers_hut.glb",
};

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

    this.setup({ col: 0, row: 0 });

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

  setup(hexCoords: HexPosition) {
    const { col, row } = hexCoords;
    this.locationManager.addRowColToQueryString(row, col);
    this.moveCameraToColRow(0, 0, 0);
    this.centerColRow = [this.locationManager.getCol()! + FELT_CENTER, this.locationManager.getRow()! + FELT_CENTER];

    this.tileManager.setTile(hexCoords);

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
  protected onHexagonMouseMove(hoveredHex: { col: number; row: number; x: number; z: number }): void {
    this.buildingPreview?.setBuildingPosition(new THREE.Vector3(hoveredHex.x, 0, hoveredHex.z));
  }
  protected onHexagonDoubleClick(hexCoords: HexPosition): void {}

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

    const buildingHexes: Record<BuildingType, THREE.Matrix4[]> = {
      [BuildingType.Bank]: [],
      [BuildingType.ArcheryRange]: [],
      [BuildingType.Barracks]: [],
      [BuildingType.Castle]: [],
      [BuildingType.Farm]: [],
      [BuildingType.FishingVillage]: [],
      [BuildingType.FragmentMine]: [],
      [BuildingType.Market]: [],
      [BuildingType.Resource]: [],
      [BuildingType.Stable]: [],
      [BuildingType.Storehouse]: [],
      [BuildingType.TradingPost]: [],
      [BuildingType.Walls]: [],
      [BuildingType.WatchTower]: [],
      [BuildingType.WorkersHut]: [],
    };

    const hexPositions: THREE.Vector3[] = [];
    Promise.all(this.modelLoadPromises).then(() => {
      let centers = [
        [0, 0], //0, 0
        [-6.5, 7.5], //-1, 1
        [7, 6], //1, 0
        [0.5, 13.5], //0, 1
        [-7, -6], //-1, 0
        [-0.5, -13.5], //0, -1
        [6.5, -7.5], //1, -1
      ];
      const buildings = [];
      const existingBuildings = this.tileManager.existingBuildings();
      const neighbors = getNeighborHexes(this.centerColRow[0], this.centerColRow[1]);
      const label = new THREE.Group();
      this.scene.add(label);
      this.highlights = [];
      for (const center in centers) {
        const isMainHex = centers[center][0] === 0 && centers[center][1] === 0;
        for (let q = -radius; q <= radius; q++) {
          for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
            const s = -q - r;
            const isBorderHex =
              q === radius ||
              q === -radius ||
              r === Math.max(-radius, -q - radius) ||
              r === Math.min(radius, -q + radius);
            dummy.position.x = (q + r / 2) * HEX_HORIZONTAL_SPACING + centers[center][0] * HEX_HORIZONTAL_SPACING;
            dummy.position.z = r * HEX_VERTICAL_SPACING + centers[center][1] * HEX_SIZE;
            dummy.position.y = isBorderHex || isMainHex ? 0 : pseudoRandom(q, r);
            dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
            dummy.updateMatrix();

            const { col, row } = getHexForWorldPosition(dummy.position);
            const normalizedCoords = { col: BUILDINGS_CENTER[0] - col, row: BUILDINGS_CENTER[1] - row };

            // if (isMainHex) {
            //   const posDiv = document.createElement("div");
            //   posDiv.className = "label";
            //   posDiv.textContent = `${normalizedCoords.col}, ${normalizedCoords.row}`;
            //   posDiv.style.backgroundColor = "transparent";

            //   const posLabel = new CSS2DObject(posDiv);
            //   posLabel.position.set(dummy.position.x, dummy.position.y, dummy.position.z);
            //   posLabel.center.set(0, 1);
            //   label.add(posLabel);
            // }

            let withBuilding = false;
            if (isMainHex) {
              this.interactiveHexManager.addHex(getHexForWorldPosition(dummy.position));
              //highlights.push({ col: q + r / 2, row: r });
              // const isCenter = q === 0 && r === 0;
              // const building = isCenter
              //   ? { category: "Castle" }
              //   : getComponentValue(
              //       this.dojo.components.Building,
              //       getEntityIdFromKeys([
              //         BigInt(this.centerColRow[0]),
              //         BigInt(this.centerColRow[1]),
              //         BigInt(BUILDINGS_CENTER[0] - q),
              //         BigInt(BUILDINGS_CENTER[1] - r),
              //       ]),
              //     );
              const building = existingBuildings.find(
                (value) => value.col === normalizedCoords.col && value.row === normalizedCoords.row,
              );
              if (building) {
                withBuilding = true;
                const buildingObj = dummy.clone();
                const rotation = Math.PI / 3;
                if (building.category === "Castle") {
                  buildingObj.rotation.y = rotation * 3;
                } else {
                  buildingObj.rotation.y = rotation * 4;
                }
                buildingObj.updateMatrix();
                buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
              } else {
                this.highlights.push(getHexForWorldPosition(dummy.position));
              }
            }

            const targetHex = isMainHex
              ? [this.centerColRow[0], this.centerColRow[1]]
              : [neighbors[Number(center) - 1].col, neighbors[Number(center) - 1].row];
            const biome = isMainHex ? "Grassland" : this.biome.getBiome(targetHex[0], targetHex[1]);
            if (!withBuilding) {
              biomeHexes[biome].push(dummy.matrix.clone());
            }
          }
        }
      }

      this.buildings = buildings;
      let counts: Record<string, number> = {};
      //const color = new THREE.Color(0xff0000);
      for (const building of this.buildings) {
        const buildingMesh = this.buildingModels.get(BuildingType[building.category].toString() as any);
        if (buildingMesh) {
          counts[building.category] = (counts[building.category] || 0) + 1;
          buildingMesh.setMatrixAt(counts[building.category] - 1, building.matrix);
          buildingMesh.setCount(counts[building.category]);
        }
      }

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

      //   for (const [buildingType, matrices] of Object.entries(buildingHexes)) {
      //     const buildingMesh = this.buildingModels.get(buildingType as any);
      //     if (buildingMesh && matrices.length > 0) {
      //       matrices.forEach((matrix, index) => {
      //         buildingMesh.setMatrixAt(index, matrix);
      //       });
      //       buildingMesh.setCount(matrices.length);
      //     }
      //   }
      this.interactiveHexManager.renderHexes();
    });
  }
}
