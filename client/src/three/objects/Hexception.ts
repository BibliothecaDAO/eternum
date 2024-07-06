import * as THREE from "three";

import { getEntityIdFromKeys, snoise } from "@dojoengine/utils";
import { SetupResult } from "@/dojo/setup";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeStore } from "@/hooks/store/useThreeStore";
import { LocationManager } from "../helpers/LocationManager";
import { BuildingType } from "@bibliothecadao/eternum";
import InstancedModel from "../components/InstancedModel";
import { getComponentValue } from "@dojoengine/recs";
import { biomeModelPaths } from "./HexagonMap";
import { BiomeType } from "../components/Biome";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const buildingModelPaths: Record<BuildingType, string> = {
  [BuildingType.Bank]: "/models/buildings/bank.glb",
  [BuildingType.ArcheryRange]: "/models/buildings/archer_range.glb",
  [BuildingType.Barracks]: "/models/buildings/barracks.glb",
  [BuildingType.Castle]: "/models/buildings/castle.glb",
  [BuildingType.DonkeyFarm]: "/models/buildings/castle.glb",
  [BuildingType.Farm]: "/models/buildings/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings/fishery.glb",
  [BuildingType.FragmentMine]: "/models/buildings/mine.glb",
  [BuildingType.Market]: "/models/buildings/market.glb",
  [BuildingType.Resource]: "/models/buildings/market.glb",
  [BuildingType.Stable]: "/models/buildings/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings/market.glb",
  [BuildingType.Walls]: "/models/buildings/market.glb",
  [BuildingType.WatchTower]: "/models/buildings/market.glb",
  [BuildingType.WorkersHut]: "/models/buildings/workers_hut.glb",
};

const loader = new GLTFLoader();

export default class DetailedHexScene {
  scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private dojo: SetupResult;

  private hexInstanced!: THREE.InstancedMesh | null;
  private buildingModel!: THREE.Object3D | null;

  private hoverBuilding: THREE.Object3D | null = null;

  private locationManager!: LocationManager;

  private hexSize = 0.4;
  private originalColor: THREE.Color = new THREE.Color("white");

  private buildingModels: Map<BuildingType, InstancedModel> = new Map();
  private modelLoadPromises: Promise<void>[] = [];

  private biomeModels: Map<BiomeType, InstancedModel> = new Map();

  constructor(
    private state: ThreeStore,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    dojoContext: SetupResult,
    private mouse: THREE.Vector2,
    private raycaster: THREE.Raycaster,
  ) {
    this.renderer = renderer;
    this.camera = camera;
    this.dojo = dojoContext;
    this.scene = new THREE.Scene();

    this.locationManager = new LocationManager();

    // this.loadBuildingModels();
    this.loadBiomeModels();
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

            model.scale.set(0.1, 0.1, 0.1);

            model.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            const tmp = new InstancedModel(model, 250);
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
            const tmp = new InstancedModel(model, 250);
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

    // this.updateHexagonGrid(3, 3);
    this.updateBiomeHexagonGrid(3);
    this.addLights();
  }

  //   updateHexagonGrid(rows: number, cols: number) {
  //     const horizontalSpacing = this.hexSize * Math.sqrt(3);
  //     const verticalSpacing = (this.hexSize * 3) / 2;

  //     const dummy = new THREE.Object3D();
  //     const buildingHexes: Record<BuildingType, THREE.Matrix4[]> = {
  //       [BuildingType.Bank]: [],
  //       [BuildingType.ArcheryRange]: [],
  //       [BuildingType.Barracks]: [],
  //       [BuildingType.Castle]: [],
  //       [BuildingType.DonkeyFarm]: [],
  //       [BuildingType.Farm]: [],
  //       [BuildingType.FishingVillage]: [],
  //       [BuildingType.FragmentMine]: [],
  //       [BuildingType.Market]: [],
  //       [BuildingType.Resource]: [],
  //       [BuildingType.Stable]: [],
  //       [BuildingType.Storehouse]: [],
  //       [BuildingType.TradingPost]: [],
  //       [BuildingType.Walls]: [],
  //       [BuildingType.WatchTower]: [],
  //       [BuildingType.WorkersHut]: [],
  //     };

  //     Promise.all(this.modelLoadPromises).then(() => {
  //       for (let row = -rows / 2; row < rows / 2; row++) {
  //         for (let col = -cols / 2; col < cols / 2; col++) {
  //           dummy.position.x = col * horizontalSpacing + (row % 2) * (horizontalSpacing / 2);
  //           dummy.position.z = -row * verticalSpacing;
  //           dummy.position.y = 0;
  //           dummy.scale.set(this.hexSize, this.hexSize, this.hexSize);

  //           const building = getComponentValue(this.dojo.components.Building, getEntityIdFromKeys([BigInt(0)]));

  //           dummy.updateMatrix();

  //           buildingHexes[BuildingType.ArcheryRange].push(dummy.matrix.clone());
  //         }
  //       }
  //       for (const [biome, matrices] of Object.entries(buildingHexes)) {
  //         const hexMesh = this.buildingModels.get(biome as any)!;
  //         matrices.forEach((matrix, index) => {
  //           hexMesh.setMatrixAt(index, matrix);
  //         });
  //         hexMesh.setCount(matrices.length);
  //         console.log("updating");
  //       }
  //     });
  //   }

  updateBiomeHexagonGrid(radius: number) {
    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = (this.hexSize * 3) / 2;

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
      for (let q = -radius; q <= radius; q++) {
        for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
          const s = -q - r;

          dummy.position.x = (q + r / 2) * horizontalSpacing;
          dummy.position.z = ((r * 3) / 2) * this.hexSize;
          dummy.position.y = 0;
          dummy.scale.set(this.hexSize, this.hexSize, this.hexSize);

          const building = getComponentValue(this.dojo.components.Building, getEntityIdFromKeys([BigInt(0)]));

          dummy.updateMatrix();
          biomeHexes["Bare"].push(dummy.matrix.clone());

          //   const buildingDummy = dummy.clone();
          //   buildingDummy.scale.set(0.05, 0.05, 0.05); // Adjust these values as needed
          //   buildingDummy.position.y += 0.02; // Raise the building slightly above the hex
          //   buildingDummy.updateMatrix();
          //   buildingHexes[BuildingType.ArcheryRange].push(buildingDummy.matrix.clone());
        }
      }

      for (const [biome, matrices] of Object.entries(biomeHexes)) {
        const hexMesh = this.biomeModels.get(biome as BiomeType)!;
        matrices.forEach((matrix, index) => {
          hexMesh.setMatrixAt(index, matrix);
        });
        hexMesh.setCount(matrices.length);
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

  private addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
}
