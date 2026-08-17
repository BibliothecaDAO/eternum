import type { ID } from "@bibliothecadao/types";
import * as THREE from "three";
import { acquireCompactLabel, releaseCompactLabel, type CompactLabelAtlasRecord } from "./compact-entity-label-atlas";
import type { CompactEntityLabelVariant } from "./compact-entity-label-policy";

interface ActiveCompactLabel {
  atlasRecord: CompactLabelAtlasRecord;
  baseRenderOrder: number;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  size: number;
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

export class CompactEntityLabelRenderer {
  private readonly labels = new Map<ID, ActiveCompactLabel>();
  private readonly group = new THREE.Group();
  private readonly cameraQuaternion = new THREE.Quaternion();
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
      this.updateLabel(existingLabel, input, size);
      return;
    }

    if (existingLabel) this.releaseActiveLabel(input.entityId, existingLabel);

    const atlasRecord = acquireCompactLabel(text, input.variant);
    const mesh = new THREE.Mesh(atlasRecord.geometry, atlasRecord.material);
    const baseRenderOrder = COMPACT_LABEL_RENDER_ORDER + (input.priority ?? 0);
    const label = { atlasRecord, baseRenderOrder, mesh, size };
    mesh.name = `compact-entity-label-${input.entityId}`;
    mesh.raycast = () => {};
    mesh.position.copy(input.position);
    if (this.hasCameraQuaternion) mesh.quaternion.copy(this.cameraQuaternion);
    mesh.renderOrder = baseRenderOrder;
    this.applyLabelScale(label);
    this.labels.set(input.entityId, label);
    this.group.add(mesh);
  }

  public removeLabel(entityId: ID): void {
    const label = this.labels.get(entityId);
    if (label) this.releaseActiveLabel(entityId, label);
  }

  public removeMany(entityIds: Iterable<ID>): void {
    for (const entityId of entityIds) this.removeLabel(entityId);
  }

  public clear(): void {
    for (const [entityId, label] of this.labels) this.releaseActiveLabel(entityId, label);
    this.hoveredEntityId = undefined;
  }

  public setHover(entityId: ID): void {
    if (this.hoveredEntityId === entityId) return;

    this.clearHover();
    const label = this.labels.get(entityId);
    if (!label) return;

    this.hoveredEntityId = entityId;
    label.mesh.scale.multiplyScalar(HOVER_LABEL_SCALE);
    label.mesh.renderOrder = label.baseRenderOrder + 100;
  }

  public clearHover(): void {
    if (this.hoveredEntityId === undefined) return;

    const label = this.labels.get(this.hoveredEntityId);
    if (label) {
      this.applyLabelScale(label);
      label.mesh.renderOrder = label.baseRenderOrder;
    }
    this.hoveredEntityId = undefined;
  }

  public updateCamera(camera: THREE.Camera): void {
    if (this.hasCameraQuaternion && this.cameraQuaternion.equals(camera.quaternion)) return;

    this.cameraQuaternion.copy(camera.quaternion);
    this.hasCameraQuaternion = true;
    for (const label of this.labels.values()) label.mesh.quaternion.copy(this.cameraQuaternion);
  }

  public dispose(): void {
    this.clear();
    if (this.group.parent) this.group.parent.remove(this.group);
  }

  private updateLabel(label: ActiveCompactLabel, input: CompactEntityLabelInput, size: number): void {
    label.size = size;
    label.baseRenderOrder = COMPACT_LABEL_RENDER_ORDER + (input.priority ?? 0);
    label.mesh.position.copy(input.position);
    label.mesh.renderOrder =
      this.hoveredEntityId === input.entityId ? label.baseRenderOrder + 100 : label.baseRenderOrder;
    this.applyLabelScale(label);
  }

  private releaseActiveLabel(entityId: ID, label: ActiveCompactLabel): void {
    this.group.remove(label.mesh);
    releaseCompactLabel(label.atlasRecord);
    this.labels.delete(entityId);
    if (this.hoveredEntityId === entityId) this.hoveredEntityId = undefined;
  }

  private applyLabelScale(label: ActiveCompactLabel): void {
    const aspectRatio = label.atlasRecord.width / label.atlasRecord.height;
    label.mesh.scale.set(label.size * aspectRatio, label.size, 1);
  }
}

function normalizeLabelText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
