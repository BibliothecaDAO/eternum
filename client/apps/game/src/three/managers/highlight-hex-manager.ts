import { highlightHexMaterial } from "@/three/shaders/highlight-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import * as THREE from "three";
import { getWorldPositionForHex } from "../utils";

const HIGHLIGHT_COLOR_BY_ACTION = new Map<ActionType, THREE.Vector3>([
  [ActionType.Explore, new THREE.Vector3(0.0, 1.2, 2.0)],
  [ActionType.Move, new THREE.Vector3(0.5, 2.0, 0.0)],
  [ActionType.Attack, new THREE.Vector3(2.5, 0.5, 0.0)],
  [ActionType.Help, new THREE.Vector3(1.8, 0.3, 2.0)],
  [ActionType.Build, new THREE.Vector3(1.5, 1.2, 0.0)],
  [ActionType.Quest, new THREE.Vector3(1.0, 1.0, 0.0)],
  [ActionType.Chest, new THREE.Vector3(2.0, 1.5, 0.0)],
  [ActionType.CreateArmy, new THREE.Vector3(1.0, 1.5, 2.0)],
]);

const getHighlightColorForAction = (actionType: ActionType): THREE.Vector3 => {
  return HIGHLIGHT_COLOR_BY_ACTION.get(actionType) ?? HIGHLIGHT_COLOR_BY_ACTION.get(ActionType.CreateArmy)!;
};

export class HighlightHexManager {
  private highlightedHexes: THREE.Mesh[] = [];
  private material: THREE.ShaderMaterial;
  private yOffset: number = 0;
  private hexGeometryPool: HexGeometryPool;
  private materialByActionType: Map<ActionType, THREE.ShaderMaterial> = new Map();

  constructor(private scene: THREE.Scene) {
    this.material = highlightHexMaterial;
    this.hexGeometryPool = HexGeometryPool.getInstance();
    this.initializeMaterialCache();
  }

  private initializeMaterialCache() {
    const actionTypes: ActionType[] = [
      ActionType.Explore,
      ActionType.Move,
      ActionType.Attack,
      ActionType.Help,
      ActionType.Build,
      ActionType.Quest,
      ActionType.Chest,
      ActionType.CreateArmy,
    ];

    actionTypes.forEach((type) => {
      const cloned = this.material.clone();
      hexGeometryDebugger.trackMaterialClone("HighlightHexManager.initializeMaterialCache");
      cloned.uniforms.color.value = getHighlightColorForAction(type);
      this.materialByActionType.set(type, cloned);
    });
  }

  highlightHexes(actionPaths: ActionPath[]) {
    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    if (actionPaths.length === 0) return;

    // Use shared geometry instead of creating new one
    const hexagonGeometry = this.hexGeometryPool.getGeometry("highlight");
    hexGeometryDebugger.trackSharedGeometryUsage("highlight", "HighlightHexManager.highlightHexes");

    actionPaths.forEach((hex) => {
      const position = getWorldPositionForHex(hex.hex);
      const material =
        this.materialByActionType.get(hex.actionType) ?? this.materialByActionType.get(ActionType.CreateArmy)!;
      const highlightMesh = new THREE.Mesh(hexagonGeometry, material);
      highlightMesh.position.set(position.x, 0.175 + this.yOffset, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.scene.add(highlightMesh);
      this.highlightedHexes.push(highlightMesh);
    });
  }

  updateHighlightPulse(pulseFactor: number) {
    this.materialByActionType.forEach((mat) => {
      mat.uniforms.opacity.value = pulseFactor;
    });
  }

  setYOffset(yOffset: number) {
    this.yOffset = yOffset;
  }

  public dispose(): void {
    console.log("🧹 HighlightHexManager: Starting disposal");

    let meshesDisposed = 0;

    // Dispose all highlighted hex meshes
    this.highlightedHexes.forEach((mesh) => {
      // Remove from scene
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }

      meshesDisposed++;
    });

    // Clear the array
    this.highlightedHexes = [];

    this.materialByActionType.forEach((mat) => mat.dispose());
    this.materialByActionType.clear();

    console.log(`🧹 HighlightHexManager: Disposed ${meshesDisposed} meshes and materials`);
  }
}
