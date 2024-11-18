import { HexPosition, ResourceMiningTypes } from "@/types";
import { BuildingType, getNeighborHexes, RealmLevels, ResourcesIds } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { Biome, BIOME_COLORS, BiomeType } from "./components/Biome";
import {
  buildingModelPaths,
  BUILDINGS_CENTER,
  castleLevelToRealmCastle,
  HEX_SIZE,
  MinesMaterialsParams,
} from "./constants";
import { createHexagonShape } from "./geometry/HexagonGeometry";
import { getWorldPositionForHex, gltfLoader, ResourceIdToMiningType } from "./helpers/utils";
import { HexagonScene } from "./HexagonScene";

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

export default class LandingHexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<string, { model: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private buildingInstances: Map<string, THREE.Group> = new Map();
  private buildingMixers: Map<string, THREE.AnimationMixer> = new Map();
  private pillars: THREE.InstancedMesh | null = null;
  private buildings: any = []; // Keep empty for landing page
  centerColRow: number[] = [0, 0];
  castleLevel: RealmLevels = RealmLevels.Settlement;
  private biome!: Biome;
  private minesMaterials: Map<number, THREE.MeshStandardMaterial> = new Map();

  constructor(controls: MapControls) {
    super(controls);

    this.biome = new Biome();

    const pillarGeometry = new THREE.ExtrudeGeometry(createHexagonShape(1), { depth: 2, bevelEnabled: false });
    pillarGeometry.rotateX(Math.PI / 2);
    this.pillars = new THREE.InstancedMesh(pillarGeometry, new THREE.MeshStandardMaterial(), 1000);
    this.pillars.position.y = 0.05;
    this.pillars.count = 0;
    this.scene.add(this.pillars);

    this.loadBuildingModels();
    this.loadBiomeModels(900);

    this.setup();

    this.controls.maxDistance = 18;
    this.controls.enablePan = false;
    this.controls.zoomToCursor = false;
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
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            this.buildingModels.set(building, { model, animations: gltf.animations });
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

  setup() {
    this.centerColRow = [Math.floor(Math.random() * 1001) - 500, Math.floor(Math.random() * 1001) - 500];

    // Randomly select castle level (0-3)
    const randomCastleLevel = Math.floor(Math.random() * 4);
    this.castleLevel = randomCastleLevel;

    this.updateHexceptionGrid(this.hexceptionRadius);
    this.moveCameraToCenter();
  }

  private generateRandomBuildings() {
    // Clear existing buildings
    const buildings = [];

    const mainBuilding = Math.random() < 0.05 ? BuildingType.Bank : BuildingType.Castle;
    buildings.push({
      col: BUILDINGS_CENTER[0],
      row: BUILDINGS_CENTER[1],
      category: BuildingType[mainBuilding],
      resource: undefined,
      paused: false,
    });

    // Generate 3-7 random buildings

    // Get buildable positions (excluding center castle position)
    const buildablePositions = generateHexPositions(
      { col: BUILDINGS_CENTER[0], row: BUILDINGS_CENTER[1] },
      this.castleLevel + 1,
    ).filter((pos) => !(pos.col === BUILDINGS_CENTER[0] && pos.row === BUILDINGS_CENTER[1]));

    const numBuildings = Math.floor(Math.random() * (buildablePositions.length - 3)) + 3; // Random number between 3 and buildablePositions.length

    // Available building types for random selection
    const availableBuildingTypes = [
      BuildingType.Resource,
      BuildingType.Farm,
      BuildingType.FishingVillage,
      BuildingType.Barracks,
      BuildingType.Market,
      BuildingType.ArcheryRange,
      BuildingType.Stable,
      BuildingType.WorkersHut,
      BuildingType.Storehouse,
    ];

    // Available resources for Resource buildings
    const availableResources = [
      ResourcesIds.Wood,
      ResourcesIds.Stone,
      ResourcesIds.Coal,
      ResourcesIds.Copper,
      ResourcesIds.Ironwood,
      ResourcesIds.Obsidian,
      ResourcesIds.Gold,
      ResourcesIds.Silver,
      ResourcesIds.Mithral,
      ResourcesIds.AlchemicalSilver,
      ResourcesIds.ColdIron,
      ResourcesIds.DeepCrystal,
      ResourcesIds.Ruby,
      ResourcesIds.Diamonds,
      ResourcesIds.Hartwood,
      ResourcesIds.Ignium,
      ResourcesIds.TwilightQuartz,
      ResourcesIds.TrueIce,
      ResourcesIds.Adamantine,
      ResourcesIds.Sapphire,
      ResourcesIds.EtherealSilica,
    ];

    // Randomly place buildings
    const usedPositions = new Set();

    for (let i = 0; i < Math.min(numBuildings, buildablePositions.length); i++) {
      let randomPositionIndex;
      let position;

      // Ensure unique positions are selected
      do {
        randomPositionIndex = Math.floor(Math.random() * buildablePositions.length);
        position = buildablePositions[randomPositionIndex];
      } while (usedPositions.has(`${position.col},${position.row}`));

      usedPositions.add(`${position.col},${position.row}`);

      const randomBuildingType = availableBuildingTypes[Math.floor(Math.random() * availableBuildingTypes.length)];
      let randomResource = undefined;
      if (randomBuildingType === BuildingType.Resource) {
        randomResource = availableResources[Math.floor(Math.random() * availableResources.length)];
      }
      if (randomBuildingType === BuildingType.Farm) {
        randomResource = ResourcesIds.Wheat;
      }
      if (randomBuildingType === BuildingType.FishingVillage) {
        randomResource = ResourcesIds.Fish;
      }

      buildings.push({
        col: position.col,
        row: position.row,
        category: BuildingType[randomBuildingType],
        resource: randomResource,
        paused: false,
      });
    }

    return buildings;
  }

  public moveCameraToCenter() {
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
      const centers = [
        [0, 0], // 0, 0 (Main hex)
        [-6, 5], // -1, 1
        [7, 4], // 1, 0
        [1, 9], // 0, 1
        [-7, -4], // -1, 0
        [0, -9], // 0, -1
        [7, -5], // 1, -1
      ];

      // Compute matrices for each hex
      for (const center of centers) {
        const isMainHex = center[0] === 0 && center[1] === 0;
        const targetHex = { col: center[0] + this.centerColRow[0], row: center[1] + this.centerColRow[1] };
        this.computeHexMatrices(
          radius,
          dummy,
          center,
          targetHex,
          isMainHex,
          this.generateRandomBuildings(),
          biomeHexes,
        );
      }

      // Add buildings to the scene
      for (const building of this.buildings) {
        const key = `${building.col},${building.row}`;
        if (!this.buildingInstances.has(key)) {
          let buildingType =
            building.resource && (building.resource < 24 || building.resource === ResourcesIds.AncientFragment)
              ? ResourceIdToMiningType[building.resource as ResourcesIds]
              : (BuildingType[building.category].toString() as any);

          if (parseInt(buildingType) === BuildingType.Castle) {
            buildingType = castleLevelToRealmCastle[this.castleLevel];
          }
          const buildingData = this.buildingModels.get(buildingType);

          if (buildingData) {
            const instance = buildingData.model.clone();
            console.log("building", building);
            instance.applyMatrix4(building.matrix);
            if (buildingType === ResourceMiningTypes.Forge) {
              instance.traverse((child) => {
                if (child.name === "Grassland003_8" && child instanceof THREE.Mesh) {
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
      }

      // Update biome meshes
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
    const biome = this.biome.getBiome(targetHex.col, targetHex.row);
    const buildableAreaBiome = "Grassland";
    const isFlat = biome === "Ocean" || biome === "DeepOcean" || isMainHex;

    let positions = generateHexPositions(
      { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
      radius,
    );

    if (isMainHex) {
      const buildablePositions = generateHexPositions(
        { col: center[0] + BUILDINGS_CENTER[0], row: center[1] + BUILDINGS_CENTER[1] },
        this.castleLevel + 1,
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

        const building = existingBuildings.find((value) => value.col === position.col && value.row === position.row);
        if (building) {
          // If there's a building, scale the biome hex to zero
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
        }
        biomeHexes[buildableAreaBiome].push(dummy.matrix.clone());

        if (building) {
          const buildingObj = dummy.clone();
          const rotation = Math.PI / 3;
          buildingObj.scale.set(HEX_SIZE, HEX_SIZE, HEX_SIZE);
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

  // Add this helper method if not already present in base class
  private hashCoordinates(x: number, y: number): number {
    const str = `${x},${y}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) / 2147483647;
  }

  update(deltaTime: number) {
    super.update(deltaTime);
    this.buildingMixers.forEach((mixer) => {
      mixer.update(deltaTime);
    });
  }
}
