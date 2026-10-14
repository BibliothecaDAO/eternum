import { createInstancedMesh } from "../utils/create-instanced-mesh";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { ActionHighlightDescriptor, ActionType } from "@bibliothecadao/eternum";
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
  Vector3,
} from "three";
import { WORLD_HEX_SPACE, type HexSpace } from "../utils/utils";
import { resolveHighlightLayerPalette } from "./worldmap-interaction-palette";
import { resolveHighlightViewTuning } from "./worldmap-highlight-view-policy";

const FRONTIER_ACCENT_COLOR = new Color(0x84f1ff);
const ENDPOINT_ACCENT_LIFT = new Color(0xffffff);
const MAX_HIGHLIGHTS = 500;

const tempMatrix = new Matrix4();
const tempScale = new Vector3();
const tempColor = new Color();
const HIGHLIGHT_ROTATION = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

interface HighlightRenderLayer {
  mesh: InstancedMesh;
  material: MeshBasicMaterial;
  baseOpacity: number;
  opacityPulseScale: number;
  targetScale: number;
  baseY: number;
}

/** Which hexes roll in on a draw, and whether the first one flashes as a new selection does. */
interface HighlightEntry {
  isEntering: (descriptor: ActionHighlightDescriptor) => boolean;
  launchGlow: boolean;
}

const hexKey = (descriptor: ActionHighlightDescriptor): string => `${descriptor.hex.col},${descriptor.hex.row}`;

/** Whether a drawn hex would be drawn the same way: same layers, colour and scale. */
const looksTheSame = (drawn: ActionHighlightDescriptor | undefined, next: ActionHighlightDescriptor): boolean =>
  drawn !== undefined &&
  drawn.actionType === next.actionType &&
  drawn.kind === next.kind &&
  drawn.isEndpoint === next.isEndpoint &&
  drawn.isSharedRoute === next.isSharedRoute;

const isAlreadyDrawn = (
  descriptors: ActionHighlightDescriptor[],
  drawn: ReadonlyMap<string, ActionHighlightDescriptor>,
): boolean =>
  descriptors.length === drawn.size &&
  descriptors.every((descriptor) => looksTheSame(drawn.get(hexKey(descriptor)), descriptor));

const createColorForAction = (actionType: ActionType): Color =>
  new Color(resolveHighlightLayerPalette(actionType).routeColor);

const createMesh = (
  geometry: InstancedMesh["geometry"],
  material: MeshBasicMaterial,
  renderOrder: number,
): InstancedMesh => {
  const mesh = createInstancedMesh(geometry, material, MAX_HIGHLIGHTS);
  mesh.count = 0;
  mesh.frustumCulled = true;
  mesh.renderOrder = renderOrder;
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_HIGHLIGHTS * 3), 3);
  mesh.raycast = () => {};
  return mesh;
};

export class HighlightHexManager {
  private material: MeshBasicMaterial;
  private instancedMesh: InstancedMesh;
  private routeLayer: HighlightRenderLayer;
  private endpointLayer: HighlightRenderLayer;
  private frontierLayer: HighlightRenderLayer;
  private yOffset = 0;
  private cameraView = 2;
  private hexGeometryPool: HexGeometryPool;
  private highlightTimeline: gsap.core.Timeline | null = null;
  private activeLaunchGlows: Array<{ mesh: Mesh; material: MeshBasicMaterial }> = [];
  private drawnDescriptors: ActionHighlightDescriptor[] = [];
  private readonly rolloutConfig = {
    stepDelay: 0.018,
    entryDuration: 0.18,
    initialScale: 0.01,
    ease: "power2.out",
  };

  constructor(
    private scene: Scene,
    /** The owning scene's hex space: the world map's floating origin, or the local realm scene's own lattice. */
    private readonly space: HexSpace = WORLD_HEX_SPACE,
  ) {
    this.hexGeometryPool = HexGeometryPool.getInstance();

    const hexagonGeometry = this.hexGeometryPool.getGeometry("highlight");
    hexGeometryDebugger.trackSharedGeometryUsage("highlight", "HighlightHexManager.constructor");

    this.routeLayer = this.createLayer(hexagonGeometry, {
      color: 0xffffff,
      opacity: 0.16,
      renderOrder: 5,
      baseOpacity: 0.16,
      opacityPulseScale: 1.25,
      targetScale: 0.92,
      baseY: 0.175,
    });
    this.endpointLayer = this.createLayer(hexagonGeometry, {
      color: 0xffffff,
      opacity: 0.22,
      renderOrder: 6,
      baseOpacity: 0.22,
      opacityPulseScale: 1.5,
      targetScale: 0.56,
      baseY: 0.19,
    });
    this.frontierLayer = this.createLayer(hexagonGeometry, {
      color: 0xffffff,
      opacity: 0.3,
      renderOrder: 7,
      baseOpacity: 0.3,
      opacityPulseScale: 1.8,
      targetScale: 0.74,
      baseY: 0.205,
      toneMapped: false,
    });

    this.material = this.routeLayer.material;
    this.instancedMesh = this.routeLayer.mesh;
    this.applyViewTuning();
    this.applyPulseToLayers(0);
  }

