import * as THREE from "three";

export default class InstancedModel {
  public group: THREE.Group;

  constructor(model: THREE.Group, count: number) {
    this.group = new THREE.Group();
    //console.log(model);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // initial count set max number of instances
        const tmp = new THREE.InstancedMesh(child.geometry, child.material, count);
        // we can set lower count later if we have less hexes with that biome and change it at any time
        tmp.count = 0;
        this.group.add(tmp);
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
}
