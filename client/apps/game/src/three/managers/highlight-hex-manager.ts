import { HEX_SIZE } from "@/three/constants";
import { createRoundedHexagonShape } from "@/three/geometry/hexagon-geometry";
import { highlightHexMaterial } from "@/three/shaders/highlight-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { getWorldPositionForHex } from "../utils";

const getHighlightColorForAction = (actionType: ActionType): THREE.Vector3 => {
  switch (actionType) {
    case ActionType.Explore:
      return new THREE.Vector3(0.0, 1.2, 2.0); // Arcane blue glow
    case ActionType.Move:
      return new THREE.Vector3(0.5, 2.0, 0.0); // Emerald green
    case ActionType.Attack:
      return new THREE.Vector3(2.5, 0.5, 0.0); // Fiery orange-red
    case ActionType.Help:
      return new THREE.Vector3(1.8, 0.3, 2.0); // Holy purple-pink
    case ActionType.Build:
      return new THREE.Vector3(1.5, 1.2, 0.0); // Golden amber
    case ActionType.Quest:
      return new THREE.Vector3(1.0, 1.0, 0.0); // Bright yellow
    case ActionType.Chest:
      return new THREE.Vector3(2.0, 1.5, 0.0); // Treasure gold
    case ActionType.CreateArmy:
      return new THREE.Vector3(1.0, 1.5, 2.0); // Ethereal blue-white
    default:
      return new THREE.Vector3(1.0, 1.5, 2.0); // Ethereal blue-white
  }
};

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;
  private yOffset: number = 0;

  constructor(private scene: THREE.Scene) {
    this.material = highlightHexMaterial;
  }

  highlightHexes(actionPaths: ActionPath[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    // Create new highlight meshes
    const bigHexagonShape = createRoundedHexagonShape(HEX_SIZE * 0.975);
    const hexagonGeometry = new THREE.ShapeGeometry(bigHexagonShape);
    hexGeometryDebugger.trackGeometryCreation('HighlightHexManager.highlightHexes');

    actionPaths.forEach((hex) => {
      const position = getWorldPositionForHex(hex.hex);
      const highlightMesh = new THREE.Mesh(hexagonGeometry, this.material.clone());
      hexGeometryDebugger.trackMaterialClone('HighlightHexManager.highlightHexes');
      highlightMesh.material.uniforms.color.value = getHighlightColorForAction(hex.actionType);
      highlightMesh.position.set(position.x, 0.175 + this.yOffset, position.z);
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

  setYOffset(yOffset: number) {
    this.yOffset = yOffset;
  }
}
