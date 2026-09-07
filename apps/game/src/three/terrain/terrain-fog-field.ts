import {
  ClampToEdgeWrapping,
  DataTexture,
  Group,
  LinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  UnsignedByteType,
  Vector3,
  Vector4,
} from "three";
import type Node from "three/src/nodes/core/Node.js";
import type TextureNode from "three/src/nodes/accessors/TextureNode.js";
import type UniformNode from "three/src/nodes/core/UniformNode.js";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  color,
  float,
  fwidth,
  mix,
  mx_noise_float,
  positionWorld,
  smoothstep,
  texture,
  time,
  uniform,
  vec2,
  vec3,
} from "three/tsl";

import { terrainCellKey } from "./terrain-coordinates";
import { createEtherealEnergy } from "./terrain-ethereal-material";
import { terrainHexEdgeDistance } from "./terrain-hex-node";
import {
  buildTerrainFogMask,
  isSameTerrainFogMaskLayout,
  resolveTerrainFogInfluence,
  resolveTerrainFogMaskLayout,
  writeTerrainFogMaskRegion,
  type TerrainFogMask,
  type TerrainFogMaskBounds,
  type TerrainFogMaskLayout,
} from "./terrain-fog-mask";
import {
  TERRAIN_DEEP_FOG_COLOR,
  TERRAIN_DEEP_FOG_OPACITY,
  TERRAIN_FOG_GROUND_HEIGHT,
  type TerrainFogStyle,
} from "./terrain-fog-style";
import type { TerrainShroudInstance } from "./terrain-types";

export const TERRAIN_FOG_CELL_CAPACITY = 12_288;
export { TERRAIN_FOG_REVEAL_DURATION_SECONDS } from "./terrain-fog-reveal";
import { TerrainFogReveal, resolveFogRevealDirection } from "./terrain-fog-reveal";
import type NodeMaterial from "three/src/materials/nodes/NodeMaterial.js";

export interface TerrainFogFieldStats {
  activeReveals: number;
  frontierInstances: number;
  instances: number;
  maskBytes: number;
  maskHeight: number;
  maskWidth: number;
  triangles: number;
}

export interface TerrainFogMaskMetrics {
  /** Whole-window mask builds: the fog window moved, or the first fog appeared. */
  fullRebuilds: number;
  /** Sub-rect writes: a changed page re-rasterised only its own area. */
  pageWrites: number;
  texelsWritten: number;
}

interface FogMaterialSet {
  bounds: ReturnType<typeof createFogBounds>;
  streaming: UniformNode<"float", number>;
  clarity: UniformNode<"float", number>;
  material: MeshBasicNodeMaterial;
  maskTexture: TextureNode;
  mistStrength: UniformNode<"float", number>;
  motionStrength: UniformNode<"float", number>;
}

const FOG_MESH_NAME = "terrain-exploration-fog-field";
// Fog owns the logical unknown-tile surface; real terrain draws over this background at any elevation.
const FOG_PLANE_HEIGHT = TERRAIN_FOG_GROUND_HEIGHT;

/**
 * One background covers unknown and unloaded ground; explored geometry replaces it in the opaque pass.
 * A commit rebuilds the whole coverage mask only when the fog window moves and otherwise re-rasterises the sub-rects the
 * changed pages touched.
 */
export class TerrainFogField {
  readonly object3d = new Group();
  private textureData = new Uint8Array(1);
  private maskTexture = createFogMaskTexture(this.textureData, 1, 1);
  private maskTextureHeight = 1;
  private maskTextureWidth = 1;
  private readonly materials = createFogMaterial(this.maskTexture);
  private streaming = false;
  private readonly fogMesh = createFogMesh(this.materials.material);
  private readonly pages = new Map<string, readonly TerrainShroudInstance[]>();
  private readonly renderedInstances = new Map<string, TerrainShroudInstance>();
  private readonly reveal = new TerrainFogReveal();
  private readonly queuedReveals = new Map<string, readonly [number, number]>();
  private readonly dirtyRegions: TerrainFogMaskBounds[] = [];
  private readonly metrics: TerrainFogMaskMetrics = { fullRebuilds: 0, pageWrites: 0, texelsWritten: 0 };
  private mask: TerrainFogMask | null = null;
  private frontierInstances = 0;

  constructor() {
    this.object3d.name = "terrain-exploration-fog-field";
    this.object3d.add(this.fogMesh);
  }

