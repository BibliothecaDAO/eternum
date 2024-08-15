import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { buildingModelPaths, PREVIEW_BUILD_COLOR_VALID } from "../scenes/constants";

export class BuildingPreview {
  private previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null = null;
  private modelLoadPromises: Promise<void>[] = [];
  private buildingModels: Map<BuildingType, THREE.Group> = new Map();

  constructor(private scene: THREE.Scene) {
    this.loadBuildingModels();
  }

  private loadBuildingModels() {
    const loader = new GLTFLoader();
    for (const [building, path] of Object.entries(buildingModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            model.position.set(0, -100, 0);
            gltf.scene.traverse((child: any) => {
              if (child.isMesh) {
                child.material.color.set(PREVIEW_BUILD_COLOR_VALID);
                child.material.transparent = true;
                child.material.opacity = 0.75;
              }
            });
            this.buildingModels.set(parseInt(building), model);
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

  public getBuildingModel(building: BuildingType): THREE.Group | null {
    return this.buildingModels.get(building) || null;
  }

  public setPreviewBuilding(building: { type: BuildingType; resource?: ResourcesIds }) {
    if (this.previewBuilding) {
      this.clearPreviewBuilding();
    }
    this.previewBuilding = building;
    const model = this.getBuildingModel(building.type);
    if (model) {
      this.scene.add(model);
    }
  }

  public getPreviewBuilding(): { type: BuildingType; resource?: ResourcesIds } | null {
    return this.previewBuilding;
  }

  public clearPreviewBuilding() {
    if (this.previewBuilding) {
      const model = this.getBuildingModel(this.previewBuilding.type);
      if (model) {
        this.scene.remove(model);
        this.previewBuilding = null;
      }
    }
  }

  public setBuildingPosition(position: THREE.Vector3) {
    if (this.previewBuilding) {
      const model = this.getBuildingModel(this.previewBuilding.type);
      if (model) {
        model.position.copy(position);
        model.updateMatrixWorld();
      }
    }
  }

  public setBuildingColor(color: THREE.Color) {
    if (this.previewBuilding) {
      const model = this.getBuildingModel(this.previewBuilding.type);
      if (model) {
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.material.color.copy(color);
          }
        });
      }
    }
  }

  public resetBuildingColor() {
    this.setBuildingColor(new THREE.Color(PREVIEW_BUILD_COLOR_VALID));
  }
}
