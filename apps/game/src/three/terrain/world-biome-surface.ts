import { BiomeType } from "@bibliothecadao/types";
import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";

import { terrainHexCorners, terrainHexToWorld } from "./terrain-coordinates";
import { hexCellKey } from "./hex-cell-key";
import { TERRAIN_DEEP_FOG_COLOR } from "./terrain-fog-style";
import { TERRAIN_BIOME_DESCRIPTORS } from "./terrain-palette";

/**
 * Whole-world far-LOD ground: one flat hex per explored tile in its biome's
 * palette colour, over one shroud plane that reaches beyond the camera's
 * furthest zoom-out. Detailed terrain pages composite on top, so the surface
 * sits under every page vertex. Two draw calls at most; no growth.
 */

export const WORLD_BIOME_SURFACE_CAPACITY = 65_536;
// Lowest detailed page vertex: DeepOcean base -0.34, elevation -0.02, macro
// landform -0.017, relief -0.01, then the 0.24 frontier skirt ≈ -0.63.
export const WORLD_BIOME_SURFACE_HEIGHT = -0.7;
export const WORLD_BIOME_SHROUD_HEIGHT = WORLD_BIOME_SURFACE_HEIGHT - 0.02;
export const WORLD_BIOME_SHROUD_MARGIN_HEXES = 64;

const MATRIX_STRIDE = 16;
const COLOR_STRIDE = 3;

export interface WorldBiomeSurfaceMetrics {
  commits: number;
  drawCalls: number;
  instanceCount: number;
  pendingWrites: number;
  uploadedInstances: number;
}

interface HexExtents {
  maxCol: number;
  maxRow: number;
  minCol: number;
  minRow: number;
}

interface DirtySlotRange {
  max: number;
  min: number;
}

const BIOME_GROUND_COLORS = buildBiomeGroundColors();

export class WorldBiomeSurface {
  readonly object3d = new Group();
  readonly metrics: WorldBiomeSurfaceMetrics = {
    commits: 0,
    drawCalls: 1,
    instanceCount: 0,
    pendingWrites: 0,
    uploadedInstances: 0,
  };
  private readonly hexMesh = createBiomeHexMesh();
  private readonly instanceColors = requireInstanceColors(this.hexMesh);
  private readonly shroudMesh = createShroudMesh();
  private readonly slotByCell = new Map<number, number>();
  private readonly cellBySlot = new Uint32Array(WORLD_BIOME_SURFACE_CAPACITY);
  private readonly scratchMatrix = new Matrix4();
  // Render space centres the map on the origin, so the shroud covers it before any tile arrives.
  private extents: HexExtents = { maxCol: 0, maxRow: 0, minCol: 0, minRow: 0 };
  private extentsDirty = true;
  private dirtySlots: DirtySlotRange | null = null;

  constructor() {
    this.object3d.name = "world-biome-surface";
    this.object3d.add(this.shroudMesh, this.hexMesh);
    this.fitShroudToExtents();
  }

  /** `biome` is the resolved BiomeType of an explored tile; `null` removes it. */
  setTile(col: number, row: number, biome: BiomeType | null): void {
    const cell = hexCellKey(col, row);
    this.metrics.pendingWrites += 1;
    if (biome === null) {
      this.removeTile(cell);
      return;
    }
    const slot = this.slotByCell.get(cell) ?? this.allocateSlot(cell, col, row);
    this.writeTileColor(slot, biome);
    this.markSlotDirty(slot);
  }

  commit(): void {
    this.uploadDirtySlots();
    this.hexMesh.count = this.slotByCell.size;
    this.hexMesh.visible = this.slotByCell.size > 0;
    if (this.extentsDirty) this.fitShroudToExtents();
    this.metrics.commits += 1;
    this.metrics.pendingWrites = 0;
    this.metrics.drawCalls = this.hexMesh.visible ? 2 : 1;
  }

