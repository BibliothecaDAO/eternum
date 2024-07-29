import * as THREE from "three";

import { getEntityIdFromKeys, snoise } from "@dojoengine/utils";
import { SetupResult } from "@/dojo/setup";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeStore } from "@/hooks/store/useThreeStore";
import { LocationManager } from "../helpers/LocationManager";
import { BuildingType, getNeighborHexes } from "@bibliothecadao/eternum";
import InstancedModel from "../components/InstancedModel";
import { getComponentValue, getEntitiesWithValue } from "@dojoengine/recs";
import { biomeModelPaths } from "./Worldmap";
import { Biome, BiomeType } from "../components/Biome";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { pseudoRandom } from "@/ui/utils/utils";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import { FELT_CENTER } from "@/ui/config";
import InstancedBuilding from "../components/InstancedBuilding";
import { HEX_HORIZONTAL_SPACING, HEX_SIZE } from "../GameRenderer";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { MapControls } from "three/examples/jsm/controls/MapControls";

const buildingModelPaths: Record<BuildingType, string> = {
  [BuildingType.Bank]: "/models/buildings/bank.glb",
  [BuildingType.ArcheryRange]: "/models/buildings/archer_range.glb",
  [BuildingType.Barracks]: "/models/buildings/barracks.glb",
  [BuildingType.Castle]: "/models/buildings/castle2.glb",
  [BuildingType.DonkeyFarm]: "/models/buildings/stable.glb",
  [BuildingType.Farm]: "/models/buildings/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings/farm.glb",
  [BuildingType.FragmentMine]: "/models/buildings/mine.glb",
  [BuildingType.Market]: "/models/buildings/market.glb",
  [BuildingType.Resource]: "/models/buildings/mine.glb",
  [BuildingType.Stable]: "/models/buildings/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings/market.glb",
  [BuildingType.Walls]: "/models/buildings/market.glb",
  [BuildingType.WatchTower]: "/models/buildings/market.glb",
  [BuildingType.WorkersHut]: "/models/buildings/stable.glb",
};

const loader = new GLTFLoader();
export default class HexceptionScene {
  scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private dojo: SetupResult;
  private pmremGenerator: THREE.PMREMGenerator;

  private hexInstanced!: THREE.InstancedMesh | null;
  private buildingModel!: THREE.Object3D | null;

  private hoverBuilding: THREE.Object3D | null = null;

  private locationManager!: LocationManager;

  private originalColor: THREE.Color = new THREE.Color("white");

  private buildingModels: Map<BuildingType, InstancedBuilding> = new Map();

  private modelLoadPromises: Promise<void>[] = [];

  private biomeModels: Map<BiomeType, InstancedModel> = new Map();

  private pillars: THREE.InstancedMesh | null = null;

  private buildings: any = [];

  centerColRow: number[] = [0, 0];

  private biome!: Biome;

  private labelRenderer: CSS2DRenderer | null = null;

