import * as THREE from "three";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import WorldmapScene from "../scenes/Worldmap";
import { borderHexMaterial } from "@/shaders/borderHexMaterial";
import { transparentHexMaterial } from "@/shaders/transparentHexMaterial";

export class InteractiveHexManager {
  private worldMap: WorldmapScene;
  private hexSize: number;
  private borderHexes: Set<string> = new Set();
  private exploredHexes: Set<string> = new Set();
  private borderInstanceMesh: THREE.InstancedMesh | null = null;
  private exploredInstanceMesh: THREE.InstancedMesh | null = null;

  constructor(worldMap: WorldmapScene, hexSize: number) {
    this.worldMap = worldMap;
    this.hexSize = hexSize;
  }

  addBorderHex(hex: { col: number; row: number }) {
    this.borderHexes.add(`${hex.col},${hex.row}`);
  }

  addExploredHex(hex: { col: number; row: number }) {
    // Fixed typo in method name
    this.exploredHexes.add(`${hex.col},${hex.row}`);
  }

  clearHexes() {
    this.borderHexes.clear();
    this.exploredHexes.clear();
  }

  renderHexes() {
    // Remove existing instanced mesh if it exists
    if (this.borderInstanceMesh) {
      this.worldMap.scene.remove(this.borderInstanceMesh);
      this.borderInstanceMesh.dispose();
    }

    if (this.exploredInstanceMesh) {
      this.worldMap.scene.remove(this.exploredInstanceMesh);
      this.exploredInstanceMesh.dispose();
    }

    // Create new highlight meshes using InstancedMesh
    const bigHexagonShape = createHexagonShape(this.hexSize);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    const borderInstanceCount = this.borderHexes.size;
    const exploredInstanceCount = this.exploredHexes.size;
    this.borderInstanceMesh = new THREE.InstancedMesh(hexagonGeometry, borderHexMaterial, borderInstanceCount);
    this.exploredInstanceMesh = new THREE.InstancedMesh(hexagonGeometry, transparentHexMaterial, exploredInstanceCount);

    const dummy = new THREE.Object3D();
    let index = 0;
    this.borderHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = this.worldMap.getWorldPositionForHex({ col, row });
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.borderInstanceMesh!.setMatrixAt(index, dummy.matrix);
      index++;
    });

    index = 0; // Reset index for explored hexes
    this.exploredHexes.forEach((hexString) => {
      const [col, row] = hexString.split(",").map(Number);
      const position = this.worldMap.getWorldPositionForHex({ col, row });
      dummy.position.set(position.x, 0.1, position.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.updateMatrix();
      this.exploredInstanceMesh!.setMatrixAt(index, dummy.matrix);
      index++;
    });

    // Disable raycasting for these meshes
    this.borderInstanceMesh.raycast = () => {};
    this.exploredInstanceMesh.raycast = () => {};

    this.worldMap.scene.add(this.borderInstanceMesh);
    this.worldMap.scene.add(this.exploredInstanceMesh);
  }
}
