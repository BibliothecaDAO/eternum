import useUIStore from "@/hooks/store/useUIStore";
import { ResourceMiningTypes } from "@/types";
import { ResourceIdToMiningType } from "@/ui/utils/utils";
import { BuildingType, ResourcesIds } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { gltfLoader } from "../helpers/utils";
import { buildingModelPaths, PREVIEW_BUILD_COLOR_VALID } from "../scenes/constants";
import { HoverSound } from "../sound/HoverSound";

export class BuildingPreview {
  private previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null = null;
  private modelLoadPromises: Promise<void>[] = [];
  private buildingModels: Map<BuildingType | ResourceMiningTypes, THREE.Group> = new Map();
  private currentHexHovered: THREE.Vector3 | null = null;
  private hoverSound: HoverSound;

  constructor(private scene: THREE.Scene) {
    this.loadBuildingModels();
    this.hoverSound = new HoverSound();
  }

  private loadBuildingModels() {
    const loader = gltfLoader;
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
            this.buildingModels.set((building + "") as any, model);
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

  public getBuildingModel(building: BuildingType | ResourceMiningTypes): THREE.Group | null {
    return this.buildingModels.get((building + "") as any) || null;
  }

  public getBuildingType() {
    const building = this.previewBuilding;
    if (!building) return null;
    const buildingType = building.resource ? ResourceIdToMiningType[building.resource as ResourcesIds] : building.type;
    return buildingType;
  }

  public setPreviewBuilding(building: { type: BuildingType; resource?: ResourcesIds }) {
    if (this.previewBuilding) {
      this.clearPreviewBuilding();
    }
    this.previewBuilding = building;
    const buildingType = building.resource ? ResourceIdToMiningType[building.resource as ResourcesIds] : building.type;
    const model = this.getBuildingModel(buildingType as BuildingType | ResourceMiningTypes);

    if (model) {
      this.scene.add(model);
    }
  }

  public getPreviewBuilding(): { type: BuildingType; resource?: ResourcesIds } | null {
    return this.previewBuilding;
  }

  public clearPreviewBuilding() {
    if (this.previewBuilding) {
      const model = this.getBuildingModel(this.getBuildingType() as BuildingType | ResourceMiningTypes);
      if (model) {
        this.scene.remove(model);
        this.previewBuilding = null;
      }
    }
  }

  public setBuildingPosition(position: THREE.Vector3) {
    if (this.previewBuilding) {
      if (!this.currentHexHovered || !this.currentHexHovered.equals(position)) {
        const { isSoundOn, effectsLevel } = useUIStore.getState();
        this.hoverSound.play(isSoundOn, effectsLevel);
        this.currentHexHovered = position;
      }

      const model = this.getBuildingModel(this.getBuildingType() as BuildingType | ResourceMiningTypes);
      if (model) {
        model.position.copy(position);
        model.updateMatrixWorld();
      }
    }
  }

  public setBuildingColor(color: THREE.Color) {
    if (this.previewBuilding) {
      const model = this.getBuildingModel(this.getBuildingType() as BuildingType | ResourceMiningTypes);
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
