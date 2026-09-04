import { BUILDINGS_GROUPS, PREVIEW_BUILD_COLOR_VALID } from "@/three/constants";
import { HoverSound } from "@/three/sound/hover-sound";
import { ResourceIdToMiningType } from "@bibliothecadao/eternum";
import { BuildingType, ResourceMiningTypes, ResourcesIds } from "@bibliothecadao/types";
import * as THREE from "three";

interface BuildingPreviewSource {
  cacheKey: string;
  load(): Promise<THREE.Group | null>;
}

type ResolveBuildingPreviewSource = (
  group: BUILDINGS_GROUPS,
  building: BuildingType | ResourceMiningTypes,
) => BuildingPreviewSource | null;

export class BuildingPreview {
  private previewBuilding: { type: BuildingType; resource?: ResourcesIds } | null = null;
  private readonly modelPromises = new Map<string, Promise<THREE.Group | null>>();
  private readonly models = new Map<string, THREE.Group>();
  private currentHexHovered: THREE.Vector3 | null = null;
  private readonly hoverSound = new HoverSound();
  private isDisposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly resolveSource: ResolveBuildingPreviewSource,
  ) {}

  public getBuildingModel(
    group: BUILDINGS_GROUPS | null,
    building: BuildingType | ResourceMiningTypes | null,
  ): THREE.Group | null {
    if (!group || !building) {
      return null;
    }

    const source = this.resolveSource(group, building);
    return source ? (this.models.get(source.cacheKey) ?? null) : null;
  }

  public getBuildingType(): {
    buildingGroup: BUILDINGS_GROUPS | null;
    buildingType: BuildingType | ResourceMiningTypes | null;
  } {
    const building = this.previewBuilding;
    if (!building) {
      return { buildingGroup: null, buildingType: null };
    }

    return {
      buildingGroup: building.resource ? BUILDINGS_GROUPS.RESOURCES_MINING : BUILDINGS_GROUPS.BUILDINGS,
      buildingType: building.resource ? (ResourceIdToMiningType[building.resource] ?? null) : building.type,
    };
  }

  public setPreviewBuilding(building: { type: BuildingType; resource?: ResourcesIds }): void {
    if (this.isDisposed) {
      return;
    }

    this.clearPreviewBuilding();
    this.previewBuilding = building;

    const { buildingGroup, buildingType } = this.getBuildingType();
    if (!buildingGroup || !buildingType) {
      return;
    }

    void this.loadPreviewModel(buildingGroup, buildingType).then((model) => {
      if (!model || !buildingSelectionsMatch(this.previewBuilding, building)) {
        return;
      }
      this.scene.add(model);
    });
  }

  public getPreviewBuilding(): { type: BuildingType; resource?: ResourcesIds } | null {
    return this.previewBuilding;
  }

  public clearPreviewBuilding(): void {
    const { buildingGroup, buildingType } = this.getBuildingType();
    const model = this.getBuildingModel(buildingGroup, buildingType);
    model?.parent?.remove(model);
    this.previewBuilding = null;
  }

  public setBuildingPosition(position: THREE.Vector3): void {
    if (!this.previewBuilding) {
      return;
    }

    if (!this.currentHexHovered) {
      this.currentHexHovered = position.clone();
      this.hoverSound.play();
    } else if (!this.currentHexHovered.equals(position)) {
      this.hoverSound.play();
      this.currentHexHovered.copy(position);
    }

    const { buildingGroup, buildingType } = this.getBuildingType();
    const model = this.getBuildingModel(buildingGroup, buildingType);
    model?.position.copy(position);
    model?.updateMatrixWorld();
  }

  public setBuildingColor(color: THREE.Color): void {
    const { buildingGroup, buildingType } = this.getBuildingType();
    this.getBuildingModel(buildingGroup, buildingType)?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        forEachMaterial(child.material, (material) => {
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
            material.color.copy(color);
          }
        });
      }
    });
  }

  public resetBuildingColor(): void {
    this.setBuildingColor(new THREE.Color(PREVIEW_BUILD_COLOR_VALID));
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.clearPreviewBuilding();
    this.models.forEach(disposePreviewModel);
    this.models.clear();
    this.modelPromises.clear();
    this.currentHexHovered = null;
  }

  private loadPreviewModel(
    group: BUILDINGS_GROUPS,
    building: BuildingType | ResourceMiningTypes,
  ): Promise<THREE.Group | null> {
    const source = this.resolveSource(group, building);
    if (!source) {
      return Promise.resolve(null);
    }

    const loaded = this.models.get(source.cacheKey);
    if (loaded) {
      return Promise.resolve(loaded);
    }

    const pending = this.modelPromises.get(source.cacheKey);
    if (pending) {
      return pending;
    }

    const loadPromise = source
      .load()
      .then((template) => {
        if (!template) {
          return null;
        }

        const model = clonePreviewModel(template);
        if (this.isDisposed) {
          disposePreviewModel(model);
          return null;
        }
        this.models.set(source.cacheKey, model);
        return model;
      })
      .catch((error) => {
        console.error(`[BuildingPreview] Failed to load ${source.cacheKey}`, error);
        return null;
      })
      .finally(() => this.modelPromises.delete(source.cacheKey));
    this.modelPromises.set(source.cacheKey, loadPromise);
    return loadPromise;
  }
}

function clonePreviewModel(template: THREE.Group): THREE.Group {
  const model = template.clone(true);
  model.position.set(0, -100, 0);
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map((material) => clonePreviewMaterial(material))
      : clonePreviewMaterial(child.material);
  });
  return model;
}

function clonePreviewMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone();
  if (clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshBasicMaterial) {
    clone.color.set(PREVIEW_BUILD_COLOR_VALID);
    clone.opacity = 0.75;
    clone.transparent = true;
  }
  return clone;
}

/**
 * Dim a placed-but-unconfirmed building in place: the instance keeps its
 * silhouette but reads as disabled until the placement tx echoes back.
 * Materials are cloned per instance — dispose them via
 * disposeClonedBuildingMaterials when the instance leaves the scene.
 */
export function applyPendingBuildingMaterials(model: THREE.Group): void {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.material = Array.isArray(child.material)
      ? child.material.map((material) => clonePendingMaterial(material))
      : clonePendingMaterial(child.material);
  });
}

export function disposeClonedBuildingMaterials(model: THREE.Group): void {
  disposePreviewModel(model);
}

function clonePendingMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone();
  if (clone instanceof THREE.MeshStandardMaterial || clone instanceof THREE.MeshBasicMaterial) {
    clone.color.multiplyScalar(0.7);
    clone.opacity = 0.55;
    clone.transparent = true;
  }
  return clone;
}

function disposePreviewModel(model: THREE.Group): void {
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      forEachMaterial(child.material, (material) => material.dispose());
    }
  });
}

function forEachMaterial(
  material: THREE.Material | THREE.Material[],
  callback: (material: THREE.Material) => void,
): void {
  (Array.isArray(material) ? material : [material]).forEach(callback);
}

function buildingSelectionsMatch(
  current: { type: BuildingType; resource?: ResourcesIds } | null,
  expected: { type: BuildingType; resource?: ResourcesIds },
): boolean {
  return current?.type === expected.type && current.resource === expected.resource;
}
