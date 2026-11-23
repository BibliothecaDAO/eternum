import { Matrix4, type Vector3 } from "three";

import { getContactShadowResources } from "../utils/contact-shadow";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import {
  createSlotDirtyRange,
  flushSlotDirtyRange,
  markSlotDirty,
  type SlotDirtyRange,
} from "../utils/instance-update-ranges";

const SHADOW_REACH = 0.42;
const SHADOW_DIAMETER = SHADOW_REACH * 2;
const SHADOW_LIFT = 0.02;

export class ArmyContactShadows {
  readonly mesh;
  private readonly dirty: SlotDirtyRange = createSlotDirtyRange();
  private readonly matrix = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);

  constructor(capacity: number) {
    const { geometry, material } = getContactShadowResources();
    this.mesh = createInstancedMesh(geometry, material, capacity);
    this.mesh.name = "army-contact-shadows";
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 9;
    this.mesh.raycast = () => {};
  }

  place(slot: number, position: Vector3): void {
    this.matrix.makeScale(SHADOW_DIAMETER, 1, SHADOW_DIAMETER);
    this.matrix.setPosition(position.x, position.y + SHADOW_LIFT, position.z);
    this.mesh.setMatrixAt(slot, this.matrix);
    if (this.mesh.count <= slot) this.mesh.count = slot + 1;
    markSlotDirty(this.dirty, slot);
  }

  clear(slot: number): void {
    this.mesh.setMatrixAt(slot, this.hidden);
    markSlotDirty(this.dirty, slot);
  }

  setDrawCount(count: number): void {
    this.mesh.count = count;
  }

  flush(): void {
    flushSlotDirtyRange(this.dirty, [this.mesh.instanceMatrix]);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
  }
}
