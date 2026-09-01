import {
  Camera,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";

import {
  createWorldFxAdditiveMaterial,
  createWorldFxRingMaterial,
  createWorldFxSmokeMaterial,
  WORLD_FX_PARTICLE_ATTRIBUTE,
} from "./world-fx-materials";

export type WorldFxParticleKind = "flame" | "smoke" | "spark";

export interface WorldFxParticleSpawn {
  effectId: number;
  gravity: number;
  kind: WorldFxParticleKind;
  lifetimeSeconds: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: number;
  size: number;
  spin: number;
  tone: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
}

export interface WorldFxRingSpawn {
  effectId: number;
  lifetimeSeconds: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: number;
  scale: number;
  tone: number;
}

interface ParticleSlot extends WorldFxParticleSpawn {
  active: boolean;
  ageSeconds: number;
}

interface RingSlot extends WorldFxRingSpawn {
  active: boolean;
  ageSeconds: number;
}

export interface WorldFxPoolStats {
  activeCount: number;
  capacity: number;
  drawCalls: number;
  droppedCount: number;
  triangles: number;
}

const BILLBOARD_FORWARD = new Vector3(0, 0, 1);

export class WorldFxParticlePool {
  readonly mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly particleAttribute: InstancedBufferAttribute;
  private readonly slots: ParticleSlot[];
  private readonly matrix = new Matrix4();
  private readonly billboardQuaternion = new Quaternion();
  private readonly rotationQuaternion = new Quaternion();
  private readonly scale = new Vector3();
  private readonly position = new Vector3();
  private writeIndex = 0;
  private activeCount = 0;
  private droppedCount = 0;

  constructor(
    readonly family: "additive" | "smoke",
    readonly capacity: number,
  ) {
    const material = family === "additive" ? createWorldFxAdditiveMaterial() : createWorldFxSmokeMaterial();
    this.mesh = new InstancedMesh(this.geometry, material, capacity);
    this.mesh.name = `world-fx-${family}-particles`;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = family === "additive" ? 31 : 30;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.raycast = disableRaycast;
    this.particleAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.particleAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute(WORLD_FX_PARTICLE_ATTRIBUTE, this.particleAttribute);
    this.slots = Array.from({ length: capacity }, createInactiveParticleSlot);
  }

  spawn(input: WorldFxParticleSpawn): void {
    const slot = this.acquireSlot();
    slot.active = true;
    slot.ageSeconds = 0;
    slot.effectId = input.effectId;
    slot.gravity = input.gravity;
    slot.kind = input.kind;
    slot.lifetimeSeconds = Math.max(0.01, input.lifetimeSeconds);
    slot.positionX = input.positionX;
    slot.positionY = input.positionY;
    slot.positionZ = input.positionZ;
    slot.rotation = input.rotation;
    slot.size = Math.max(0.001, input.size);
    slot.spin = input.spin;
    slot.tone = clampUnit(input.tone);
    slot.velocityX = input.velocityX;
    slot.velocityY = input.velocityY;
    slot.velocityZ = input.velocityZ;
  }

  update(deltaSeconds: number, camera: Camera): void {
    camera.getWorldQuaternion(this.billboardQuaternion);
    let renderIndex = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      advanceParticle(slot, deltaSeconds);
      if (!slot.active) continue;
      this.writeParticle(slot, renderIndex);
      renderIndex += 1;
    }
    this.activeCount = renderIndex;
    this.mesh.count = renderIndex;
    this.mesh.visible = renderIndex > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.particleAttribute.needsUpdate = true;
  }

  releaseEffect(effectId: number): void {
    for (const slot of this.slots) {
      if (slot.active && slot.effectId === effectId) slot.active = false;
    }
  }

  hasEffect(effectId: number): boolean {
    return this.slots.some((slot) => slot.active && slot.effectId === effectId);
  }

  getStats(): WorldFxPoolStats {
    return {
      activeCount: this.activeCount,
      capacity: this.capacity,
      drawCalls: Number(this.mesh.visible),
      droppedCount: this.droppedCount,
      triangles: this.activeCount * 2,
    };
  }

  hashState(hash: number): number {
    for (let index = 0; index < this.slots.length; index += 1) {
      const slot = this.slots[index];
      if (!slot.active) continue;
      hash = hashNumber(hash, index);
      hash = hashNumber(hash, slot.effectId);
      hash = hashNumber(hash, Math.round(slot.positionX * 1_000));
      hash = hashNumber(hash, Math.round(slot.positionY * 1_000));
      hash = hashNumber(hash, Math.round(slot.positionZ * 1_000));
      hash = hashNumber(hash, Math.round(slot.ageSeconds * 1_000));
    }
    return hash;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.mesh.material.dispose();
  }

  private acquireSlot(): ParticleSlot {
    for (let offset = 0; offset < this.capacity; offset += 1) {
      const index = (this.writeIndex + offset) % this.capacity;
      if (this.slots[index].active) continue;
      this.writeIndex = (index + 1) % this.capacity;
      return this.slots[index];
    }
    const slot = this.slots[this.writeIndex];
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.droppedCount += 1;
    return slot;
  }

  private writeParticle(slot: ParticleSlot, renderIndex: number): void {
    const progress = clampUnit(slot.ageSeconds / slot.lifetimeSeconds);
    const opacity = resolveParticleOpacity(slot.kind, progress);
    const size = slot.size * resolveParticleGrowth(slot.kind, progress);
    const width = slot.kind === "spark" ? size * 0.3 : size * (1 - progress * 0.22);
    const height = slot.kind === "spark" ? size * 3.8 : size * (1 + progress * 1.15);
    this.position.set(slot.positionX, slot.positionY, slot.positionZ);
    this.rotationQuaternion.setFromAxisAngle(BILLBOARD_FORWARD, slot.rotation);
    this.rotationQuaternion.premultiply(this.billboardQuaternion);
    this.scale.set(width, height, 1);
    this.matrix.compose(this.position, this.rotationQuaternion, this.scale);
    this.mesh.setMatrixAt(renderIndex, this.matrix);
    this.particleAttribute.setXYZW(renderIndex, opacity, progress, slot.tone, slot.kind === "spark" ? 1 : 0);
  }
}

