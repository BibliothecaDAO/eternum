import * as THREE from "three";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";
import WorldmapScene from "../scenes/Worldmap";

export class BorderHexManager {
  private worldMap: WorldmapScene;
  private hexSize: number;
  private material: THREE.ShaderMaterial;
  private borderHexes: { col: number; row: number }[] = [];
  private borderMeshes: THREE.Mesh[] = [];

  constructor(worldMap: WorldmapScene, hexSize: number, material: THREE.ShaderMaterial) {
    this.worldMap = worldMap;
    this.hexSize = hexSize;
    this.material = material;
  }

  addBorderHex(hex: { col: number; row: number }) {
    this.borderHexes.push(hex);
  }

  renderBorderHexes() {
    // Remove existing highlights
    this.borderMeshes.forEach((mesh) => this.worldMap.scene.remove(mesh));
    this.borderMeshes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(this.hexSize);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    this.borderHexes.forEach((hex) => {
      const position = this.worldMap.getWorldPositionForHex(hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      highlightMesh.position.set(position.x, 0.1, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.worldMap.scene.add(highlightMesh);
      this.borderMeshes.push(highlightMesh);
    });
  }
}