  private createLayer(
    geometry: InstancedMesh["geometry"],
    config: {
      color: number;
      opacity: number;
      renderOrder: number;
      baseOpacity: number;
      opacityPulseScale: number;
      targetScale: number;
      baseY: number;
      toneMapped?: boolean;
    },
  ): HighlightRenderLayer {
    const material = new MeshBasicMaterial({
      color: config.color,
      opacity: config.opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: config.toneMapped ?? false,
      vertexColors: true,
    });
    hexGeometryDebugger.trackMaterialClone("HighlightHexManager.createLayer");

    const mesh = createMesh(geometry, material, config.renderOrder);
    this.scene.add(mesh);

    return {
      mesh,
      material,
      baseOpacity: config.baseOpacity,
      opacityPulseScale: config.opacityPulseScale,
      targetScale: config.targetScale,
      baseY: config.baseY,
    };
  }

  /**
   * Draws the given hexes. Hexes already drawn stay where they are and only new ones roll in, so republishing an
   * unchanged set (a new block, a zoom band) changes nothing on screen.
   */
  highlightHexes(descriptors: ActionHighlightDescriptor[]) {
    const next = descriptors.slice(0, MAX_HIGHLIGHTS);
    const drawn = new Map(this.drawnDescriptors.map((descriptor) => [hexKey(descriptor), descriptor]));
    if (isAlreadyDrawn(next, drawn)) {
      return;
    }

    this.drawLayers(next, {
      isEntering: (descriptor) => !drawn.has(hexKey(descriptor)),
      launchGlow: drawn.size === 0,
    });
  }

  private drawLayers(descriptors: ActionHighlightDescriptor[], entry: HighlightEntry): void {
    this.drawnDescriptors = descriptors;
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();

    this.resetLayer(this.routeLayer);
    this.resetLayer(this.endpointLayer);
    this.resetLayer(this.frontierLayer);

    if (descriptors.length === 0) {
      return;
    }

    const timeline = gsap.timeline();
    const endpointDescriptors = descriptors.filter(
      (descriptor) => descriptor.isEndpoint && descriptor.kind !== "frontier",
    );
    const frontierDescriptors = descriptors.filter((descriptor) => descriptor.kind === "frontier");

    const quietEntry = { ...entry, launchGlow: false };

    this.populateLayer(this.routeLayer, descriptors, timeline, entry, {
      getColor: (descriptor) => this.resolveRouteColor(descriptor),
      getScale: (descriptor) =>
        descriptor.isEndpoint
          ? this.routeLayer.targetScale + 0.06
          : descriptor.isSharedRoute
            ? this.routeLayer.targetScale - 0.04
            : this.routeLayer.targetScale,
    });
    this.populateLayer(this.endpointLayer, endpointDescriptors, timeline, quietEntry, {
      getColor: (descriptor) => this.resolveEndpointColor(descriptor),
      getScale: () => this.endpointLayer.targetScale,
    });
    this.populateLayer(this.frontierLayer, frontierDescriptors, timeline, quietEntry, {
      getColor: () => FRONTIER_ACCENT_COLOR,
      getScale: () => this.frontierLayer.targetScale,
    });

    this.highlightTimeline = timeline;
  }

  /** Writes a layer's instances: a hex already drawn sits at its full scale, a new one rolls in after the new ones before it. */
  private populateLayer(
    layer: HighlightRenderLayer,
    descriptors: ActionHighlightDescriptor[],
    timeline: gsap.core.Timeline,
    entry: HighlightEntry,
    style: {
      getColor: (descriptor: ActionHighlightDescriptor) => Color;
      getScale: (descriptor: ActionHighlightDescriptor) => number;
    },
  ): void {
    const count = Math.min(descriptors.length, MAX_HIGHLIGHTS);
    layer.mesh.count = count;
    let enteringIndex = 0;

    for (let i = 0; i < count; i++) {
      const descriptor = descriptors[i];
      const position = this.space.positionForHex(descriptor.hex);
      const instancePosition = new Vector3(position.x, layer.baseY + this.yOffset, position.z);
      const targetScale = style.getScale(descriptor);

      tempColor.copy(style.getColor(descriptor));
      layer.mesh.setColorAt(i, tempColor);

      if (!entry.isEntering(descriptor)) {
        this.updateInstanceMatrix(layer.mesh, i, instancePosition, targetScale);
        continue;
      }

      const startTime = enteringIndex * this.rolloutConfig.stepDelay;
      enteringIndex += 1;
      const animState = { currentScale: this.rolloutConfig.initialScale };
      this.updateInstanceMatrix(layer.mesh, i, instancePosition, animState.currentScale);
      timeline.to(
        animState,
        {
          currentScale: targetScale,
          duration: this.rolloutConfig.entryDuration,
          ease: this.rolloutConfig.ease,
          onUpdate: () => {
            this.updateInstanceMatrix(layer.mesh, i, instancePosition, animState.currentScale);
          },
        },
        startTime,
      );

      if (entry.launchGlow && i === 0) {
        this.triggerLaunchGlow(position, tempColor, timeline, startTime);
      }
    }

    layer.mesh.instanceMatrix.needsUpdate = true;
    if (layer.mesh.instanceColor) {
      layer.mesh.instanceColor.needsUpdate = true;
    }
    layer.mesh.computeBoundingSphere();
  }