  enableStreaming(): void {
    this.streaming = true;
    this.materials.streaming.value = 1;
    this.fogMesh.position.set(0, FOG_PLANE_HEIGHT, 0);
    const cameraWorldPosition = new Vector3();
    this.fogMesh.onBeforeRender = (_renderer, _scene, camera) => {
      if (!(camera instanceof PerspectiveCamera)) return;
      // Million-unit triangles lose depth precision and intermittently cover resident ground while panning.
      camera.getWorldPosition(cameraWorldPosition);
      this.fogMesh.position.set(cameraWorldPosition.x, FOG_PLANE_HEIGHT, cameraWorldPosition.z);
      this.fogMesh.scale.setScalar(camera.far * 2 + 4);
      this.fogMesh.updateMatrixWorld();
    };
    this.fogMesh.visible = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.reveal.setReducedMotion(reduced);
  }

  setPage(pageKey: string, instances: readonly TerrainShroudInstance[]): void {
    const previous = this.pages.get(pageKey) ?? [];
    const nextByKey = new Map(instances.map((instance) => [instanceKey(instance), instance]));
    previous.forEach((instance) => {
      if (!nextByKey.has(instanceKey(instance))) this.releasePageCell(instance);
    });
    instances.forEach((instance) => this.renderPageCell(instance));
    this.pages.set(pageKey, instances);
    requireFogCapacity(this.renderedInstances.size);
    this.markDirty(resolveChangedFogCells(previous, nextByKey));
  }

  removePage(pageKey: string): void {
    this.setPage(pageKey, []);
    this.pages.delete(pageKey);
  }

  /** Applies the page changes since the last commit; `preparedMask` is adopted only if it fits the new window. */
  commit(preparedMask: TerrainFogMask | null = null): void {
    const layout = resolveTerrainFogMaskLayout(this.renderedInstances.values());
    if (!layout) {
      this.mask = null;
      this.dirtyRegions.length = 0;
      this.textureData.fill(0);
      this.maskTexture.needsUpdate = true;
      this.fogMesh.visible = this.streaming;
      return;
    }
    if (this.mask && isSameTerrainFogMaskLayout(this.mask, layout)) this.writeDirtyRegions(this.mask);
    else this.rebuildMask(layout, preparedMask);
    this.uploadFogMask();
  }

  /** The cells the next commit will render for these incoming pages, including cells held back by pending reveals. */
  resolveIncomingFogCells(instances: readonly TerrainShroudInstance[]): TerrainShroudInstance[] {
    const incoming = new Map(instances.map((instance) => [instanceKey(instance), instance]));
    this.queuedReveals.forEach((_direction, key) => retainFogCell(incoming, this.renderedInstances, key));
    requireFogCapacity(incoming.size);
    return Array.from(incoming.values());
  }

  requiresMaskRebuild(instances: readonly TerrainShroudInstance[]): boolean {
    const layout = resolveTerrainFogMaskLayout(instances);
    return layout !== null && (!this.mask || !isSameTerrainFogMaskLayout(this.mask, layout));
  }

  queueReveal(col: number, row: number, source?: { col: number; row: number }): void {
    const key = terrainCellKey(col, row);
    const instance = this.renderedInstances.get(key);
    if (instance)
      this.queuedReveals.set(key, resolveFogRevealDirection({ col, row }, source, instance.frontierDirection));
  }

  cancelReveals(): void {
    this.queuedReveals.clear();
    this.reveal.clear();
  }

  applyRevealToMaterial(material: NodeMaterial): void {
    this.reveal.applyToMaterial(material);
  }

  updateAnimation(deltaSeconds: number): void {
    this.reveal.update(deltaSeconds);
  }

  setStyle(style: TerrainFogStyle): void {
    this.materials.clarity.value = style === "clear" ? 1 : 0;
  }

  setQuality(motionStrength: number, mistStrength: number): void {
    this.materials.motionStrength.value = clampUnit(motionStrength);
    this.materials.mistStrength.value = clampUnit(mistStrength);
  }

  getStats(): TerrainFogFieldStats {
    return {
      activeReveals: this.reveal.size,
      frontierInstances: this.frontierInstances,
      instances: this.renderedInstances.size,
      maskBytes: this.mask ? this.textureData.byteLength : 0,
      maskHeight: this.mask?.height ?? 0,
      maskWidth: this.mask?.width ?? 0,
      triangles: this.fogMesh.visible ? 2 : 0,
    };
  }

  getMetrics(): TerrainFogMaskMetrics {
    return { ...this.metrics };
  }

  dispose(): void {
    this.fogMesh.geometry.dispose();
    this.materials.material.dispose();
    this.maskTexture.dispose();
    this.reveal.dispose();
    this.queuedReveals.clear();
    this.pages.clear();
    this.renderedInstances.clear();
    this.dirtyRegions.length = 0;
    this.object3d.clear();
    this.mask = null;
  }

