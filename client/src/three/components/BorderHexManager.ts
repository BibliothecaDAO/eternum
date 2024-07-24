import * as THREE from "three";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import WorldmapScene from "../scenes/Worldmap";

export class BorderHexManager {
  private worldMap: WorldmapScene;
  private hexSize: number;
  private material: THREE.MeshStandardMaterial;
  private borderHexes: { col: number; row: number }[] = [];
  private instancedMesh: THREE.InstancedMesh | null = null;

  constructor(worldMap: WorldmapScene, hexSize: number, material: THREE.MeshStandardMaterial) {
    this.worldMap = worldMap;
    this.hexSize = hexSize;
    this.material = material;
  }

  addBorderHex(hex: { col: number; row: number }) {
    this.borderHexes.push(hex);
  }

  renderBorderHexes() {
    // Remove existing instanced mesh if it exists
    if (this.instancedMesh) {
      this.worldMap.scene.remove(this.instancedMesh);
      this.instancedMesh.dispose();
    }

    // Create new highlight meshes using InstancedMesh
    const bigHexagonShape = createHexagonShape(this.hexSize);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    const instanceCount = this.borderHexes.length;
    this.instancedMesh = new THREE.InstancedMesh(hexagonGeometry, this.material, instanceCount);

    const dummy = new THREE.Object3D();
    this.borderHexes.forEach((hex, index) => {
      const position = this.worldMap.getWorldPositionForHex(hex);
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.instancedMesh!.setMatrixAt(index, dummy.matrix);
    });

    // Disable raycasting for this mesh
    this.instancedMesh.raycast = () => {};

    this.worldMap.scene.add(this.instancedMesh);
  }
}
