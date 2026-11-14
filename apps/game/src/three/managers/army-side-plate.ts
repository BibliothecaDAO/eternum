import { Color, Matrix4, PlaneGeometry, type Vector3 } from "three";
import { float, smoothstep, uv, vec3 } from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

import { hexReach } from "../terrain/terrain-ground-node";
import { createInstancedMesh } from "../utils/create-instanced-mesh";
import {
  createSlotDirtyRange,
  flushSlotDirtyRange,
  markSlotDirty,
  type SlotDirtyRange,
} from "../utils/instance-update-ranges";

/** How far from its middle to its sides an army's plate reaches, in world units: about half a tile. */
const PLATE_REACH = 0.45;
/** The quad holds the whole hex: its corners lie 2/√3 of its reach from its middle. */
const QUAD_REACH = 1.2;
/** Over the ground, so the plate never flickers into it. */
const PLATE_LIFT = 0.02;

/**
 * The hex plate under every army, as the approved map look draws it: a hex on the ground, set as the grid's hexes are,
 * dark toward its middle as a shadow is, its rim in the colour of the army's side. It follows the army wherever it is,
 * whichever model or rig draws the army, and it is the army's only grounding mark: the map is all hexes.
 */
export class ArmySidePlates {
  readonly mesh;
  private readonly dirty: SlotDirtyRange = createSlotDirtyRange();
  private readonly matrix = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);

  constructor(capacity: number) {
    const geometry = new PlaneGeometry(QUAD_REACH * 2, QUAD_REACH * 2);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = createInstancedMesh(geometry, createPlateMaterial(), capacity);
    this.mesh.name = "army-side-plates";
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 9;
    this.mesh.raycast = () => {};
    // Allocates the colour buffer before the first draw, so the material reads each army's side.
    for (let slot = 0; slot < capacity; slot++) this.mesh.setColorAt(slot, BLACK);
  }

  /** The army in `slot` stands at `position`: its plate is laid on the ground under it. */
  place(slot: number, position: Vector3): void {
    this.matrix.makeScale(PLATE_REACH, 1, PLATE_REACH);
    this.matrix.setPosition(position.x, position.y + PLATE_LIFT, position.z);
    this.mesh.setMatrixAt(slot, this.matrix);
    if (this.mesh.count <= slot) this.mesh.count = slot + 1;
    markSlotDirty(this.dirty, slot);
  }

  paint(slot: number, side: Color): void {
    this.mesh.setColorAt(slot, side);
    markSlotDirty(this.dirty, slot);
  }

  clear(slot: number): void {
    this.mesh.setMatrixAt(slot, this.hidden);
    markSlotDirty(this.dirty, slot);
  }

  /** Draws the slots up to the highest one in use. */
  setDrawCount(count: number): void {
    this.mesh.count = count;
  }

  flush(): void {
    flushSlotDirtyRange(this.dirty, [this.mesh.instanceMatrix, this.mesh.instanceColor]);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

const BLACK = new Color(0);

/**
 * Black and see-through toward its middle, a rim in the side's colour (the instance colour multiplies it). The rim is
 * not tone-mapped, so it is the very colour the side wears on the HUD's plates.
 */
function createPlateMaterial(): MeshBasicNodeMaterial {
  const fromMiddle = uv().mul(2).sub(1).mul(QUAD_REACH);
  const reach = hexReach(fromMiddle);
  const rim = smoothstep(0.72, 0.78, reach).mul(smoothstep(0.98, 0.93, reach));
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  material.colorNode = vec3(rim);
  material.opacityNode = float(0.45)
    .mul(smoothstep(0.8, 0.2, reach))
    .max(rim.mul(0.9));
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  return material;
}
