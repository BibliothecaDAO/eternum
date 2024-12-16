import { GRAPHICS_SETTING, GraphicsSettings } from "@/ui/config";
import { ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { AnimationClip, AnimationMixer } from "three";
import { MinesMaterialsParams, PREVIEW_BUILD_COLOR_INVALID } from "../scenes/constants";

const BIG_DETAILS_NAME = "big_details";
const BUILDING_NAME = "building";
export const LAND_NAME = "land";
export const SMALL_DETAILS_NAME = "small_details";

interface AnimatedInstancedMesh extends THREE.InstancedMesh {
  animated: boolean;
}

export default class InstancedModel {
  public group: THREE.Group;
  public instancedMeshes: AnimatedInstancedMesh[] = [];
  private biomeMeshes: any[] = [];
  private count: number = 0;
  private mixer: AnimationMixer | null = null;
  private animation: AnimationClip | null = null;
  private animationActions: Map<number, THREE.AnimationAction> = new Map();
  timeOffsets: Float32Array;

  constructor(gltf: any, count: number, enableRaycast: boolean = false, name: string = "") {
    this.group = new THREE.Group();
    this.count = count;

    this.timeOffsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.timeOffsets[i] = Math.random() * 3;
    }

    gltf.scene.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        if (child.scale.x !== 1) {
          return;
        }
        let material = child.material;
        if (name === StructureType[StructureType.FragmentMine] && child.name.includes("crystal")) {
          material = new THREE.MeshStandardMaterial(MinesMaterialsParams[ResourcesIds.AncientFragment]);
        }
        const tmp = new THREE.InstancedMesh(child.geometry, material, count) as AnimatedInstancedMesh;
        const biomeMesh = child;
        if (gltf.animations.length > 0) {
          if (
            gltf.animations[0].tracks.find((track: any) => track.name.split(".")[0] === child.name) &&
            name !== StructureType[StructureType.FragmentMine]
          ) {
            tmp.animated = true;
            for (let i = 0; i < count; i++) {
              tmp.setMorphAt(i, biomeMesh as any);
            }
            tmp.morphTexture!.needsUpdate = true;
          }
        }

        if (child.name.includes(BIG_DETAILS_NAME) || child.parent?.name.includes(BIG_DETAILS_NAME)) {
          tmp.castShadow = true;
          tmp.name = BIG_DETAILS_NAME;
        }

        if (child.name.includes(BUILDING_NAME) || child.parent?.name.includes(BUILDING_NAME)) {
          tmp.castShadow = true;
          tmp.name = BUILDING_NAME;
        }

        if (child.name.includes(LAND_NAME) || child.parent?.name.includes(LAND_NAME)) {
          tmp.receiveShadow = true;
          tmp.name = LAND_NAME;
        }

        tmp.userData.isInstanceModel = true;

        if (!enableRaycast) {
          tmp.raycast = () => {};
        }

        this.mixer = new AnimationMixer(gltf.scene);
        this.animation = gltf.animations[0];

        tmp.count = 0;
        this.group.add(tmp);
        this.instancedMeshes.push(tmp);
        this.biomeMeshes.push(biomeMesh);
      }
    });
  }

  getCount(): number {
    return this.count;
  }

  getLandColor() {
    const land = this.group.children.find((child) => child.name === LAND_NAME);
    if (land instanceof THREE.InstancedMesh) {
      return (land.material as THREE.MeshStandardMaterial).color;
    }
    return new THREE.Color(PREVIEW_BUILD_COLOR_INVALID);
  }

  getMatricesAndCount() {
    return {
      matrices: (this.group.children[0] as THREE.InstancedMesh).instanceMatrix.clone(),
      count: (this.group.children[0] as THREE.InstancedMesh).count,
    };
  }

  setMatricesAndCount(matrices: THREE.InstancedBufferAttribute, count: number) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.instanceMatrix.copy(matrices);
        child.count = count;
        child.instanceMatrix.needsUpdate = true;
      }
    });
  }

  setMatrixAt(index: number, matrix: THREE.Matrix4) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.setMatrixAt(index, matrix);
      }
    });
  }

  setColorAt(index: number, color: THREE.Color) {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.setColorAt(index, color);
      }
    });
  }

  setCount(count: number) {
    this.count = count;
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.count = count;
      }
    });
    this.needsUpdate();
  }

  removeInstance(index: number) {
    console.log("remove instance");
    this.setMatrixAt(index, new THREE.Matrix4().makeScale(0, 0, 0));
    this.needsUpdate();
  }

  needsUpdate() {
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingSphere();
        child.frustumCulled = false;
      }
    });
  }

  clone() {
    return this.group.clone();
  }

  scaleModel(scale: THREE.Vector3) {
    this.group.scale.copy(scale);
    this.group.updateMatrixWorld(true);
  }

  updateAnimations(deltaTime: number) {
    if (GRAPHICS_SETTING === GraphicsSettings.LOW) {
      return;
    }

    if (this.mixer && this.animation) {
      const time = performance.now() * 0.001;
      this.instancedMeshes.forEach((mesh, meshIndex) => {
        if (!mesh.animated) return;
        if (!this.animationActions.has(meshIndex)) {
          const action = this.mixer!.clipAction(this.animation!);
          this.animationActions.set(meshIndex, action);
        }

        const action = this.animationActions.get(meshIndex)!;
        action.play();

        for (let i = 0; i < mesh.count; i++) {
          this.mixer!.setTime(time + this.timeOffsets[i]);
          mesh.setMorphAt(i, this.biomeMeshes[meshIndex]);
        }
        mesh.morphTexture!.needsUpdate = true;
      });
    }
  }
}