  setOpacity(opacity: number): void {
    const bounded = Math.min(1, Math.max(0, opacity));
    applyMaterialOpacity(this.hexMesh.material, bounded);
    applyMaterialOpacity(this.shroudMesh.material, bounded);
  }

  setVisible(visible: boolean): void {
    this.object3d.visible = visible;
  }

  dispose(): void {
    this.hexMesh.geometry.dispose();
    this.hexMesh.material.dispose();
    this.hexMesh.dispose();
    this.shroudMesh.geometry.dispose();
    this.shroudMesh.material.dispose();
    this.object3d.clear();
    this.slotByCell.clear();
    this.dirtySlots = null;
  }

  private allocateSlot(cell: number, col: number, row: number): number {
    const slot = this.slotByCell.size;
    if (slot >= WORLD_BIOME_SURFACE_CAPACITY) {
      throw new Error(`World biome surface exceeded ${WORLD_BIOME_SURFACE_CAPACITY} tiles`);
    }
    this.slotByCell.set(cell, slot);
    this.cellBySlot[slot] = cell;
    this.metrics.instanceCount = this.slotByCell.size;
    this.writeTilePlacement(slot, col, row);
    this.growExtents(col, row);
    return slot;
  }

  private removeTile(cell: number): void {
    const slot = this.slotByCell.get(cell);
    if (slot === undefined) return;
    const lastSlot = this.slotByCell.size - 1;
    if (slot !== lastSlot) this.moveSlot(lastSlot, slot);
    this.slotByCell.delete(cell);
    this.metrics.instanceCount = this.slotByCell.size;
  }

  private moveSlot(source: number, target: number): void {
    this.hexMesh.instanceMatrix.copyAt(target, this.hexMesh.instanceMatrix, source);
    this.instanceColors.copyAt(target, this.instanceColors, source);
    const movedCell = this.cellBySlot[source];
    this.cellBySlot[target] = movedCell;
    this.slotByCell.set(movedCell, target);
    this.markSlotDirty(target);
  }

  private writeTilePlacement(slot: number, col: number, row: number): void {
    const { x, z } = terrainHexToWorld(col, row);
    this.scratchMatrix.makeTranslation(x, WORLD_BIOME_SURFACE_HEIGHT, z);
    this.hexMesh.setMatrixAt(slot, this.scratchMatrix);
  }

  private writeTileColor(slot: number, biome: BiomeType): void {
    const color = requireBiomeGroundColor(biome);
    this.instanceColors.setXYZ(slot, color.r, color.g, color.b);
  }

  private markSlotDirty(slot: number): void {
    if (!this.dirtySlots) {
      this.dirtySlots = { max: slot, min: slot };
      return;
    }
    this.dirtySlots.min = Math.min(this.dirtySlots.min, slot);
    this.dirtySlots.max = Math.max(this.dirtySlots.max, slot);
  }

  private uploadDirtySlots(): void {
    if (!this.dirtySlots) return;
    const { max, min } = this.dirtySlots;
    const slotCount = max - min + 1;
    mergeUpdateRange(this.hexMesh.instanceMatrix, min * MATRIX_STRIDE, slotCount * MATRIX_STRIDE);
    mergeUpdateRange(this.instanceColors, min * COLOR_STRIDE, slotCount * COLOR_STRIDE);
    this.metrics.uploadedInstances += slotCount;
    this.dirtySlots = null;
  }

  private growExtents(col: number, row: number): void {
    const { maxCol, maxRow, minCol, minRow } = this.extents;
    if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) return;
    this.extents = {
      maxCol: Math.max(maxCol, col),
      maxRow: Math.max(maxRow, row),
      minCol: Math.min(minCol, col),
      minRow: Math.min(minRow, row),
    };
    this.extentsDirty = true;
  }

  private fitShroudToExtents(): void {
    const margin = WORLD_BIOME_SHROUD_MARGIN_HEXES;
    const low = terrainHexToWorld(this.extents.minCol - margin, this.extents.minRow - margin);
    const high = terrainHexToWorld(this.extents.maxCol + margin, this.extents.maxRow + margin);
    this.shroudMesh.position.set((low.x + high.x) / 2, WORLD_BIOME_SHROUD_HEIGHT, (low.z + high.z) / 2);
    this.shroudMesh.scale.set(high.x - low.x, 1, high.z - low.z);
    this.extentsDirty = false;
  }
}

