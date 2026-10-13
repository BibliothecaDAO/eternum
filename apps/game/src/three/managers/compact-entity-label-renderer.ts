import type { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import {
  acquireCompactLabel,
  compactLabelKey,
  releaseCompactLabel,
  type CompactLabelAtlasRecord,
} from "./compact-entity-label-atlas";
import type { CompactEntityLabelVariant } from "./compact-entity-label-policy";

interface ActiveCompactLabel {
  atlasRecord: CompactLabelAtlasRecord;
  batch: LabelBatch;
  hovered: boolean;
  instanceId: number;
  position: THREE.Vector3;
}

type CompactEntityLabelKey = ID | string;

/** One batched draw per atlas page: every label on that page is an instance of its text's quad. */
interface LabelBatch {
  batchKey: string;
  front: boolean;
  material: THREE.MeshBasicMaterial;
  mesh: THREE.BatchedMesh;
  geometryIdByKey: Map<string, { geometryId: number; references: number }>;
  labelCount: number;
  deletedGeometries: number;
}

export interface CompactEntityLabelInput {
  entityId: CompactEntityLabelKey;
  position: THREE.Vector3;
  text: string;
  variant: CompactEntityLabelVariant;
  /** A bar beside the text, filled from 0 to 1: an army's stamina on its own plate. */
  meter?: number;
  /** Drawn over every other plate: the player's own armies are never hidden behind a neighbour's label. */
  front?: boolean;
}

export interface CompactEntityLabelScope {
  clear(): void;
  clearHover(): void;
  dispose(): void;
  removeLabel(entityId: ID): void;
  removeMany(entityIds: Iterable<ID>): void;
  retainOnly(entityIds: Iterable<ID>): void;
  setHover(entityId: ID): void;
  setLabel(input: Omit<CompactEntityLabelInput, "entityId"> & { entityId: ID }): void;
}

const COMPACT_LABEL_RENDER_ORDER = 10_050;
/**
 * A plate's height on screen, in CSS pixels, at every zoom and on every screen: its 16 px atlas text then reads at
 * about 12 px, the smallest a phone shows legibly, and a plate far away is a pin, never unreadable text.
 */
const LABEL_SCREEN_HEIGHT_PX = 26;
/** The plate's height in the world before the first camera is known. */
const FALLBACK_WORLD_HEIGHT = 0.46;
const HOVER_LABEL_SCALE = 1.12;
/** Labels a single atlas page can show at once; the atlas itself pages, so this only bounds one draw. */
const BATCH_INSTANCE_CAPACITY = 2_048;
const QUAD_VERTEX_COUNT = 4;
const QUAD_INDEX_COUNT = 6;
/** After this many freed quads a batch defragments its vertex buffer. */
const OPTIMIZE_AFTER_DELETED_GEOMETRIES = 128;

/**
 * Compact entity labels as one draw per atlas page: a `BatchedMesh` holds one quad geometry per distinct label
 * (its atlas UVs baked in) and one instance per entity, so five hundred labels cost one or two draw calls instead
 * of one each. Materials stay the atlas pages' plain `MeshBasicMaterial`s — no custom shader, both render lanes.
 */
export class CompactEntityLabelRenderer {
  private readonly labels = new Map<CompactEntityLabelKey, ActiveCompactLabel>();
  /** One batch per atlas page and layer; the front layer draws after the rest. */
  private readonly batches = new Map<string, LabelBatch>();
  private readonly group = new THREE.Group();
  private readonly cameraQuaternion = new THREE.Quaternion();
  private readonly cameraPosition = new THREE.Vector3();
  /** World units one screen pixel spans at one unit from the camera; zero until a perspective camera is known. */
  private worldPerPixelAtUnitDistance = 0;
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchScale = new THREE.Vector3();
  private hasCameraQuaternion = false;
  private directHoveredEntityId: CompactEntityLabelKey | undefined;

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = "compact-entity-labels";
    this.group.renderOrder = COMPACT_LABEL_RENDER_ORDER;
    this.scene.add(this.group);
  }

  public setLabel(input: CompactEntityLabelInput): void {
    const text = normalizeLabelText(input.text);
    if (text.length === 0) {
      this.removeLabel(input.entityId);
      return;
    }

    const key = compactLabelKey(text, input.variant, input.meter);
    const front = input.front === true;
    const existingLabel = this.labels.get(input.entityId);
    if (existingLabel?.atlasRecord.key === key && existingLabel.batch.front === front) {
      existingLabel.position.copy(input.position);
      this.writeInstance(existingLabel);
      return;
    }

    if (existingLabel) this.releaseActiveLabel(input.entityId, existingLabel);

    const atlasRecord = acquireCompactLabel(text, input.variant, input.meter);
    const batch = this.resolveBatch(atlasRecord.material, front);
    const geometryId = this.acquireGeometry(batch, atlasRecord);
    const instanceId = batch.mesh.addInstance(geometryId);
    batch.labelCount += 1;
    const label: ActiveCompactLabel = {
      atlasRecord,
      batch,
      hovered: false,
      instanceId,
      position: input.position.clone(),
    };
    this.labels.set(input.entityId, label);
    this.writeInstance(label);
  }

  public removeLabel(entityId: CompactEntityLabelKey): void {
    const label = this.labels.get(entityId);
    if (label) this.releaseActiveLabel(entityId, label);
  }

  public removeMany(entityIds: Iterable<CompactEntityLabelKey>): void {
    for (const entityId of entityIds) this.removeLabel(entityId);
  }

  /** Keeps only the labels whose entity is still placed — the reconcile that hides a model hides its label too. */
  public retainOnly(entityIds: Iterable<CompactEntityLabelKey>): void {
    const keep = new Set(entityIds);
    for (const entityId of Array.from(this.labels.keys())) {
      if (!keep.has(entityId)) this.removeLabel(entityId);
    }
  }

  public clear(): void {
    for (const [entityId, label] of Array.from(this.labels)) this.releaseActiveLabel(entityId, label);
    this.directHoveredEntityId = undefined;
  }

  public setHover(entityId: CompactEntityLabelKey): void {
    if (this.directHoveredEntityId === entityId) return;

    this.clearHover();
    if (!this.labels.has(entityId)) return;
    this.directHoveredEntityId = entityId;
    this.setLabelHovered(entityId, true);
  }

  public clearHover(): void {
    if (this.directHoveredEntityId === undefined) return;
    this.setLabelHovered(this.directHoveredEntityId, false);
    this.directHoveredEntityId = undefined;
  }

  public createScope(namespace: string): CompactEntityLabelScope {
    return new NamespacedCompactEntityLabelScope(this, requireLabelNamespace(namespace));
  }

  /** Plates face the camera and keep one size on screen, so they are rewritten when it turns, moves or zooms. */
  public updateCamera(camera: THREE.Camera, viewportHeightPx: number): void {
    const worldPerPixel = resolveWorldPerPixelAtUnitDistance(camera, viewportHeightPx);
    if (
      this.hasCameraQuaternion &&
      this.cameraQuaternion.equals(camera.quaternion) &&
      this.cameraPosition.equals(camera.position) &&
      this.worldPerPixelAtUnitDistance === worldPerPixel
    )
      return;

    this.cameraQuaternion.copy(camera.quaternion);
    this.cameraPosition.copy(camera.position);
    this.worldPerPixelAtUnitDistance = worldPerPixel;
    this.hasCameraQuaternion = true;
    for (const label of this.labels.values()) this.writeInstance(label);
  }

  /** Draw calls this renderer costs: one per atlas page in use. */
  public get drawCount(): number {
    return this.batches.size;
  }

  public dispose(): void {
    this.clear();
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  public setLabelHovered(entityId: CompactEntityLabelKey, hovered: boolean): void {
    const label = this.labels.get(entityId);
    if (!label || label.hovered === hovered) return;
    label.hovered = hovered;
    this.writeInstance(label);
  }

  private resolveBatch(material: THREE.MeshBasicMaterial, front: boolean): LabelBatch {
    const batchKey = `${material.uuid}:${front}`;
    const existing = this.batches.get(batchKey);
    if (existing) return existing;

    const mesh = new THREE.BatchedMesh(
      BATCH_INSTANCE_CAPACITY,
      BATCH_INSTANCE_CAPACITY * QUAD_VERTEX_COUNT,
      BATCH_INSTANCE_CAPACITY * QUAD_INDEX_COUNT,
      material,
    );
    mesh.name = "compact-entity-label-batch";
    mesh.frustumCulled = false;
    mesh.renderOrder = COMPACT_LABEL_RENDER_ORDER + (front ? 1 : 0);
    mesh.raycast = () => {};
    this.group.add(mesh);
    const batch: LabelBatch = {
      batchKey,
      front,
      material,
      mesh,
      geometryIdByKey: new Map(),
      labelCount: 0,
      deletedGeometries: 0,
    };
    this.batches.set(batchKey, batch);
    return batch;
  }

  private acquireGeometry(batch: LabelBatch, record: CompactLabelAtlasRecord): number {
    const tracked = batch.geometryIdByKey.get(record.key);
    if (tracked) {
      tracked.references += 1;
      return tracked.geometryId;
    }
    const geometryId = batch.mesh.addGeometry(record.geometry, QUAD_VERTEX_COUNT, QUAD_INDEX_COUNT);
    batch.geometryIdByKey.set(record.key, { geometryId, references: 1 });
    return geometryId;
  }

  private releaseGeometry(batch: LabelBatch, key: string): void {
    const tracked = batch.geometryIdByKey.get(key);
    if (!tracked) return;
    tracked.references -= 1;
    if (tracked.references > 0) return;

    batch.mesh.deleteGeometry(tracked.geometryId);
    batch.geometryIdByKey.delete(key);
    batch.deletedGeometries += 1;
    if (batch.deletedGeometries >= OPTIMIZE_AFTER_DELETED_GEOMETRIES) {
      batch.mesh.optimize();
      batch.deletedGeometries = 0;
    }
  }

  private writeInstance(label: ActiveCompactLabel): void {
    const aspectRatio = label.atlasRecord.width / label.atlasRecord.height;
    const height = this.worldHeightAt(label.position) * (label.hovered ? HOVER_LABEL_SCALE : 1);
    this.scratchScale.set(height * aspectRatio, height, 1);
    this.scratchMatrix.compose(
      label.position,
      this.hasCameraQuaternion ? this.cameraQuaternion : IDENTITY_QUATERNION,
      this.scratchScale,
    );
    label.batch.mesh.setMatrixAt(label.instanceId, this.scratchMatrix);
  }

  private worldHeightAt(position: THREE.Vector3): number {
    if (this.worldPerPixelAtUnitDistance === 0) return FALLBACK_WORLD_HEIGHT;
    return LABEL_SCREEN_HEIGHT_PX * this.worldPerPixelAtUnitDistance * this.cameraPosition.distanceTo(position);
  }

  private releaseActiveLabel(entityId: CompactEntityLabelKey, label: ActiveCompactLabel): void {
    const { batch } = label;
    batch.mesh.deleteInstance(label.instanceId);
    batch.labelCount -= 1;
    this.releaseGeometry(batch, label.atlasRecord.key);
    releaseCompactLabel(label.atlasRecord);
    this.labels.delete(entityId);
    if (this.directHoveredEntityId === entityId) this.directHoveredEntityId = undefined;
    if (batch.labelCount === 0) this.disposeBatch(batch);
  }

  private disposeBatch(batch: LabelBatch): void {
    this.group.remove(batch.mesh);
    batch.mesh.dispose();
    this.batches.delete(batch.batchKey);
  }
}

class NamespacedCompactEntityLabelScope implements CompactEntityLabelScope {
  private readonly entityIds = new Set<ID>();
  private hoveredEntityId: ID | undefined;

  constructor(
    private readonly renderer: CompactEntityLabelRenderer,
    private readonly namespace: string,
  ) {}

  setLabel(input: Omit<CompactEntityLabelInput, "entityId"> & { entityId: ID }): void {
    this.entityIds.add(input.entityId);
    this.renderer.setLabel({ ...input, entityId: this.key(input.entityId) });
  }

  removeLabel(entityId: ID): void {
    this.entityIds.delete(entityId);
    if (this.hoveredEntityId === entityId) this.hoveredEntityId = undefined;
    this.renderer.removeLabel(this.key(entityId));
  }

  removeMany(entityIds: Iterable<ID>): void {
    for (const entityId of entityIds) this.removeLabel(entityId);
  }

  retainOnly(entityIds: Iterable<ID>): void {
    const retainedEntityIds = new Set(entityIds);
    for (const entityId of Array.from(this.entityIds)) {
      if (!retainedEntityIds.has(entityId)) this.removeLabel(entityId);
    }
  }

  clear(): void {
    this.removeMany(Array.from(this.entityIds));
  }

  setHover(entityId: ID): void {
    if (this.hoveredEntityId === entityId) return;
    this.clearHover();
    if (!this.entityIds.has(entityId)) return;
    this.hoveredEntityId = entityId;
    this.renderer.setLabelHovered(this.key(entityId), true);
  }

  clearHover(): void {
    if (this.hoveredEntityId === undefined) return;
    this.renderer.setLabelHovered(this.key(this.hoveredEntityId), false);
    this.hoveredEntityId = undefined;
  }

  dispose(): void {
    this.clear();
  }

  private key(entityId: ID): string {
    return `${this.namespace}:${String(entityId)}`;
  }
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

function resolveWorldPerPixelAtUnitDistance(camera: THREE.Camera, viewportHeightPx: number): number {
  if (!(camera instanceof THREE.PerspectiveCamera) || viewportHeightPx <= 0) return 0;
  return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / viewportHeightPx;
}

function normalizeLabelText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function requireLabelNamespace(namespace: string): string {
  const normalized = namespace.trim();
  if (!normalized || normalized.includes(":")) throw new Error(`Invalid compact-label namespace: ${namespace}`);
  return normalized;
}
