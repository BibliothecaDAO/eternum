import * as THREE from "three";

import { snoise } from "@dojoengine/utils";
import { SetupResult } from "@/dojo/setup";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ThreeStore } from "@/hooks/store/useThreeStore";
import { LocationManager } from "../helpers/LocationManager";
import { BuildingType } from "@bibliothecadao/eternum";
import InstancedModel from "../components/InstancedModel";

const buildingModelPaths: Record<BuildingType, string> = {
  [BuildingType.Bank]: "/models/buildings/bank.glb",
  [BuildingType.ArcheryRange]: "/models/buildings/archer_range.glb",
  [BuildingType.Barracks]: "/models/buildings/barracks.glb",
  [BuildingType.Castle]: "/models/buildings/castle.glb",
  [BuildingType.DonkeyFarm]: "/models/buildings/donkey_farm.glb",
  [BuildingType.Farm]: "/models/buildings/farm.glb",
  [BuildingType.FishingVillage]: "/models/buildings/fishing_village.glb",
  [BuildingType.FragmentMine]: "/models/buildings/fragment_mine.glb",
  [BuildingType.Market]: "/models/buildings/market.glb",
  [BuildingType.Resource]: "/models/buildings/resource.glb",
  [BuildingType.Stable]: "/models/buildings/stable.glb",
  [BuildingType.Storehouse]: "/models/buildings/storehouse.glb",
  [BuildingType.TradingPost]: "/models/buildings/trading_post.glb",
  [BuildingType.Walls]: "/models/buildings/walls.glb",
  [BuildingType.WatchTower]: "/models/buildings/watch_tower.glb",
  [BuildingType.WorkersHut]: "/models/buildings/workers_hut.glb",
};

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

    this.loadBiomeModels();
  }

  private loadBiomeModels() {
    const loader = new GLTFLoader();

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
            const tmp = new InstancedModel(model, 1);
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

  setup(row: number, col: number) {
    console.log("clickedHex", row, col);
    console.log(this.locationManager.getCol(), this.locationManager.getRow());

    this.clearScene();
    this.createHexagonGrid();
    this.addLights();
    this.adjustCamera();
    this.loadBuildingModel();
    this.addEventListeners();
  }

  private clearScene() {
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }

  private createHexagonGrid() {
    const radius = 3;
    const group = new THREE.Group();
    this.hexInstanced = this.createHexagonInstancedMesh(3 * radius * (radius - 1) + 1);
    group.add(this.hexInstanced);

    const horizontalSpacing = this.hexSize * Math.sqrt(3);
    const verticalSpacing = this.hexSize * 1.5;

    const dummy = new THREE.Object3D();
    let index = 0;

    for (let q = -radius + 1; q < radius; q++) {
      for (let r = Math.max(-radius + 1, -q - radius + 1); r < Math.min(radius, -q + radius); r++) {
        const x = horizontalSpacing * (q + r / 2);
        const z = verticalSpacing * r * -1;

        dummy.position.set(x, 0, z);
        dummy.scale.y = this.calculateNoiseHeight(q, r);
        dummy.updateMatrix();

        this.hexInstanced.setMatrixAt(index, dummy.matrix);
        this.hexInstanced.setColorAt(index, new THREE.Color("green"));

        index++;
      }
    }

    this.hexInstanced.instanceMatrix.needsUpdate = true;
    this.hexInstanced.instanceColor!.needsUpdate = true;

    this.scene.add(group);
  }

  private calculateNoiseHeight(q: number, r: number): number {
    const noiseInput = [q / 10, r / 10, 0];
    return ((snoise(noiseInput) + 1) / 2) * 2;
  }

  private addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  private adjustCamera() {
    this.camera.position.set(3, 5, 8);
    this.camera.lookAt(3, 0, 3);
  }

  private addEventListeners() {
    window.addEventListener("mousemove", this.onMouseMove.bind(this));
    window.addEventListener("click", this.onMouseClick.bind(this));
  }

  loadBuildingModel(buildingType: string = "bank") {
    const loader = new GLTFLoader();
    loader.load(`/models/buildings/${buildingType}.glb`, (gltf) => {
      this.buildingModel = gltf.scene;
      this.buildingModel.scale.set(0.5, 0.5, 0.5); // Adjust scale as needed
    });
  }

  onMouseMove(event: MouseEvent) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.updateHoverEffect();
  }

  private updateHoverEffect() {
    if (!this.hexInstanced || !this.buildingModel) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.hexInstanced);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const instanceId = intersect.instanceId;

      if (instanceId !== undefined) {
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const matrix = new THREE.Matrix4();

        this.hexInstanced.getMatrixAt(instanceId, matrix);
        matrix.decompose(position, new THREE.Quaternion(), scale);

        if (!this.hoverBuilding) {
          this.hoverBuilding = this.buildingModel.clone();
          if (this.hoverBuilding instanceof THREE.Mesh) {
            this.hoverBuilding.material = (this.hoverBuilding.material as THREE.Material).clone();
            this.hoverBuilding.material.transparent = true;
            this.hoverBuilding.material.opacity = 0.5;
          }
          this.scene.add(this.hoverBuilding);
        }

        this.hoverBuilding.position.copy(position);
        this.hoverBuilding.position.y += scale.y / 2 + 0.1;
        this.hoverBuilding.visible = true;
      }
    } else if (this.hoverBuilding) {
      this.hoverBuilding.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  onMouseClick() {
    if (!this.hexInstanced || !this.buildingModel) {
      console.log("hexInstanced or buildingModel is null");
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.hexInstanced);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const instanceId = intersect.instanceId;

      if (instanceId !== undefined) {
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const matrix = new THREE.Matrix4();

        this.hexInstanced.getMatrixAt(instanceId, matrix);
        matrix.decompose(position, new THREE.Quaternion(), scale);

        const building = this.buildingModel.clone();
        building.position.copy(position);
        building.position.y += scale.y / 2 + 0.1; // Increased offset for visibility
        this.scene.add(building);
        console.log("Building added at position:", position);

        if (this.hoverBuilding) {
          this.scene.remove(this.hoverBuilding);
          this.hoverBuilding = null;
        }

        // Change the color of the selected hex
        const color = new THREE.Color(0xff0000); // Red color
        this.hexInstanced.setColorAt(instanceId, color);
        this.hexInstanced.instanceColor!.needsUpdate = true;

        // Force a re-render
        this.renderer.render(this.scene, this.camera);
      }
    } else {
      console.log("No intersection found");
    }
  }

  private createHexagonInstancedMesh(instanceCount: number): THREE.InstancedMesh {
    const hexGeometry = new THREE.CylinderGeometry(this.hexSize, this.hexSize, 1, 6);
    const material = new THREE.MeshPhongMaterial({ transparent: true });
    const hexInstanced = new THREE.InstancedMesh(hexGeometry, material, instanceCount);
    hexInstanced.castShadow = true;
    hexInstanced.userData.originalColor = this.originalColor.clone();
    return hexInstanced;
  }
  update(deltaTime: number) {
    // Update logic for detailed scene
  }
}
