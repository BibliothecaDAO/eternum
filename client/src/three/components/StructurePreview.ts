import { StructureType, ResourcesIds } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { StructureModelPaths } from "./StructureManager";

export class StructurePreview {
  private previewStructure: { type: StructureType; resource?: ResourcesIds } | null = null;
  private modelLoadPromises: Promise<void>[] = [];
  private structureModels: Map<StructureType, THREE.Group> = new Map();

  constructor(private scene: THREE.Scene) {
    this.loadStructureModels();
  }

  private loadStructureModels() {
    const loader = new GLTFLoader();

    for (const [building, path] of Object.entries(StructureModelPaths)) {
      const loadPromise = new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            const model = gltf.scene as THREE.Group;
            model.position.set(0, -100, 0);
            gltf.scene.traverse((child: any) => {
              if (child.isMesh) {
                child.material.color.set(0x00ff00);
                child.material.transparent = true;
                child.material.opacity = 0.75;
              }
            });
            this.structureModels.set(parseInt(building), model);
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

  public getStructureModel(structure: StructureType): THREE.Group | null {
    return this.structureModels.get(structure) || null;
  }

  public setPreviewStructure(structure: { type: StructureType; resource?: ResourcesIds }) {
    if (this.previewStructure) {
      this.clearPreviewStructure();
    }
    this.previewStructure = structure;
    const model = this.getStructureModel(structure.type);
    if (model) {
      this.scene.add(model);
    }
  }

  public getPreviewStructure(): { type: StructureType; resource?: ResourcesIds } | null {
    return this.previewStructure;
  }

  public clearPreviewStructure() {
    if (this.previewStructure) {
      const model = this.getStructureModel(this.previewStructure.type);
      if (model) {  
        this.scene.remove(model);
        this.previewStructure = null;
      }
    }
  }

  public setStructurePosition(position: THREE.Vector3) {
    if (this.previewStructure) {
      const model = this.getStructureModel(this.previewStructure.type);
      if (model) {
        model.position.copy(position);
        model.updateMatrixWorld();
      }
    }
  }

  public setStructureColor(color: THREE.Color) {
    if (this.previewStructure) {
      const model = this.getStructureModel(this.previewStructure.type);
      if (model) {
        model.traverse((child: any) => {
          if (child.isMesh) {
            child.material.color.copy(color);
          }
        });
      }
    }
  }

  public resetStructureColor() {
    this.setStructureColor(new THREE.Color(0x00ff00));
  }
}
