import { type TerrainSurface } from "@/three/terrain/terrain-surface";
import { hexGeometryDebugger } from "@/three/utils/hex-geometry-debug";
import { HexGeometryPool } from "@/three/utils/hex-geometry-pool";
import { ActionHighlightDescriptor, ActionType } from "@bibliothecadao/eternum";
import gsap from "gsap";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  Scene,
  Vector3,
} from "three";
import { WORLD_HEX_SPACE, type HexSpace } from "../utils/utils";
import { layOnGround, layCopyOnGround } from "./hex-ring";
import {
  HIGHLIGHT_LAYER_PALETTES,
  plotLookOn,
  resolveHighlightLayerPalette,
  type HighlightLayerPalette,
} from "./worldmap-interaction-palette";
import { BiomeType } from "@bibliothecadao/types";
import { resolveHighlightViewTuning } from "./worldmap-highlight-view-policy";

const FRONTIER_ACCENT_COLOR = new Color(0x84f1ff);
const ENDPOINT_ACCENT_LIFT = new Color(0xffffff);
const MAX_HIGHLIGHTS = 500;
const FACE_STEPS = 4;

interface PlateCopy {
  x: number;
  z: number;
  scale: number;
  color: Color;
}

interface HighlightRenderLayer {
  mesh: Mesh;
  material: MeshBasicMaterial;
  baseOpacity: number;
  opacityPulseScale: number;
  targetScale: number;
  /** How far above its hex's ground the layer lies. */
  lift: number;
  copies: PlateCopy[];
}

/** Which hexes roll in on a draw, and whether the first one flashes as a new selection does. */
interface HighlightEntry {
  isEntering: (descriptor: ActionHighlightDescriptor) => boolean;
  launchGlow: boolean;
}

const hexKey = (descriptor: ActionHighlightDescriptor): string => `${descriptor.hex.col},${descriptor.hex.row}`;

const sameOptionalHex = (
  left: { col: number; row: number } | null,
  right: { col: number; row: number } | null,
): boolean => left === right || (left !== null && right !== null && left.col === right.col && left.row === right.row);

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

const createMesh = (material: MeshBasicMaterial, renderOrder: number): Mesh => {
  const mesh = new Mesh(new BufferGeometry(), material);
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.raycast = () => {};
  return mesh;
};

const paintCopies = (geometry: BufferGeometry, copies: readonly PlateCopy[], verticesPerCopy: number): void => {
  const colors = new Float32Array(copies.length * verticesPerCopy * 3);
  copies.forEach(({ color }, copy) => {
    for (let vertex = 0; vertex < verticesPerCopy; vertex++)
      color.toArray(colors, (copy * verticesPerCopy + vertex) * 3);
  });
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
};

export class HighlightHexManager {
  private readonly plate: BufferGeometry;
  private routeLayer: HighlightRenderLayer;
  private endpointLayer: HighlightRenderLayer;
  private frontierLayer: HighlightRenderLayer;
  private teachLayer: HighlightRenderLayer;
  private cameraView = 2;
  private hexGeometryPool: HexGeometryPool;
  private highlightTimeline: gsap.core.Timeline | null = null;
  private activeLaunchGlows: Array<{ mesh: Mesh; material: MeshBasicMaterial }> = [];
  private drawnDescriptors: ActionHighlightDescriptor[] = [];
  private teachHex: { col: number; row: number } | null = null;
  private litPlotPalette: HighlightLayerPalette = plotLookOn(BiomeType.Grassland).lit;
  private readonly rolloutConfig = {
    stepDelay: 0.018,
    entryDuration: 0.18,
    initialScale: 0.01,
    ease: "power2.out",
  };

  constructor(
    private scene: Scene,
    /** The ground every lit hex lies on. */
    private readonly terrain: TerrainSurface,
    /** The owning scene's hex space: the world map's floating origin, or the local realm scene's own lattice. */
    private readonly space: HexSpace = WORLD_HEX_SPACE,
  ) {
    this.hexGeometryPool = HexGeometryPool.getInstance();

    this.plate = this.hexGeometryPool.getGeometry("highlight");
    hexGeometryDebugger.trackSharedGeometryUsage();

    this.routeLayer = this.createLayer({
      color: 0xffffff,
      opacity: 0.16,
      renderOrder: 5,
      baseOpacity: 0.16,
      opacityPulseScale: 1.25,
      targetScale: 0.92,
      lift: 0.03,
    });
    this.endpointLayer = this.createLayer({
      color: 0xffffff,
      opacity: 0.22,
      renderOrder: 6,
      baseOpacity: 0.22,
      opacityPulseScale: 1.5,
      targetScale: 0.56,
      lift: 0.04,
    });
    this.frontierLayer = this.createLayer({
      color: 0xffffff,
      opacity: 0.3,
      renderOrder: 7,
      baseOpacity: 0.3,
      opacityPulseScale: 1.8,
      targetScale: 0.74,
      lift: 0.05,
      toneMapped: false,
    });
    this.teachLayer = this.createLayer({
      color: 0xffffff,
      opacity: 0.28,
      renderOrder: 8,
      baseOpacity: 0.28,
      opacityPulseScale: 0,
      targetScale: 0.96,
      lift: 0.035,
      toneMapped: false,
    });

    this.applyViewTuning();
    this.applyPulseToLayers(0);
  }

