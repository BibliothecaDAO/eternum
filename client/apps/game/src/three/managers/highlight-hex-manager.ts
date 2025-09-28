import { highlightHexMaterial } from "@/three/shaders/highlight-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import gsap from "gsap";
import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, Scene, ShaderMaterial, Vector3 } from "three";
import { getWorldPositionForHex } from "../utils";

const HIGHLIGHT_COLOR_BY_ACTION = new Map<ActionType, Vector3>([
  [ActionType.Explore, new Vector3(0.0, 1.2, 2.0)],
  [ActionType.Move, new Vector3(0.5, 2.0, 0.0)],
  [ActionType.Attack, new Vector3(2.5, 0.5, 0.0)],
  [ActionType.Help, new Vector3(1.8, 0.3, 2.0)],
  [ActionType.Build, new Vector3(1.5, 1.2, 0.0)],
  [ActionType.Quest, new Vector3(1.0, 1.0, 0.0)],
  [ActionType.Chest, new Vector3(2.0, 1.5, 0.0)],
  [ActionType.CreateArmy, new Vector3(1.0, 1.5, 2.0)],
]);

const getHighlightColorForAction = (actionType: ActionType): Vector3 => {
  return HIGHLIGHT_COLOR_BY_ACTION.get(actionType) ?? HIGHLIGHT_COLOR_BY_ACTION.get(ActionType.CreateArmy)!;
};

export class HighlightHexManager {
  private highlightedHexes: Mesh[] = [];
  private material: ShaderMaterial;
  private yOffset: number = 0;
  private hexGeometryPool: HexGeometryPool;
  private materialByActionType: Map<ActionType, ShaderMaterial> = new Map();
  private highlightTimeline: gsap.core.Timeline | null = null;
  private activeLaunchGlows: Array<{ mesh: Mesh; material: MeshBasicMaterial }> = [];
  private readonly rolloutConfig = {
    stepDelay: 0.02,
    entryDuration: 0.18,
    initialScale: 0.01,
    ease: "power2.out",
  };

  constructor(private scene: Scene) {
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
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();

    // Remove existing highlights
    this.highlightedHexes.forEach((mesh) => this.scene.remove(mesh));
    this.highlightedHexes = [];

    if (actionPaths.length === 0) return;

    // Use shared geometry instead of creating new one
    const hexagonGeometry = this.hexGeometryPool.getGeometry("highlight");
    hexGeometryDebugger.trackSharedGeometryUsage("highlight", "HighlightHexManager.highlightHexes");

    const timeline = gsap.timeline();

    actionPaths.forEach((hex, index) => {
      const position = getWorldPositionForHex(hex.hex);
      const material =
        this.materialByActionType.get(hex.actionType) ?? this.materialByActionType.get(ActionType.CreateArmy)!;
      const highlightMesh = new Mesh(hexagonGeometry, material);
      highlightMesh.position.set(position.x, 0.175 + this.yOffset, position.z);
      highlightMesh.rotation.x = -Math.PI / 2;
      highlightMesh.visible = false;
      highlightMesh.scale.setScalar(this.rolloutConfig.initialScale);

      // Disable raycasting for this mesh
      highlightMesh.raycast = () => {};

      this.scene.add(highlightMesh);
      this.highlightedHexes.push(highlightMesh);

      const startTime = index * this.rolloutConfig.stepDelay;

      timeline.add(() => {
        highlightMesh.visible = true;
      }, startTime);

      timeline.to(
        highlightMesh.scale,
        {
          x: 1,
          y: 1,
          z: 1,
          duration: this.rolloutConfig.entryDuration,
          ease: this.rolloutConfig.ease,
        },
        startTime,
      );

      if (index === 0) {
        this.triggerLaunchGlow(position, material.uniforms.color.value, timeline, startTime);
      }
    });

    this.highlightTimeline = timeline;
  }

  updateHighlightPulse(pulseFactor: number) {
    this.materialByActionType.forEach((mat) => {
      mat.uniforms.opacity.value = pulseFactor;
    });
  }

  setYOffset(yOffset: number) {
    this.yOffset = yOffset;
  }

  private triggerLaunchGlow(position: Vector3, color: Vector3, timeline: gsap.core.Timeline, startTime: number) {
    const glowMaterial = new MeshBasicMaterial({
      color: new Color(color.x, color.y, color.z),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    const glowMesh = new Mesh(this.hexGeometryPool.getGeometry("highlight"), glowMaterial);
    glowMesh.position.set(position.x, 0.175 + this.yOffset, position.z);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.scale.setScalar(0.45);
    glowMesh.raycast = () => {};

    const glowEntry = { mesh: glowMesh, material: glowMaterial };
    this.activeLaunchGlows.push(glowEntry);
    this.scene.add(glowMesh);

    timeline.to(
      glowMaterial,
      {
        opacity: 0.85,
        duration: 0.12,
        ease: "power2.out",
      },
      startTime,
    );

    timeline.to(
      glowMaterial,
      {
        opacity: 0,
        duration: 0.24,
        ease: "power1.out",
      },
      startTime + 0.12,
    );

    timeline.to(
      glowMesh.scale,
      {
        x: 1.55,
        y: 1.55,
        z: 1.55,
        duration: 0.3,
        ease: "power2.out",
      },
      startTime,
    );

    timeline.add(() => this.removeLaunchGlow(glowEntry), startTime + 0.36);
  }

  private removeLaunchGlow(entry: { mesh: Mesh; material: MeshBasicMaterial }) {
    const index = this.activeLaunchGlows.indexOf(entry);
    if (index >= 0) {
      this.activeLaunchGlows.splice(index, 1);
    }

    if (entry.mesh.parent) {
      entry.mesh.parent.remove(entry.mesh);
    }

    entry.material.dispose();
  }

  private cleanupLaunchGlows() {
    this.activeLaunchGlows.forEach((entry) => {
      if (entry.mesh.parent) {
        entry.mesh.parent.remove(entry.mesh);
      }

      entry.material.dispose();
    });

    this.activeLaunchGlows = [];
  }

  public dispose(): void {
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();
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
