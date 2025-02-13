import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { HEX_SIZE } from "@/three/scenes/constants";
import { highlightHexMaterial } from "@/three/shaders/highlight-hex-material";
import { ActionPaths, ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { getWorldPositionForHex } from "../utils";

export const getHighlightColorForAction = (actionType: ActionType): THREE.Vector3 => {
  switch (actionType) {
    case ActionType.Explore:
      return new THREE.Vector3(0.0, 0.8, 0.8); // Cyan
    case ActionType.Move:
      return new THREE.Vector3(0.0, 0.8, 0.0); // Green
    case ActionType.Attack:
      return new THREE.Vector3(0.8, 0.0, 0.0); // Red
    case ActionType.Merge:
      return new THREE.Vector3(0.8, 0.0, 0.8); // Purple
    case ActionType.Build:
      return new THREE.Vector3(0.0, 0.0, 0.8); // Blue
    default:
      return new THREE.Vector3(1.0, 1.0, 1.0); // White
  }
};

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene) {
    this.material = highlightHexMaterial;
  }

  highlightHexes(actionPaths: ActionPaths) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    actionPaths.forEach((hex) => {
      const position = getWorldPositionForHex(hex.hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      highlightMesh.material.uniforms.color.value = getHighlightColorForAction(hex.actionType);
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
