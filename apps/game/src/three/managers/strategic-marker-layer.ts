import {
  CanvasTexture,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import {
  createSlotDirtyRange,
  flushSlotDirtyRange,
  markSlotDirty,
  type SlotDirtyRange,
} from "../utils/instance-update-ranges";

export type StrategicStructureMarkerKind = "realm" | "village" | "hyperstructure" | "bank" | "mine";
export type StrategicArmyMarkerTier = "T1" | "T2" | "T3";

export interface StrategicMarkerLayerMetrics {
  armies: number;
  commits: number;
  drawCalls: number;
  structures: number;
  uploadedInstances: number;
}

interface MarkerPool {
  readonly mesh: InstancedMesh<PlaneGeometry, MeshBasicMaterial>;
  readonly positions: Float32Array;
  readonly slotByEntity: Map<number, number>;
  readonly entityBySlot: number[];
  readonly dirty: SlotDirtyRange;
}

interface MarkerPoolSpec {
  readonly capacity: number;
  readonly loadTexture: () => Promise<Texture>;
}

export interface StrategicMarkerLayerOptions {
  loadTexture?: (path: string) => Promise<Texture>;
}

const STRUCTURE_MARKER_TEXTURE_PATHS: Readonly<Record<StrategicStructureMarkerKind, string>> = {
  bank: "/images/labels/chest.png",
  hyperstructure: "/images/labels/hyperstructure.png",
  mine: "/images/labels/fragment_mine.png",
  realm: "/images/labels/realm.png",
  village: "/images/labels/village.png",
};
const ARMY_MARKER_TEXTURE_PATH = "/images/labels/army.png";
export const STRATEGIC_MARKER_HEIGHT = 0.6;
/** World units; at the far band (distance 80, 38° fov) a 2.6-unit quad is ~35 px tall — readable like a minimap icon. */
const STRUCTURE_MARKER_SIZE = 2.6;
const ARMY_MARKER_SIZE = 2.0;
const STRUCTURE_MARKER_CAPACITY: Readonly<Record<StrategicStructureMarkerKind, number>> = {
  bank: 64,
  hyperstructure: 256,
  mine: 512,
  realm: 1024,
  village: 2048,
};
const ARMY_MARKER_CAPACITY = 2048;
const ARMY_MARKER_TIERS: readonly StrategicArmyMarkerTier[] = ["T1", "T2", "T3"];
const ARMY_TIER_GLYPH: Readonly<Record<StrategicArmyMarkerTier, string>> = { T1: "I", T2: "II", T3: "III" };

/**
 * The far band's subjects: one instanced quad mesh per structure kind and per
 * army tier, tinted per instance by the owner's colour, tilted toward the
 * camera pitch. Fed from the spatial projection (whole world), not the render
 * window, so the strategic map reads who owns what at a glance.
 */
export class StrategicMarkerLayer {
  readonly object3d = new Group();
  readonly metrics: StrategicMarkerLayerMetrics = {
    armies: 0,
    commits: 0,
    drawCalls: 0,
    structures: 0,
    uploadedInstances: 0,
  };
  private readonly structurePools = new Map<StrategicStructureMarkerKind, MarkerPool>();
  private readonly armyPools = new Map<StrategicArmyMarkerTier, MarkerPool>();
  private readonly structureKindByEntity = new Map<number, StrategicStructureMarkerKind>();
  private readonly armyTierByEntity = new Map<number, StrategicArmyMarkerTier>();
  private readonly orientation = new Quaternion();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchPosition = new Vector3();
  private readonly scratchScale = new Vector3();
  private readonly scratchColor = new Color();
  private disposed = false;

  constructor(options: StrategicMarkerLayerOptions = {}) {
    this.object3d.name = "strategic-markers";
    const loadTexture = options.loadTexture ?? loadTextureFromPath;
    (Object.keys(STRUCTURE_MARKER_TEXTURE_PATHS) as StrategicStructureMarkerKind[]).forEach((kind) => {
      this.structurePools.set(
        kind,
        this.createPool(`strategic-structure:${kind}`, STRUCTURE_MARKER_SIZE, {
          capacity: STRUCTURE_MARKER_CAPACITY[kind],
          loadTexture: () => loadTexture(STRUCTURE_MARKER_TEXTURE_PATHS[kind]),
        }),
      );
    });
    const armyTexture = loadTexture(ARMY_MARKER_TEXTURE_PATH);
    ARMY_MARKER_TIERS.forEach((tier) => {
      this.armyPools.set(
        tier,
        this.createPool(`strategic-army:${tier}`, ARMY_MARKER_SIZE, {
          capacity: ARMY_MARKER_CAPACITY,
          loadTexture: () => armyTexture.then((texture) => createTierGlyphTexture(texture, ARMY_TIER_GLYPH[tier])),
        }),
      );
    });
    this.setViewPitch(Math.PI / 3);
  }

  setStructure(entityId: number, kind: StrategicStructureMarkerKind, x: number, z: number, color: Color): void {
    const previousKind = this.structureKindByEntity.get(entityId);
    if (previousKind !== undefined && previousKind !== kind)
      this.removeFromPool(this.requireStructurePool(previousKind), entityId);
    this.structureKindByEntity.set(entityId, kind);
    this.writeMarker(this.requireStructurePool(kind), entityId, x, z, color);
  }

  removeStructure(entityId: number): void {
    const kind = this.structureKindByEntity.get(entityId);
    if (kind === undefined) return;
    this.structureKindByEntity.delete(entityId);
    this.removeFromPool(this.requireStructurePool(kind), entityId);
  }

  setArmy(entityId: number, tier: StrategicArmyMarkerTier, x: number, z: number, color: Color): void {
    const previousTier = this.armyTierByEntity.get(entityId);
    if (previousTier !== undefined && previousTier !== tier)
      this.removeFromPool(this.requireArmyPool(previousTier), entityId);
    this.armyTierByEntity.set(entityId, tier);
    this.writeMarker(this.requireArmyPool(tier), entityId, x, z, color);
  }

  removeArmy(entityId: number): void {
    const tier = this.armyTierByEntity.get(entityId);
    if (tier === undefined) return;
    this.armyTierByEntity.delete(entityId);
    this.removeFromPool(this.requireArmyPool(tier), entityId);
  }

  /** Markers face the camera's pitch; the scene calls this when the zoom settles. */
  setViewPitch(pitchRadians: number): void {
    const next = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -(Math.PI / 2 - pitchRadians));
    if (this.orientation.equals(next)) return;
    this.orientation.copy(next);
    this.forEachPool((pool) => {
      for (let slot = 0; slot < pool.entityBySlot.length; slot += 1) this.writeMatrix(pool, slot);
      if (pool.entityBySlot.length > 0) {
        markSlotDirty(pool.dirty, 0);
        markSlotDirty(pool.dirty, pool.entityBySlot.length - 1);
      }
    });
  }

  commit(): void {
    let uploaded = 0;
    let drawCalls = 0;
    this.forEachPool((pool) => {
      pool.mesh.count = pool.entityBySlot.length;
      if (pool.mesh.count > 0 && pool.mesh.material.map) drawCalls += 1;
      uploaded += flushSlotDirtyRange(pool.dirty, [pool.mesh.instanceMatrix, requireInstanceColors(pool.mesh)]);
    });
    this.metrics.commits += 1;
    this.metrics.uploadedInstances += uploaded;
    this.metrics.drawCalls = drawCalls;
    this.metrics.structures = this.structureKindByEntity.size;
    this.metrics.armies = this.armyTierByEntity.size;
  }

  setVisible(visible: boolean): void {
    this.object3d.visible = visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.forEachPool((pool) => {
      pool.mesh.geometry.dispose();
      pool.mesh.material.map?.dispose();
      pool.mesh.material.dispose();
      pool.mesh.dispose();
    });
    this.object3d.clear();
    this.structurePools.clear();
    this.armyPools.clear();
    this.structureKindByEntity.clear();
    this.armyTierByEntity.clear();
  }

  private createPool(name: string, size: number, spec: MarkerPoolSpec): MarkerPool {
    const material = new MeshBasicMaterial({ transparent: true, alphaTest: 0.2, depthWrite: false, side: DoubleSide });
    material.name = name;
    const mesh = new InstancedMesh(new PlaneGeometry(size, size), material, spec.capacity);
    mesh.name = name;
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // Marker icons render above the terrain and biome surface, under labels.
    mesh.renderOrder = 900;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    // Creating instanceColor through setColorAt here, before any draw, keeps the buffer immutable afterwards.
    mesh.setColorAt(0, this.scratchColor.set(0xffffff));
    requireInstanceColors(mesh).setUsage(DynamicDrawUsage);
    mesh.visible = false;
    void spec.loadTexture().then((texture) => {
      if (this.disposed) return;
      material.map = texture;
      material.needsUpdate = true;
      mesh.visible = true;
    });
    this.object3d.add(mesh);
    return {
      dirty: createSlotDirtyRange(),
      entityBySlot: [],
      mesh,
      positions: new Float32Array(spec.capacity * 2),
      slotByEntity: new Map(),
    };
  }

  private writeMarker(pool: MarkerPool, entityId: number, x: number, z: number, color: Color): void {
    let slot = pool.slotByEntity.get(entityId);
    if (slot === undefined) {
      slot = pool.entityBySlot.length;
      if (slot >= pool.mesh.instanceMatrix.count) {
        throw new Error(`Strategic marker pool ${pool.mesh.name} is full at ${slot} instances`);
      }
      pool.entityBySlot.push(entityId);
      pool.slotByEntity.set(entityId, slot);
    }
    pool.positions[slot * 2] = x;
    pool.positions[slot * 2 + 1] = z;
    this.writeMatrix(pool, slot);
    pool.mesh.setColorAt(slot, color);
    markSlotDirty(pool.dirty, slot);
  }

  /** Swap-remove keeps every pool dense so `count` is the live instance count. */
  private removeFromPool(pool: MarkerPool, entityId: number): void {
    const slot = pool.slotByEntity.get(entityId);
    if (slot === undefined) return;
    const lastSlot = pool.entityBySlot.length - 1;
    const lastEntity = pool.entityBySlot[lastSlot];
    if (slot !== lastSlot) {
      pool.entityBySlot[slot] = lastEntity;
      pool.slotByEntity.set(lastEntity, slot);
      pool.positions[slot * 2] = pool.positions[lastSlot * 2];
      pool.positions[slot * 2 + 1] = pool.positions[lastSlot * 2 + 1];
      this.writeMatrix(pool, slot);
      const colors = requireInstanceColors(pool.mesh);
      colors.setXYZ(slot, colors.getX(lastSlot), colors.getY(lastSlot), colors.getZ(lastSlot));
      markSlotDirty(pool.dirty, slot);
    }
    pool.entityBySlot.pop();
    pool.slotByEntity.delete(entityId);
  }

  private writeMatrix(pool: MarkerPool, slot: number): void {
    const size = pool.mesh.geometry.parameters.width;
    this.scratchPosition.set(pool.positions[slot * 2], STRATEGIC_MARKER_HEIGHT, pool.positions[slot * 2 + 1]);
    this.scratchScale.set(1, 1, 1);
    this.scratchMatrix.compose(this.scratchPosition, this.orientation, this.scratchScale);
    void size;
    pool.mesh.setMatrixAt(slot, this.scratchMatrix);
  }

  private forEachPool(visit: (pool: MarkerPool) => void): void {
    this.structurePools.forEach(visit);
    this.armyPools.forEach(visit);
  }

  private requireStructurePool(kind: StrategicStructureMarkerKind): MarkerPool {
    const pool = this.structurePools.get(kind);
    if (!pool) throw new Error(`Strategic marker pool missing for structure kind ${kind}`);
    return pool;
  }

  private requireArmyPool(tier: StrategicArmyMarkerTier): MarkerPool {
    const pool = this.armyPools.get(tier);
    if (!pool) throw new Error(`Strategic marker pool missing for army tier ${tier}`);
    return pool;
  }
}

function requireInstanceColors(mesh: InstancedMesh): NonNullable<InstancedMesh["instanceColor"]> {
  if (!mesh.instanceColor) throw new Error(`Strategic marker mesh ${mesh.name} has no instance colours`);
  return mesh.instanceColor;
}

function loadTextureFromPath(path: string): Promise<Texture> {
  return new TextureLoader().loadAsync(path).then((texture) => {
    texture.colorSpace = SRGBColorSpace;
    return texture;
  });
}

/** The army icon with the tier numeral burned into its corner, so one draw carries colour and tier. */
function createTierGlyphTexture(iconTexture: Texture, glyph: string): Texture {
  if (typeof document === "undefined") return iconTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return iconTexture;
  const image = iconTexture.image as CanvasImageSource | undefined;
  if (image) context.drawImage(image, 0, 0, size, size);
  context.font = `bold ${Math.round(size * 0.42)}px sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.lineWidth = size * 0.06;
  context.strokeStyle = "rgba(0,0,0,0.9)";
  context.fillStyle = "#ffffff";
  context.strokeText(glyph, size - size * 0.06, size - size * 0.04);
  context.fillText(glyph, size - size * 0.06, size - size * 0.04);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
