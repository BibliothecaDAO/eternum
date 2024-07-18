import * as THREE from "three";
import WorldmapScene from "../scenes/Worldmap";
import { createHexagonShape } from "@/ui/components/worldmap/hexagon/HexagonGeometry";

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];

  constructor(private worldMap: WorldmapScene, private hexSize: number, private material: THREE.ShaderMaterial) {}

  highlightHexes(hexes: { row: number; col: number }[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.worldMap.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(this.hexSize);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    hexes.forEach((hex) => {
      const position = this.worldMap.getWorldPositionForHex(hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      highlightMesh.position.set(position.x, 0.32, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.worldMap.scene.add(highlightMesh);
      this.highlightedHexes.push(highlightMesh);
    });
  }
  updateHighlightPulse(pulseFactor: number) {
    this.highlightedHexes.forEach((mesh) => {
      if (mesh.material instanceof THREE.ShaderMaterial) {
        mesh.material.uniforms.opacity.value = pulseFactor;
      }
    });
  }
}
