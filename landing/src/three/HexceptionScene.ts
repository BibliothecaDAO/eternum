import { HexPosition } from "@/types";
import { getNeighborHexes } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { CSS2DObject } from "three-stdlib";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { Biome, BIOME_COLORS, BiomeType } from "./components/Biome";
import { buildingModelPaths, BUILDINGS_CENTER, HEX_SIZE } from "./constants";
import { createHexagonShape } from "./geometry/HexagonGeometry";
import { getWorldPositionForHex, gltfLoader } from "./helpers/utils";
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

export default class HexceptionScene extends HexagonScene {
  private hexceptionRadius = 4;
  private buildingModels: Map<string, { model: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private buildingInstances: Map<string, THREE.Group> = new Map();
  private buildingMixers: Map<string, THREE.AnimationMixer> = new Map();
  private pillars: THREE.InstancedMesh | null = null;
  private buildings: any = []; // Keep empty for landing page
  centerColRow: number[] = [0, 0];
  private biome!: Biome;
  private labels: {
    col: number;
    row: number;
    label: CSS2DObject;
  }[] = [];

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
    this.updateHexceptionGrid(this.hexceptionRadius);
    this.moveCameraToCenter();
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
        const targetHex = { col: center[0], row: center[1] };
        this.computeHexMatrices(radius, dummy, center, targetHex, isMainHex, [], biomeHexes);
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
        2, // Fixed castle level for landing page
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
        biomeHexes[buildableAreaBiome].push(dummy.matrix.clone());
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
