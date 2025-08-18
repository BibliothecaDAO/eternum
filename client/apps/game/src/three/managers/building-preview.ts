import { useUIStore } from "@/hooks/store/use-ui-store";
import { buildingModelPaths, BUILDINGS_GROUPS, PREVIEW_BUILD_COLOR_VALID } from "@/three/constants";
import { HoverSound } from "@/three/sound/hover-sound";
import { gltfLoader } from "@/three/utils/utils";
import { getIsBlitz } from "@bibliothecadao/eternum";

import { ResourceIdToMiningType } from "@bibliothecadao/eternum";
import { BuildingType, ResourceMiningTypes, ResourcesIds } from "@bibliothecadao/types";
import * as THREE from "three";

export class BuildingPreview {
  private previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null = null;
  private modelLoadPromises: Promise<void>[] = [];
  private buildingModels: Map<BUILDINGS_GROUPS, Map<string, THREE.Group>> = new Map();
  private currentHexHovered: THREE.Vector3 | null = null;
  private hoverSound: HoverSound;
  private isBlitz: boolean;

  constructor(private scene: THREE.Scene) {
    this.loadBuildingModels();
    this.hoverSound = new HoverSound();
    this.isBlitz = getIsBlitz();
  }

  private loadBuildingModels() {
    const loader = gltfLoader;
    for (const group of Object.values(BUILDINGS_GROUPS)) {
      const groupPaths = buildingModelPaths(this.isBlitz)[group];
      if (!this.buildingModels.has(group)) {
        this.buildingModels.set(group, new Map());
      }
      const groupMap = this.buildingModels.get(group)!;

      for (const [building, path] of Object.entries(groupPaths)) {
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
              groupMap.set(building as any, model);
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

    Promise.all(this.modelLoadPromises).then(() => {});
  }

  public getBuildingModel(
    group: BUILDINGS_GROUPS | null,
    building: BuildingType | ResourceMiningTypes | null,
  ): THREE.Group | null {
    if (!group || !building) return null;
    const categoryMap = this.buildingModels.get(group);
    if (categoryMap) {
      return categoryMap.get(building + "") || null;
    }
    return null;
  }

  public getBuildingType(): {
    buildingGroup: BUILDINGS_GROUPS | null;
    buildingType: BuildingType | ResourceMiningTypes | null;
  } {
    const building = this.previewBuilding;
    if (!building) return { buildingGroup: null, buildingType: null };
    const buildingGroup = building.resource ? BUILDINGS_GROUPS.RESOURCES_MINING : BUILDINGS_GROUPS.BUILDINGS;
    const buildingType = building.resource ? ResourceIdToMiningType[building.resource as ResourcesIds]! : building.type;
    return { buildingGroup, buildingType };
  }

  public setPreviewBuilding(building: { type: BuildingType; resource?: ResourcesIds }) {
    if (this.previewBuilding) {
      this.clearPreviewBuilding();
    }
    this.previewBuilding = building;
    const { buildingGroup, buildingType } = this.getBuildingType();
    const model = this.getBuildingModel(buildingGroup, buildingType as BuildingType | ResourceMiningTypes);
    if (model) {
      this.scene.add(model);
    }
  }

  public getPreviewBuilding(): { type: BuildingType; resource?: ResourcesIds } | null {
    return this.previewBuilding;
  }

  public clearPreviewBuilding() {
    if (this.previewBuilding) {
      const { buildingGroup, buildingType } = this.getBuildingType();
      const model = this.getBuildingModel(buildingGroup, buildingType as BuildingType | ResourceMiningTypes);
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
      const { buildingGroup, buildingType } = this.getBuildingType();
      const model = this.getBuildingModel(buildingGroup, buildingType as BuildingType | ResourceMiningTypes);
      if (model) {
        model.position.copy(position);
        model.updateMatrixWorld();
      }
    }
  }

  public setBuildingColor(color: THREE.Color) {
    if (this.previewBuilding) {
      const { buildingGroup, buildingType } = this.getBuildingType();
      const model = this.getBuildingModel(buildingGroup, buildingType as BuildingType | ResourceMiningTypes);
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