  private resolveRouteColor(descriptor: ActionHighlightDescriptor): Color {
    const palette = resolveHighlightLayerPalette(descriptor.actionType as ActionType);
    const color = new Color(palette.routeColor);
    const quietAmount = descriptor.isEndpoint ? 0.78 : descriptor.isSharedRoute ? 0.55 : 0.62;
    return color.multiplyScalar(quietAmount);
  }

  private resolveEndpointColor(descriptor: ActionHighlightDescriptor): Color {
    const palette = resolveHighlightLayerPalette(descriptor.actionType as ActionType);
    const color = new Color(palette.endpointColor);
    return color.lerp(ENDPOINT_ACCENT_LIFT, 0.12);
  }

  private resetLayer(layer: HighlightRenderLayer): void {
    layer.mesh.count = 0;
    layer.mesh.instanceMatrix.needsUpdate = true;
    if (layer.mesh.instanceColor) {
      layer.mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateInstanceMatrix(mesh: InstancedMesh, index: number, position: Vector3, scale: number) {
    tempScale.set(scale, scale, scale);
    tempMatrix.compose(position, HIGHLIGHT_ROTATION, tempScale);
    mesh.setMatrixAt(index, tempMatrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  updateHighlightPulse(pulseFactor: number) {
    this.applyPulseToLayers(Math.max(0, pulseFactor));
  }

  private applyPulseToLayers(pulseFactor: number): void {
    [this.routeLayer, this.endpointLayer, this.frontierLayer].forEach((layer) => {
      layer.material.opacity = layer.baseOpacity + pulseFactor * layer.opacityPulseScale;
    });
  }

  setYOffset(yOffset: number) {
    this.yOffset = yOffset;
  }

  setCameraView(cameraView: number) {
    if (this.cameraView === cameraView) {
      return;
    }

    this.cameraView = cameraView;
    this.applyViewTuning();
    if (this.drawnDescriptors.length > 0) {
      this.drawLayers(this.drawnDescriptors, { isEntering: () => false, launchGlow: false });
    }
  }

  getDebugState() {
    return {
      cameraView: this.cameraView,
      routeCount: this.routeLayer.mesh.count,
      endpointCount: this.endpointLayer.mesh.count,
      frontierCount: this.frontierLayer.mesh.count,
    };
  }

  private applyViewTuning(): void {
    const tuning = resolveHighlightViewTuning(this.cameraView);
    this.routeLayer.baseOpacity = tuning.routeOpacity;
    this.endpointLayer.baseOpacity = tuning.endpointOpacity;
    this.frontierLayer.baseOpacity = tuning.frontierOpacity;
    this.routeLayer.targetScale = tuning.routeScale;
    this.endpointLayer.targetScale = tuning.endpointScale;
    this.frontierLayer.targetScale = tuning.frontierScale;
    this.applyPulseToLayers(0);
  }

  private triggerLaunchGlow(position: Vector3, color: Color, timeline: gsap.core.Timeline, startTime: number) {
    const glowMaterial = new MeshBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    const glowMesh = new Mesh(this.hexGeometryPool.getGeometry("highlight"), glowMaterial);
    glowMesh.position.set(position.x, this.routeLayer.baseY + this.yOffset, position.z);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.scale.setScalar(0.42);
    glowMesh.renderOrder = 8;
    glowMesh.raycast = () => {};

    const glowEntry = { mesh: glowMesh, material: glowMaterial };
    this.activeLaunchGlows.push(glowEntry);
    this.scene.add(glowMesh);

    timeline.to(
      glowMaterial,
      {
        opacity: 0.8,
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
        x: 1.5,
        y: 1.5,
        z: 1.5,
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

    [this.routeLayer, this.endpointLayer, this.frontierLayer].forEach((layer) => {
      if (layer.mesh.parent) {
        layer.mesh.parent.remove(layer.mesh);
      }
      layer.material.dispose();
      layer.mesh.dispose();
    });
  }
}
