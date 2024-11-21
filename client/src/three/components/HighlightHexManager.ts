import { highlightHexMaterial } from "@/three/shaders/highlightHexMaterial";
import { HexPosition } from "@/types";
import { getWorldPositionForHex } from "@/ui/utils/utils";
import * as THREE from "three";
import { createHexagonShape } from "../geometry/HexagonGeometry";
import { HEX_SIZE } from "../scenes/constants";

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene) {
    this.material = highlightHexMaterial;
  }

  highlightHexes(hexes: HexPosition[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    hexes.forEach((hex) => {
      const position = getWorldPositionForHex(hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      highlightMesh.position.set(position.x, 0.3, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;
      highlightMesh.renderOrder = 5;

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.scene.add(highlightMesh);
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
