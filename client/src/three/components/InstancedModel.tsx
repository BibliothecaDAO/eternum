import * as THREE from "three";

export default class InstancedModel {
  public group: THREE.Group;
  public instancedMeshes: THREE.InstancedMesh[] = [];
  private count: number = 0; // Add a private count property

  constructor(model: THREE.Group, count: number, enableRaycast: boolean = false) {
    this.group = new THREE.Group();
    this.count = count; // Initialize the count

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // initial count set max number of instances
        const tmp = new THREE.InstancedMesh(child.geometry, child.material, count);

        tmp.castShadow = true;
        tmp.receiveShadow = true;

        tmp.userData.isInstanceModel = true;

        if (!enableRaycast) {
          tmp.raycast = () => {};
        }

        // we can set lower count later if we have less hexes with that biome and change it at any time
        tmp.count = 0;
        if (!child.name.includes("small_details") && !child.parent?.name.includes("small_details")) {
          this.group.add(tmp);
        }
        this.instancedMeshes.push(tmp);
      }
    });
  }

  getCount(): number {
    return this.count;
  }

  getLandColor() {
    const land = this.group.children.find((child) => child.name === "land");
    if (land instanceof THREE.InstancedMesh) {
      return (land.material as THREE.MeshStandardMaterial).color;
    }
    return new THREE.Color(0xff0000);
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
    this.count = count; // Update the private count property
    this.group.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        child.count = count;
      }
    });
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
}
