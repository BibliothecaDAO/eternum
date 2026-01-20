import { highlightHexInstancedMaterial } from "@/three/shaders/highlight-hex-material";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { ActionPath, ActionType } from "@bibliothecadao/eternum";
import gsap from "gsap";
import {
  AdditiveBlending,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
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

// Maximum number of highlights that can be displayed at once
const MAX_HIGHLIGHTS = 100;

// Temporary objects to avoid allocations in hot paths
const tempMatrix = new Matrix4();
const tempPosition = new Vector3();
const tempScale = new Vector3();
const tempColor = new Color();

// Fixed rotation for all highlights (rotated -90 degrees on X axis)
const HIGHLIGHT_ROTATION = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

interface InstanceAnimationState {
  index: number;
  position: Vector3;
  targetScale: number;
  currentScale: number;
}

export class HighlightHexManager {
  private instancedMesh: InstancedMesh;
  private material: ShaderMaterial;
  private yOffset: number = 0;
  private hexGeometryPool: HexGeometryPool;
  private highlightTimeline: gsap.core.Timeline | null = null;
  private activeLaunchGlows: Array<{ mesh: Mesh; material: MeshBasicMaterial }> = [];
  private activeInstances: InstanceAnimationState[] = [];
  private readonly rolloutConfig = {
    stepDelay: 0.02,
    entryDuration: 0.18,
    initialScale: 0.01,
    ease: "power2.out",
  };

  constructor(private scene: Scene) {
    this.hexGeometryPool = HexGeometryPool.getInstance();

    // Create the instanced material
    this.material = highlightHexInstancedMaterial.clone();
    hexGeometryDebugger.trackMaterialClone("HighlightHexManager.constructor");

    // Get shared geometry
    const hexagonGeometry = this.hexGeometryPool.getGeometry("highlight");
    hexGeometryDebugger.trackSharedGeometryUsage("highlight", "HighlightHexManager.constructor");

    // Create InstancedMesh with capacity for max highlights
    this.instancedMesh = new InstancedMesh(hexagonGeometry, this.material, MAX_HIGHLIGHTS);
    this.instancedMesh.count = 0; // Start with no visible instances
    this.instancedMesh.frustumCulled = true;

    // Initialize instance color buffer
    this.instancedMesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_HIGHLIGHTS * 3), 3);

    // Disable raycasting for the instanced mesh
    this.instancedMesh.raycast = () => {};

    // Add to scene (single draw call for all highlights!)
    this.scene.add(this.instancedMesh);
  }

  highlightHexes(actionPaths: ActionPath[]) {
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();

    // Reset all instances
    this.activeInstances = [];
    this.instancedMesh.count = 0;

    if (actionPaths.length === 0) return;

    const count = Math.min(actionPaths.length, MAX_HIGHLIGHTS);
    this.instancedMesh.count = count;

    const timeline = gsap.timeline();

    // Set up each instance
    for (let i = 0; i < count; i++) {
      const hex = actionPaths[i];
      const position = getWorldPositionForHex(hex.hex);
      const color = getHighlightColorForAction(hex.actionType);

      // Store position for this instance
      tempPosition.set(position.x, 0.175 + this.yOffset, position.z);

      // Create animation state
      const animState: InstanceAnimationState = {
        index: i,
        position: tempPosition.clone(),
        targetScale: 1,
        currentScale: this.rolloutConfig.initialScale,
      };
      this.activeInstances.push(animState);

      // Set initial matrix (invisible scale)
      this.updateInstanceMatrix(i, animState.position, this.rolloutConfig.initialScale);

      // Set instance color
      tempColor.setRGB(color.x, color.y, color.z);
      this.instancedMesh.setColorAt(i, tempColor);

      // Animate scale from initialScale to 1
      const startTime = i * this.rolloutConfig.stepDelay;

      timeline.to(
        animState,
        {
          currentScale: 1,
          duration: this.rolloutConfig.entryDuration,
          ease: this.rolloutConfig.ease,
          onUpdate: () => {
            this.updateInstanceMatrix(animState.index, animState.position, animState.currentScale);
          },
        },
        startTime,
      );

      // Trigger launch glow for first hex
      if (i === 0) {
        this.triggerLaunchGlow(position, color, timeline, startTime);
      }
    }

    // Mark buffers as needing update
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }

    // Compute bounding sphere for frustum culling
    this.instancedMesh.computeBoundingSphere();

    this.highlightTimeline = timeline;
  }

  private updateInstanceMatrix(index: number, position: Vector3, scale: number) {
    tempScale.set(scale, scale, scale);
    tempMatrix.compose(position, HIGHLIGHT_ROTATION, tempScale);
    this.instancedMesh.setMatrixAt(index, tempMatrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  updateHighlightPulse(pulseFactor: number) {
    this.material.uniforms.opacity.value = pulseFactor;
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

    // Remove instanced mesh from scene
    if (this.instancedMesh.parent) {
      this.instancedMesh.parent.remove(this.instancedMesh);
    }

    // Dispose the material (geometry is from the pool, don't dispose it)
    this.material.dispose();

    // Dispose the instanced mesh (handles instance matrix/color buffers)
    this.instancedMesh.dispose();

    // Clear active instances
    this.activeInstances = [];

    console.log("🧹 HighlightHexManager: Disposed InstancedMesh (1 draw call vs N individual meshes)");
  }
}