function buildBiomeGroundColors(): ReadonlyMap<BiomeType, Color> {
  return new Map(
    Object.values(BiomeType).map((biome) => [biome, new Color(TERRAIN_BIOME_DESCRIPTORS[biome].primary)] as const),
  );
}

function requireBiomeGroundColor(biome: BiomeType): Color {
  const color = BIOME_GROUND_COLORS.get(biome);
  if (!color) throw new Error(`World biome surface has no ground colour for biome ${String(biome)}`);
  return color;
}

function createBiomeHexMesh(): InstancedMesh<BufferGeometry, MeshStandardNodeMaterial> {
  // Roughness matches the flat land page material so both surfaces take light alike.
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.95 });
  material.name = "world-biome-surface-hex";
  const mesh = new InstancedMesh(createFlatHexGeometry(), material, WORLD_BIOME_SURFACE_CAPACITY);
  mesh.name = "world-biome-surface-hexes";
  mesh.count = 0;
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.raycast = disableSurfaceRaycast;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // Creates the colour attribute through three before the first draw; the
  // renderer captures it then and every later write goes through setXYZ.
  mesh.setColorAt(0, new Color(1, 1, 1));
  requireInstanceColors(mesh).setUsage(DynamicDrawUsage);
  return mesh;
}

function createFlatHexGeometry(): BufferGeometry {
  const corners = terrainHexCorners(0, 0);
  const positions = corners.flatMap((corner) => [corner.x, 0, corner.z]);
  const normals = corners.flatMap(() => [0, 1, 0]);
  const geometry = new BufferGeometry();
  geometry.name = "world-biome-surface-hex-geometry";
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  // Fan from corner 0, wound so the face points up (+y).
  geometry.setIndex([0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 5, 4]);
  return geometry;
}

function createShroudMesh(): Mesh<PlaneGeometry, MeshBasicMaterial> {
  // Unlit and untonemapped like the exploration fog sheet, so unexplored ground
  // inside and outside the fog's reach reads as the same deep fog.
  const material = new MeshBasicMaterial({ color: TERRAIN_DEEP_FOG_COLOR, toneMapped: false });
  material.name = "world-biome-surface-shroud";
  const geometry = new PlaneGeometry(1, 1, 1, 1);
  geometry.name = "world-biome-surface-shroud-geometry";
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = "world-biome-surface-shroud";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.raycast = disableSurfaceRaycast;
  return mesh;
}

function requireInstanceColors(mesh: InstancedMesh): InstancedBufferAttribute {
  if (!mesh.instanceColor) throw new Error("World biome surface hex mesh has no instance colour attribute");
  return mesh.instanceColor;
}

/**
 * The renderer uploads the listed ranges and clears them; a range still listed
 * has not been uploaded yet, so a new one widens it instead of replacing it.
 */
function mergeUpdateRange(attribute: InstancedBufferAttribute, start: number, count: number): void {
  let min = start;
  let max = start + count;
  attribute.updateRanges.forEach((range) => {
    min = Math.min(min, range.start);
    max = Math.max(max, range.start + range.count);
  });
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(min, max - min);
  attribute.needsUpdate = true;
}

function applyMaterialOpacity(material: MeshBasicMaterial | MeshStandardNodeMaterial, opacity: number): void {
  const transparent = opacity < 1;
  material.opacity = opacity;
  if (material.transparent === transparent) return;
  material.transparent = transparent;
  material.needsUpdate = true;
}

function disableSurfaceRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}
