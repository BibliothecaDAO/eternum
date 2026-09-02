import type { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { acquireCompactLabel, releaseCompactLabel, type CompactLabelAtlasRecord } from "./compact-entity-label-atlas";
import type { CompactEntityLabelVariant } from "./compact-entity-label-policy";

interface ActiveCompactLabel {
  atlasRecord: CompactLabelAtlasRecord;
  batch: LabelBatch;
  instanceId: number;
  position: THREE.Vector3;
  size: number;
}

/** One batched draw per atlas page: every label on that page is an instance of its text's quad. */
interface LabelBatch {
  material: THREE.MeshBasicMaterial;
  mesh: THREE.BatchedMesh;
  geometryIdByKey: Map<string, { geometryId: number; references: number }>;
  labelCount: number;
  deletedGeometries: number;
}

export interface CompactEntityLabelInput {
  entityId: ID;
  position: THREE.Vector3;
  text: string;
  variant: CompactEntityLabelVariant;
  priority?: number;
  size?: number;
}

const COMPACT_LABEL_RENDER_ORDER = 10_050;
const DEFAULT_LABEL_SIZE = 0.46;
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
  private readonly labels = new Map<ID, ActiveCompactLabel>();
  private readonly batches = new Map<THREE.Material, LabelBatch>();
  private readonly group = new THREE.Group();
  private readonly cameraQuaternion = new THREE.Quaternion();
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchScale = new THREE.Vector3();
  private hasCameraQuaternion = false;
  private hoveredEntityId?: ID;

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

    const size = input.size ?? DEFAULT_LABEL_SIZE;
    const key = `${input.variant}:${text}`;
    const existingLabel = this.labels.get(input.entityId);
    if (existingLabel?.atlasRecord.key === key) {
      existingLabel.size = size;
      existingLabel.position.copy(input.position);
      this.writeInstance(existingLabel);
      return;
    }

    if (existingLabel) this.releaseActiveLabel(input.entityId, existingLabel);

    const atlasRecord = acquireCompactLabel(text, input.variant);
    const batch = this.resolveBatch(atlasRecord.material);
    const geometryId = this.acquireGeometry(batch, atlasRecord);
    const instanceId = batch.mesh.addInstance(geometryId);
    batch.labelCount += 1;
    const label: ActiveCompactLabel = {
      atlasRecord,
      batch,
      instanceId,
      position: input.position.clone(),
      size,
    };
    this.labels.set(input.entityId, label);
    this.writeInstance(label);
  }

  public removeLabel(entityId: ID): void {
    const label = this.labels.get(entityId);
    if (label) this.releaseActiveLabel(entityId, label);
  }

  public removeMany(entityIds: Iterable<ID>): void {
    for (const entityId of entityIds) this.removeLabel(entityId);
  }

  /** Keeps only the labels whose entity is still placed — the reconcile that hides a model hides its label too. */
  public retainOnly(entityIds: Iterable<ID>): void {
    const keep = new Set(entityIds);
    for (const entityId of Array.from(this.labels.keys())) {
      if (!keep.has(entityId)) this.removeLabel(entityId);
    }
  }

  public clear(): void {
    for (const [entityId, label] of Array.from(this.labels)) this.releaseActiveLabel(entityId, label);
    this.hoveredEntityId = undefined;
  }

  public setHover(entityId: ID): void {
    if (this.hoveredEntityId === entityId) return;

    this.clearHover();
    const label = this.labels.get(entityId);
    if (!label) return;

    this.hoveredEntityId = entityId;
    this.writeInstance(label);
  }

  public clearHover(): void {
    if (this.hoveredEntityId === undefined) return;

    const label = this.labels.get(this.hoveredEntityId);
    this.hoveredEntityId = undefined;
    if (label) this.writeInstance(label);
  }

  public updateCamera(camera: THREE.Camera): void {
    if (this.hasCameraQuaternion && this.cameraQuaternion.equals(camera.quaternion)) return;

    this.cameraQuaternion.copy(camera.quaternion);
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

  private resolveBatch(material: THREE.MeshBasicMaterial): LabelBatch {
    const existing = this.batches.get(material);
    if (existing) return existing;

    const mesh = new THREE.BatchedMesh(
      BATCH_INSTANCE_CAPACITY,
      BATCH_INSTANCE_CAPACITY * QUAD_VERTEX_COUNT,
      BATCH_INSTANCE_CAPACITY * QUAD_INDEX_COUNT,
      material,
    );
    mesh.name = "compact-entity-label-batch";
    mesh.frustumCulled = false;
    mesh.renderOrder = COMPACT_LABEL_RENDER_ORDER;
    mesh.raycast = () => {};
    this.group.add(mesh);
    const batch: LabelBatch = { material, mesh, geometryIdByKey: new Map(), labelCount: 0, deletedGeometries: 0 };
    this.batches.set(material, batch);
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
    const hoverScale =
      this.hoveredEntityId !== undefined && this.labels.get(this.hoveredEntityId) === label ? HOVER_LABEL_SCALE : 1;
    this.scratchScale.set(label.size * aspectRatio * hoverScale, label.size * hoverScale, 1);
    this.scratchMatrix.compose(
      label.position,
      this.hasCameraQuaternion ? this.cameraQuaternion : IDENTITY_QUATERNION,
      this.scratchScale,
    );
    label.batch.mesh.setMatrixAt(label.instanceId, this.scratchMatrix);
  }

  private releaseActiveLabel(entityId: ID, label: ActiveCompactLabel): void {
    const { batch } = label;
    batch.mesh.deleteInstance(label.instanceId);
    batch.labelCount -= 1;
    this.releaseGeometry(batch, label.atlasRecord.key);
    releaseCompactLabel(label.atlasRecord);
    this.labels.delete(entityId);
    if (this.hoveredEntityId === entityId) this.hoveredEntityId = undefined;
    if (batch.labelCount === 0) this.disposeBatch(batch);
  }

  private disposeBatch(batch: LabelBatch): void {
    this.group.remove(batch.mesh);
    batch.mesh.dispose();
    this.batches.delete(batch.material);
  }
}

const IDENTITY_QUATERNION = new THREE.Quaternion();

function normalizeLabelText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