export class WorldFxRingPool {
  readonly mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly particleAttribute: InstancedBufferAttribute;
  private readonly slots: RingSlot[];
  private readonly matrix = new Matrix4();
  private readonly quaternion = new Quaternion();
  private readonly rotationQuaternion = new Quaternion();
  private readonly normal = new Vector3();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private writeIndex = 0;
  private activeCount = 0;
  private droppedCount = 0;

  constructor(readonly capacity: number) {
    this.mesh = new InstancedMesh(this.geometry, createWorldFxRingMaterial(), capacity);
    this.mesh.name = "world-fx-rings";
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 29;
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.raycast = disableRaycast;
    this.particleAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.particleAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute(WORLD_FX_PARTICLE_ATTRIBUTE, this.particleAttribute);
    this.slots = Array.from({ length: capacity }, createInactiveRingSlot);
  }

  spawn(input: WorldFxRingSpawn): void {
    const slot = this.acquireSlot();
    slot.active = true;
    slot.ageSeconds = 0;
    slot.effectId = input.effectId;
    slot.lifetimeSeconds = Math.max(0.01, input.lifetimeSeconds);
    slot.normalX = input.normalX;
    slot.normalY = input.normalY;
    slot.normalZ = input.normalZ;
    slot.positionX = input.positionX;
    slot.positionY = input.positionY;
    slot.positionZ = input.positionZ;
    slot.rotation = input.rotation;
    slot.scale = Math.max(0.001, input.scale);
    slot.tone = clampUnit(input.tone);
  }