  private renderPageCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    this.releaseRenderedCell(instance);
    this.renderedInstances.set(key, instance);
    if (instance.frontier) this.frontierInstances += 1;
  }

  private releasePageCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    const direction = this.queuedReveals.get(key);
    this.queuedReveals.delete(key);
    this.releaseRenderedCell(instance);
    // This removal and the incoming terrain are committed atomically; begin the sweep only now.
    if (direction) this.reveal.start(instance.col, instance.row, direction);
  }

  private releaseRenderedCell(instance: TerrainShroudInstance): void {
    const key = instanceKey(instance);
    const rendered = this.renderedInstances.get(key);
    if (!rendered) return;
    this.renderedInstances.delete(key);
    if (rendered.frontier) this.frontierInstances -= 1;
  }

  private markDirty(instances: readonly TerrainShroudInstance[]): void {
    const region = resolveTerrainFogInfluence(instances);
    if (region) this.dirtyRegions.push(region);
  }

  private rebuildMask(layout: TerrainFogMaskLayout, preparedMask: TerrainFogMask | null): void {
    const prepared = preparedMask && isSameTerrainFogMaskLayout(preparedMask, layout) ? preparedMask : null;
    this.mask = prepared ?? buildTerrainFogMask(Array.from(this.renderedInstances.values()));
    this.dirtyRegions.length = 0;
    this.metrics.fullRebuilds += 1;
    this.positionFogMesh(layout.bounds);
  }

  private writeDirtyRegions(mask: TerrainFogMask): void {
    for (const region of this.dirtyRegions) {
      this.metrics.texelsWritten += writeTerrainFogMaskRegion(mask, this.renderedInstances.values(), region);
      this.metrics.pageWrites += 1;
    }
    this.dirtyRegions.length = 0;
  }

  private positionFogMesh({ maxX, maxZ, minX, minZ }: TerrainFogMaskBounds): void {
    this.materials.bounds.value.set(minX, minZ, maxX - minX, maxZ - minZ);
    if (this.streaming) return;
    this.fogMesh.position.set((minX + maxX) / 2, FOG_PLANE_HEIGHT, (minZ + maxZ) / 2);
    this.fogMesh.scale.set(maxX - minX, 1, maxZ - minZ);
    this.fogMesh.visible = true;
  }

  private uploadFogMask(): void {
    if (!this.mask) return;
    this.resizeFogMaskTexture(this.mask.width, this.mask.height);
    this.textureData.set(this.mask.data);
    this.maskTexture.needsUpdate = true;
  }

  private resizeFogMaskTexture(width: number, height: number): void {
    if (this.maskTextureWidth === width && this.maskTextureHeight === height) return;
    const previousTexture = this.maskTexture;
    this.textureData = new Uint8Array(width * height);
    this.maskTexture = createFogMaskTexture(this.textureData, width, height);
    this.maskTextureWidth = width;
    this.maskTextureHeight = height;
    this.materials.maskTexture.value = this.maskTexture;
    previousTexture.dispose();
  }
}

function createFogMaskTexture(data: Uint8Array, width: number, height: number): DataTexture {
  const mask = new DataTexture(data, width, height, RedFormat, UnsignedByteType);
  mask.name = "terrain-exploration-fog-mask";
  mask.minFilter = LinearFilter;
  mask.magFilter = LinearFilter;
  mask.wrapS = ClampToEdgeWrapping;
  mask.wrapT = ClampToEdgeWrapping;
  mask.flipY = true;
  mask.generateMipmaps = false;
  mask.needsUpdate = true;
  return mask;
}

function createFogBounds() {
  return uniform(new Vector4(0, 0, 1, 1));
}