  private createLayer(config: {
    color: number;
    opacity: number;
    renderOrder: number;
    baseOpacity: number;
    opacityPulseScale: number;
    targetScale: number;
    lift: number;
    toneMapped?: boolean;
  }): HighlightRenderLayer {
    const material = new MeshBasicMaterial({
      color: config.color,
      opacity: config.opacity,
      transparent: true,
      depthWrite: false,
      toneMapped: config.toneMapped ?? false,
      vertexColors: true,
      side: DoubleSide,
    });
    hexGeometryDebugger.trackMaterialClone();

    const mesh = createMesh(material, config.renderOrder);
    this.scene.add(mesh);

    return {
      mesh,
      material,
      baseOpacity: config.baseOpacity,
      opacityPulseScale: config.opacityPulseScale,
      targetScale: config.targetScale,
      lift: config.lift,
      copies: [],
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

  setTeachHex(hex: { col: number; row: number } | null): void {
    const next = hex ? { col: hex.col, row: hex.row } : null;
    if (sameOptionalHex(this.teachHex, next)) {
      return;
    }
    this.teachHex = next;
    this.renderTeachHex();
  }

  private renderTeachHex(): void {
    if (!this.teachHex) {
      this.resetLayer(this.teachLayer);
      return;
    }
    const palette = HIGHLIGHT_LAYER_PALETTES.teach;
    const { x, z } = this.space.positionForHex(this.teachHex);
    this.drapeLayer(this.teachLayer, [
      { x, z, scale: this.teachLayer.targetScale, color: new Color(palette.routeColor) },
      { x, z, scale: this.endpointLayer.targetScale, color: new Color(palette.endpointColor) },
    ]);
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
    const copies = descriptors.slice(0, MAX_HIGHLIGHTS).map((descriptor) => {
      const { x, z } = this.space.positionForHex(descriptor.hex);
      const scale = entry.isEntering(descriptor) ? this.rolloutConfig.initialScale : style.getScale(descriptor);
      return { x, z, scale, color: style.getColor(descriptor).clone() };
    });
    this.drapeLayer(layer, copies);

    let enteringIndex = 0;
    copies.forEach((copy, index) => {
      const descriptor = descriptors[index];
      if (!entry.isEntering(descriptor)) return;
      const startTime = enteringIndex * this.rolloutConfig.stepDelay;
      enteringIndex += 1;
      timeline.to(
        copy,
        {
          scale: style.getScale(descriptor),
          duration: this.rolloutConfig.entryDuration,
          ease: this.rolloutConfig.ease,
          onUpdate: () => layCopyOnGround(layer.mesh.geometry, index, this.plate, copy, this.terrain, layer.lift),
        },
        startTime,
      );
      if (entry.launchGlow && index === 0) this.triggerLaunchGlow(copy, layer.lift, timeline, startTime);
    });
  }

  private drapeLayer(layer: HighlightRenderLayer, copies: PlateCopy[]): void {
    layer.copies = copies;
    layer.mesh.visible = copies.length > 0;
    layer.mesh.geometry.dispose();
    layer.mesh.geometry = layOnGround(this.plate, copies, this.terrain, layer.lift);
    paintCopies(layer.mesh.geometry, copies, this.plate.getAttribute("position").count);
  }

  setLitPlotPalette(palette: HighlightLayerPalette): void {
    this.litPlotPalette = palette;
    this.redrawInPlace();
  }

  private paletteOf(descriptor: ActionHighlightDescriptor): HighlightLayerPalette {
    return descriptor.actionType === ActionType.Build
      ? this.litPlotPalette
      : resolveHighlightLayerPalette(descriptor.actionType);
  }

  private resolveRouteColor(descriptor: ActionHighlightDescriptor): Color {
    const palette = this.paletteOf(descriptor);
    const color = new Color(palette.routeColor);
    const quietAmount = descriptor.isEndpoint ? 0.78 : descriptor.isSharedRoute ? 0.55 : 0.62;
    return color.multiplyScalar(quietAmount);
  }

  private resolveEndpointColor(descriptor: ActionHighlightDescriptor): Color {
    const palette = this.paletteOf(descriptor);
    const color = new Color(palette.endpointColor);
    return color.lerp(ENDPOINT_ACCENT_LIFT, 0.12);
  }

  private resetLayer(layer: HighlightRenderLayer): void {
    this.drapeLayer(layer, []);
  }

  updateHighlightPulse(pulseFactor: number) {
    this.applyPulseToLayers(Math.max(0, pulseFactor));
  }

  private applyPulseToLayers(pulseFactor: number): void {
    [this.routeLayer, this.endpointLayer, this.frontierLayer, this.teachLayer].forEach((layer) => {
      layer.material.opacity = layer.baseOpacity + pulseFactor * layer.opacityPulseScale;
    });
  }

  setCameraView(cameraView: number) {
    if (this.cameraView === cameraView) {
      return;
    }

    this.cameraView = cameraView;
    this.applyViewTuning();
    this.redrawInPlace();
  }

  /** Draws the lit hexes again at their full size, none rolling in. */
  private redrawInPlace(): void {
    if (this.drawnDescriptors.length > 0) {
      this.drawLayers(this.drawnDescriptors, { isEntering: () => false, launchGlow: false });
    }
    this.renderTeachHex();
  }

  /** What is drawn, for the page's dev report: each layer's count and the centre of every plate on every layer. */
  getDebugState() {
    const layers = {
      route: this.routeLayer,
      endpoint: this.endpointLayer,
      frontier: this.frontierLayer,
      teach: this.teachLayer,
    };
    return {
      cameraView: this.cameraView,
      routeCount: this.routeLayer.copies.length,
      endpointCount: this.endpointLayer.copies.length,
      frontierCount: this.frontierLayer.copies.length,
      teachCount: this.teachLayer.copies.length,
      plates: Object.entries(layers).flatMap(([name, layer]) =>
        layer.copies.map((copy, index) => ({
          layer: name,
          x: copy.x,
          z: copy.z,
          scale: copy.scale,
          ...this.clearance(layer, index),
        })),
      ),
    };
  }

  private clearance(layer: HighlightRenderLayer, copyIndex: number): { lowest: number; highest: number } {
    const positions = layer.mesh.geometry.getAttribute("position");
    const index = layer.mesh.geometry.getIndex();
    const perCopy = this.plate.getIndex()?.count ?? 0;
    if (!index) throw new Error("A lit plate has no faces to measure");
    let lowest = Infinity;
    let highest = -Infinity;
    for (let corner = copyIndex * perCopy; corner < (copyIndex + 1) * perCopy; corner += 3) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        new Vector3().fromBufferAttribute(positions, index.getX(corner + offset)),
      );
      for (let u = 0; u <= FACE_STEPS; u++)
        for (let v = 0; v <= FACE_STEPS - u; v++) {
          const point = a
            .clone()
            .multiplyScalar(1 - (u + v) / FACE_STEPS)
            .addScaledVector(b, u / FACE_STEPS)
            .addScaledVector(c, v / FACE_STEPS);
          const above = point.y - this.terrain.sampleHeight(point.x, point.z);
          lowest = Math.min(lowest, above);
          highest = Math.max(highest, above);
        }
    }
    return { lowest, highest };
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

  private triggerLaunchGlow(from: PlateCopy, lift: number, timeline: gsap.core.Timeline, startTime: number) {
    const glowMaterial = new MeshBasicMaterial({
      color: from.color.clone(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      side: DoubleSide,
    });

    const glow = { x: from.x, z: from.z, scale: 0.42 };
    const glowMesh = new Mesh(layOnGround(this.plate, [glow], this.terrain, lift), glowMaterial);
    glowMesh.frustumCulled = false;
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
      glow,
      {
        scale: 1.5,
        duration: 0.3,
        ease: "power2.out",
        onUpdate: () => layCopyOnGround(glowMesh.geometry, 0, this.plate, glow, this.terrain, lift),
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

    entry.mesh.geometry.dispose();
    entry.material.dispose();
  }

  private cleanupLaunchGlows() {
    this.activeLaunchGlows.forEach((entry) => {
      if (entry.mesh.parent) {
        entry.mesh.parent.remove(entry.mesh);
      }

      entry.mesh.geometry.dispose();
      entry.material.dispose();
    });

    this.activeLaunchGlows = [];
  }

  public dispose(): void {
    this.highlightTimeline?.kill();
    this.highlightTimeline = null;
    this.cleanupLaunchGlows();

    [this.routeLayer, this.endpointLayer, this.frontierLayer, this.teachLayer].forEach((layer) => {
      if (layer.mesh.parent) {
        layer.mesh.parent.remove(layer.mesh);
      }
      layer.material.dispose();
      layer.mesh.geometry.dispose();
    });
  }
}