  update(deltaSeconds: number): void {
    let renderIndex = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.ageSeconds += deltaSeconds;
      if (slot.ageSeconds >= slot.lifetimeSeconds) {
        slot.active = false;
        continue;
      }
      this.writeRing(slot, renderIndex);
      renderIndex += 1;
    }
    this.activeCount = renderIndex;
    this.mesh.count = renderIndex;
    this.mesh.visible = renderIndex > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.particleAttribute.needsUpdate = true;
  }

  releaseEffect(effectId: number): void {
    for (const slot of this.slots) {
      if (slot.active && slot.effectId === effectId) slot.active = false;
    }
  }

  hasEffect(effectId: number): boolean {
    return this.slots.some((slot) => slot.active && slot.effectId === effectId);
  }

  getStats(): WorldFxPoolStats {
    return {
      activeCount: this.activeCount,
      capacity: this.capacity,
      drawCalls: Number(this.mesh.visible),
      droppedCount: this.droppedCount,
      triangles: this.activeCount * 2,
    };
  }

  hashState(hash: number): number {
    for (let index = 0; index < this.slots.length; index += 1) {
      const slot = this.slots[index];
      if (!slot.active) continue;
      hash = hashNumber(hash, index);
      hash = hashNumber(hash, slot.effectId);
      hash = hashNumber(hash, Math.round(slot.positionX * 1_000));
      hash = hashNumber(hash, Math.round(slot.positionY * 1_000));
      hash = hashNumber(hash, Math.round(slot.positionZ * 1_000));
      hash = hashNumber(hash, Math.round(slot.ageSeconds * 1_000));
    }
    return hash;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.mesh.material.dispose();
  }

  private acquireSlot(): RingSlot {
    for (let offset = 0; offset < this.capacity; offset += 1) {
      const index = (this.writeIndex + offset) % this.capacity;
      if (this.slots[index].active) continue;
      this.writeIndex = (index + 1) % this.capacity;
      return this.slots[index];
    }
    const slot = this.slots[this.writeIndex];
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.droppedCount += 1;
    return slot;
  }

  private writeRing(slot: RingSlot, renderIndex: number): void {
    const progress = clampUnit(slot.ageSeconds / slot.lifetimeSeconds);
    const opacity = (1 - progress) ** 1.8;
    this.position.set(slot.positionX, slot.positionY, slot.positionZ);
    this.normal.set(slot.normalX, slot.normalY, slot.normalZ).normalize();
    this.quaternion.setFromUnitVectors(BILLBOARD_FORWARD, this.normal);
    this.rotationQuaternion.setFromAxisAngle(BILLBOARD_FORWARD, slot.rotation + progress * 0.4);
    this.quaternion.multiply(this.rotationQuaternion);
    this.scale.setScalar(slot.scale * (0.35 + progress * 1.65));
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.mesh.setMatrixAt(renderIndex, this.matrix);
    this.particleAttribute.setXYZW(renderIndex, opacity, progress, slot.tone, 0);
  }
}

function createInactiveParticleSlot(): ParticleSlot {
  return {
    active: false,
    ageSeconds: 0,
    effectId: 0,
    gravity: 0,
    kind: "flame",
    lifetimeSeconds: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotation: 0,
    size: 0,
    spin: 0,
    tone: 0,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
  };
}

function createInactiveRingSlot(): RingSlot {
  return {
    active: false,
    ageSeconds: 0,
    effectId: 0,
    lifetimeSeconds: 0,
    normalX: 0,
    normalY: 1,
    normalZ: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotation: 0,
    scale: 0,
    tone: 0,
  };
}

function advanceParticle(slot: ParticleSlot, deltaSeconds: number): void {
  slot.ageSeconds += deltaSeconds;
  if (slot.ageSeconds >= slot.lifetimeSeconds) {
    slot.active = false;
    return;
  }
  slot.velocityY += slot.gravity * deltaSeconds;
  slot.positionX += slot.velocityX * deltaSeconds;
  slot.positionY += slot.velocityY * deltaSeconds;
  slot.positionZ += slot.velocityZ * deltaSeconds;
  slot.rotation += slot.spin * deltaSeconds;
}

function resolveParticleOpacity(kind: WorldFxParticleKind, progress: number): number {
  const fadeIn = Math.min(1, progress / 0.12);
  if (kind === "smoke") return fadeIn * (1 - progress) ** 1.4 * 0.72;
  if (kind === "spark") return fadeIn * (1 - progress) ** 2;
  return fadeIn * (1 - progress) ** 1.6;
}

function resolveParticleGrowth(kind: WorldFxParticleKind, progress: number): number {
  if (kind === "smoke") return 0.7 + progress * 1.8;
  if (kind === "spark") return 0.8 + progress * 0.25;
  return 0.72 + progress * 0.95;
}

function disableRaycast(raycaster: unknown, intersects: unknown[]): void {
  void raycaster;
  void intersects;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function hashNumber(hash: number, value: number): number {
  hash ^= value | 0;
  return Math.imul(hash, 16_777_619) >>> 0;
}