function createFogMaterial(maskTexture: DataTexture): FogMaterialSet {
  const bounds = createFogBounds();
  const streaming = uniform(0, "float");
  const clarity = uniform(1, "float");
  const motionStrength = uniform(1, "float");
  const mistStrength = uniform(1, "float");
  const material = new MeshBasicNodeMaterial();
  material.name = "terrain-exploration-mist";
  material.transparent = false;
  material.depthTest = false;
  material.depthWrite = false;
  material.alphaTest = 0.001;
  material.toneMapped = true;
  material.fog = false;

  const drift = time.mul(motionStrength);
  // Anchor drifting color to the backdrop rather than screen coordinates.
  const fogGround = positionWorld;
  const broadMist = mx_noise_float(
    vec3(fogGround.x.mul(0.16).add(drift.mul(0.06)), fogGround.z.mul(0.16).sub(drift.mul(0.04)), drift.mul(0.025)),
  );
  const wisps = mx_noise_float(
    vec3(
      fogGround.x.mul(0.7).add(broadMist.mul(0.7)).sub(drift.mul(0.12)),
      fogGround.z.mul(0.7).add(drift.mul(0.08)),
      drift.mul(0.06),
    ),
  );
  const mistNoise = broadMist.mul(0.55).add(wisps.mul(0.45)).add(0.5).clamp(0, 1);
  const worldUv = positionWorld.xz.sub(bounds.xy).div(bounds.zw);
  const inside = worldUv.x
    .greaterThanEqual(0)
    .and(worldUv.x.lessThanEqual(1))
    .and(worldUv.y.greaterThanEqual(0))
    .and(worldUv.y.lessThanEqual(1));
  const maskTextureNode = texture(maskTexture, vec2(worldUv.x, float(1).sub(worldUv.y)));
  const exploration = inside.select(maskTextureNode.r, float(0));
  const mask = exploration;
  // Compress the veil toward unexplored ground so known coastlines and units stay legible.
  // Both treatments share the same authoritative mask and fully covered interior.
  const edgeBand = smoothstep(0.12, 0.48, mask).mul(float(1).sub(smoothstep(0.68, 1, mask)));
  // The unexplored world recedes into charcoal; moving wisps gather where solid ground ends.
  // Keep a little movement in the interior without turning it into a bright cloud-covered surface.
  const cloudVeil = smoothstep(0.18, 0.86, mistNoise).mul(mistStrength);
  const mistLight = cloudVeil.mul(edgeBand.mul(0.24).add(0.12));
  const etherealHint = createEtherealEnergy(fogGround.xz, drift, mistNoise).mul(0.045);
  const fogColor = mix(color(TERRAIN_DEEP_FOG_COLOR), color("#85877f"), mistLight).add(etherealHint);
  // Motion changes the mist's color, never the exploration boundary or coverage.
  const coverage = smoothstep(mix(0.04, 0.28, clarity), mix(0.96, 0.8, clarity), mask);
  const frontierOpacity = coverage.clamp(0, TERRAIN_DEEP_FOG_OPACITY);
  const deepFog = smoothstep(0.9, 0.985, mask);
  const surfaceOpacity = mix(frontierOpacity, float(TERRAIN_DEEP_FOG_OPACITY), deepFog);
  material.colorNode = shadeFogHexBoundary(fogColor, fogGround.xz);
  material.opacityNode = mix(surfaceOpacity, float(1), streaming);
  return {
    bounds,
    streaming,
    clarity,
    material,
    maskTexture: maskTextureNode,
    mistStrength,
    motionStrength,
  };
}

function shadeFogHexBoundary(surfaceColor: Node<"vec3">, ground: Node<"vec2">): Node<"vec3"> {
  const edgeDistance = terrainHexEdgeDistance(ground);
  const pixelWidth = fwidth(edgeDistance).max(0.001);
  const border = smoothstep(0.008, pixelWidth.mul(1.2).add(0.008), edgeDistance).oneMinus();
  return mix(surfaceColor, color("#747970"), border.mul(0.2));
}

function createFogMesh(material: MeshBasicNodeMaterial): Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  const geometry = new PlaneGeometry(1, 1, 1, 1);
  geometry.name = "terrain-exploration-fog-sheet-geometry";
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = FOG_MESH_NAME;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  // Draw first without writing depth, so even sea beds and water below the fog height replace it.
  mesh.renderOrder = -1_000;
  mesh.raycast = disableFogRaycast;
  mesh.visible = false;
  return mesh;
}

/** The cells whose mask contribution differs between a page's previous and next shroud, old and new alike. */
function resolveChangedFogCells(
  previous: readonly TerrainShroudInstance[],
  nextByKey: ReadonlyMap<string, TerrainShroudInstance>,
): TerrainShroudInstance[] {
  const changed: TerrainShroudInstance[] = [];
  const unchangedKeys = new Set<string>();
  for (const instance of previous) {
    const key = instanceKey(instance);
    const next = nextByKey.get(key);
    if (next && isSameFogCell(instance, next)) unchangedKeys.add(key);
    else changed.push(instance);
  }
  nextByKey.forEach((instance, key) => {
    if (!unchangedKeys.has(key)) changed.push(instance);
  });
  return changed;
}

function isSameFogCell(left: TerrainShroudInstance, right: TerrainShroudInstance): boolean {
  return (
    left.frontier === right.frontier &&
    left.frontierDirection[0] === right.frontierDirection[0] &&
    left.frontierDirection[1] === right.frontierDirection[1] &&
    left.worldX === right.worldX &&
    left.worldZ === right.worldZ
  );
}

function retainFogCell(
  incoming: Map<string, TerrainShroudInstance>,
  rendered: ReadonlyMap<string, TerrainShroudInstance>,
  key: string,
): void {
  if (incoming.has(key)) return;
  const retained = rendered.get(key);
  if (retained) incoming.set(key, retained);
}

function requireFogCapacity(count: number): void {
  if (count > TERRAIN_FOG_CELL_CAPACITY) {
    throw new Error(`Terrain exploration fog exceeded ${TERRAIN_FOG_CELL_CAPACITY} cells`);
  }
}

function instanceKey(instance: Pick<TerrainShroudInstance, "col" | "row">): string {
  return terrainCellKey(instance.col, instance.row);
}

function disableFogRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}
