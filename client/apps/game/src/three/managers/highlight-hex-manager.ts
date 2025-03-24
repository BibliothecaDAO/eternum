import { createHexagonShape } from "@/three/geometry/hexagon-geometry";
import { HEX_SIZE } from "@/three/scenes/constants";
import { highlightHexMaterial } from "@/three/shaders/highlight-hex-material";
import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { getWorldPositionForHex } from "../utils";

const getHighlightColorForAction = (actionType: ActionType): THREE.Vector3 => {
  switch (actionType) {
    case ActionType.Explore:
      return new THREE.Vector3(0.0, 1.5, 1.5); // More intense cyan
    case ActionType.Move:
      return new THREE.Vector3(0.0, 1.5, 0.0); // More intense green
    case ActionType.Attack:
      return new THREE.Vector3(2.0, 0.0, 0.0); // More intense red
    case ActionType.Help:
      return new THREE.Vector3(1.5, 0.0, 1.5); // More intense purple
    case ActionType.Build:
      return new THREE.Vector3(0.0, 1.5, 0.0); // More intense green
    default:
      return new THREE.Vector3(1.5, 1.5, 1.5); // More intense white
  }
};

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene) {
    this.material = highlightHexMaterial;
  }

  highlightHexes(actionPaths: ActionPath[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createHexagonShape(HEX_SIZE * 0.975);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);

    actionPaths.forEach((hex) => {
      const position = getWorldPositionForHex(hex.hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      highlightMesh.material.uniforms.color.value = getHighlightColorForAction(hex.actionType);
      highlightMesh.position.set(position.x, 0.175, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;

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