  constructor(
    private state: ThreeStore,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    dojoContext: SetupResult,
    private mouse: THREE.Vector2,
    private raycaster: THREE.Raycaster,
  ) {
    this.renderer = renderer;
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0px";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    document.body.appendChild(this.labelRenderer.domElement);
    this.camera = camera;
    this.dojo = dojoContext;
    this.biome = new Biome();
    this.scene = new THREE.Scene();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.locationManager = new LocationManager();

    const pillarGeometry = new THREE.ExtrudeGeometry(createHexagonShape(1), { depth: 2, bevelEnabled: false });
    pillarGeometry.rotateX(Math.PI / 2);
    this.pillars = new THREE.InstancedMesh(pillarGeometry, new THREE.MeshStandardMaterial({ color: 0xffce31 }), 1000);
    this.pillars.position.y = 0.05;
    this.pillars.count = 0;
    this.scene.add(this.pillars);

    this.loadBuildingModels();
    this.loadBiomeModels();

    this.setup(0, 0);
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

  private loadBiomeModels() {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
    dracoLoader.preload();
    loader.setDRACOLoader(dracoLoader);

    for (const [biome, path] of Object.entries(biomeModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            model.position.set(0, 0, 0);
            model.rotation.y = Math.PI;

            model.scale.set(0.1, 0.1, 0.1);

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            const tmp = new InstancedModel(model, 900);
            this.biomeModels.set(biome as BiomeType, tmp);
            this.scene.add(tmp.group);
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Error loading ${biome} model:`, error);
            reject(error);
          },
        );
      });
      this.modelLoadPromises.push(loadPromise);
    }

    Promise.all(this.modelLoadPromises).then(() => {
      //this.updateExistingChunks();
    });
  }

  setup(row: number, col: number) {
    console.log("clickedHex", row, col);
    console.log(this.locationManager.getCol(), this.locationManager.getRow());
    this.centerColRow = [col + FELT_CENTER, row + FELT_CENTER];
    // this.updateHexagonGrid(3, 3);
    this.updateHexceptionGrid(4);
  }

  getCenterColRow() {
    return [this.centerColRow[0] - FELT_CENTER, this.centerColRow[1] - FELT_CENTER];
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
      [BuildingType.DonkeyFarm]: [],
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
      const BUILDINGS_CENTER = [10, 10];
      const buildings = [];
      const neighbors = getNeighborHexes(this.centerColRow[0], this.centerColRow[1]);
      const label = new THREE.Group();
      this.scene.add(label);
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
            dummy.position.z = ((r * 3) / 2) * HEX_SIZE + centers[center][1] * HEX_SIZE;
            dummy.position.y = isBorderHex || isMainHex ? 0 : pseudoRandom(q, r);
            dummy.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
            dummy.updateMatrix();

            // const posDiv = document.createElement("div");
            // posDiv.className = "label";
            // posDiv.textContent = `${BUILDINGS_CENTER[0] - q}, ${BUILDINGS_CENTER[1] - r}`;
            // posDiv.style.backgroundColor = "transparent";

            // const posLabel = new CSS2DObject(posDiv);
            // moonLabel.position.set(dummy.position.x, dummy.position.y + 0.5, dummy.position.z);
            // posLabel.center.set(0, 1);
            // label.add(posLabel);

            let withBuilding = false;
            if (isMainHex) {
              const isCenter = q === 0 && r === 0;
              const building = isCenter
                ? { category: "Castle" }
                : getComponentValue(
                    this.dojo.components.Building,
                    getEntityIdFromKeys([
                      BigInt(this.centerColRow[0]),
                      BigInt(this.centerColRow[1]),
                      BigInt(BUILDINGS_CENTER[0] - q),
                      BigInt(BUILDINGS_CENTER[1] - r),
                    ]),
                  );
              if (building) {
                withBuilding = true;
                const buildingObj = dummy.clone();
                const randomRotation = (4 * Math.PI) / 3;
                buildingObj.rotation.y = randomRotation;
                buildingObj.updateMatrix();
                buildings.push({ ...building, matrix: buildingObj.matrix.clone() });
              }
            }

            const targetHex = isMainHex
              ? [this.centerColRow[0], this.centerColRow[1]]
              : [neighbors[Number(center) - 1].col, neighbors[Number(center) - 1].row];
            const biome = isMainHex ? "Grassland" : this.biome.getBiome(targetHex[0], targetHex[1]);
            if (!withBuilding) {
              biomeHexes[biome].push(dummy.matrix.clone());
            }

            //   const buildingDummy = dummy.clone();
            //   buildingDummy.scale.set(0.05, 0.05, 0.05); // Adjust these values as needed
            //   buildingDummy.position.y += 0.02; // Raise the building slightly above the hex
            //   buildingDummy.updateMatrix();
            //   buildingHexes[BuildingType.ArcheryRange].push(buildingDummy.matrix.clone());
          }
        }
      }

      this.buildings = buildings;
      console.log(this.buildings);
      let counts: Record<string, number> = {};
      //const color = new THREE.Color(0xff0000);
      for (const building of this.buildings) {
        const buildingMesh = this.buildingModels.get(BuildingType[building.category].toString() as any);
        //console.log(building.matrix?.scale?.set(0.1, 0.1, 0.1));
        if (buildingMesh) {
          counts[building.category] = (counts[building.category] || 0) + 1;
          console.log("counts", counts[building.category]);
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
      console.log("Hexagon grid updated");
    });
  }

  update(deltaTime: number) {
    this.labelRenderer?.render(this.scene, this.camera);
  }
  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
}
