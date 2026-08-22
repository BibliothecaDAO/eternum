import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { resolveBallisticLaunchVelocity } from "./arrow-ballistics";

export interface ArrowProjectileSystemConfig {
  capacity: number;
  fixedStep: number;
  gravity: number;
  maxSubsteps: number;
  stickSeconds: number;
  sweepRadius: number;
  visualScale: number;
}

export interface ArrowVolleySpawnRequest {
  color: Color | string | number;
  count: number;
  flightSeconds: number;
  origin: Readonly<Vector3>;
  seed: number;
  spreadDegrees: number;
  target: Readonly<Vector3>;
  targetRadius: number;
  targetVelocity?: Readonly<Vector3>;
}

export interface ArrowProjectileSystemStats {
  activeCount: number;
  capacity: number;
  droppedCount: number;
  flyingCount: number;
  hitCount: number;
  simulationSteps: number;
  spawnedCount: number;
  stuckCount: number;
}

export interface ArrowImpactEvent {
  position: Vector3;
  targetHit: boolean;
  velocity: Vector3;
}

const STATE_FREE = 0;
const STATE_FLYING = 1;
const STATE_STUCK = 2;
const ARROW_FORWARD = new Vector3(0, 0, 1);
const ZERO_SCALE = new Vector3(0, 0, 0);
const MAX_FLIGHT_SECONDS = 4;

export class ArrowProjectileSystem {
  public readonly group = new Group();

  private readonly geometry = createArrowGeometry();
  private readonly material = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.24,
    roughness: 0.56,
  });
  private readonly mesh: InstancedMesh;
  private readonly states: Uint8Array;
  private readonly positions: Float32Array;
  private readonly previousPositions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly targetCenters: Float32Array;
  private readonly targetRadii: Float32Array;
  private readonly ages: Float32Array;
  private readonly freeSlots: number[] = [];
  private readonly impactListeners = new Set<(event: ArrowImpactEvent) => void>();
  private readonly scratchOrigin = new Vector3();
  private readonly scratchTarget = new Vector3();
  private readonly scratchImpactTarget = new Vector3();
  private readonly scratchTargetVelocity = new Vector3();
  private readonly scratchGravity = new Vector3();
  private readonly scratchVelocity = new Vector3();
  private readonly scratchPosition = new Vector3();
  private readonly scratchDirection = new Vector3();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchColor = new Color();
  private readonly visualScale = new Vector3(1, 1, 1);
  private config: ArrowProjectileSystemConfig;
  private accumulator = 0;
  private activeCount = 0;
  private flyingCount = 0;
  private stuckCount = 0;
  private spawnedCount = 0;
  private droppedCount = 0;
  private hitCount = 0;
  private simulationSteps = 0;
  private matricesDirty = false;
  private disposed = false;

  public constructor(config: ArrowProjectileSystemConfig) {
    this.config = normalizeConfig(config);
    this.visualScale.setScalar(this.config.visualScale);
    this.group.name = "arrow-projectile-system";
    this.mesh = new InstancedMesh(this.geometry, this.material, this.config.capacity);
    this.mesh.name = "arrow-projectile-instances";
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.states = new Uint8Array(this.config.capacity);
    this.positions = new Float32Array(this.config.capacity * 3);
    this.previousPositions = new Float32Array(this.config.capacity * 3);
    this.velocities = new Float32Array(this.config.capacity * 3);
    this.targetCenters = new Float32Array(this.config.capacity * 3);
    this.targetRadii = new Float32Array(this.config.capacity);
    this.ages = new Float32Array(this.config.capacity);
    for (let slot = this.config.capacity - 1; slot >= 0; slot -= 1) this.freeSlots.push(slot);
    this.hideAllInstances();
    this.group.add(this.mesh);
  }

  public spawnVolley(request: ArrowVolleySpawnRequest): number {
    if (this.disposed) return 0;
    const count = Math.max(0, Math.min(32, Math.floor(request.count)));
    const targetVelocity = request.targetVelocity ?? this.scratchTargetVelocity.set(0, 0, 0);
    let randomState = request.seed >>> 0 || 0x9e3779b9;
    this.scratchImpactTarget.copy(request.target).addScaledVector(targetVelocity, request.flightSeconds);
    let spawned = 0;
    for (let index = 0; index < count; index += 1) {
      randomState = nextRandomState(randomState);
      const horizontal = randomUnit(randomState);
      randomState = nextRandomState(randomState);
      const vertical = randomUnit(randomState);
      const spreadRadius = Math.tan((request.spreadDegrees * Math.PI) / 180) * request.flightSeconds * 3;
      this.scratchTarget
        .copy(request.target)
        .addScaledVector(WORLD_RIGHT, horizontal * spreadRadius)
        .addScaledVector(WORLD_UP, vertical * spreadRadius);
      if (
        this.spawnArrow({
          color: request.color,
          flightSeconds: request.flightSeconds,
          origin: request.origin,
          target: this.scratchTarget,
          targetCenter: this.scratchImpactTarget,
          targetRadius: request.targetRadius,
          targetVelocity,
        })
      ) {
        spawned += 1;
      }
    }
    return spawned;
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.activeCount === 0) {
      this.accumulator = 0;
      this.simulationSteps = 0;
      if (this.matricesDirty) this.updateInstanceMatrices();
      return;
    }
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 0.1) : 0;
    this.accumulator += elapsed;
    this.simulationSteps = 0;
    while (this.accumulator >= this.config.fixedStep && this.simulationSteps < this.config.maxSubsteps) {
      this.step(this.config.fixedStep);
      this.accumulator -= this.config.fixedStep;
      this.simulationSteps += 1;
    }
    if (this.simulationSteps === this.config.maxSubsteps) this.accumulator = 0;
    if (this.matricesDirty) this.updateInstanceMatrices();
  }

  public stepOnce(): void {
    if (this.disposed) return;
    if (this.activeCount === 0) {
      this.simulationSteps = 0;
      return;
    }
    this.step(this.config.fixedStep);
    this.simulationSteps = 1;
    this.updateInstanceMatrices();
  }

  public updateConfig(config: Omit<ArrowProjectileSystemConfig, "capacity">): void {
    this.config = normalizeConfig({ ...config, capacity: this.config.capacity });
    this.visualScale.setScalar(this.config.visualScale);
  }

  public onImpact(listener: (event: ArrowImpactEvent) => void): () => void {
    this.impactListeners.add(listener);
    return () => this.impactListeners.delete(listener);
  }

  public getStats(): ArrowProjectileSystemStats {
    return {
      activeCount: this.activeCount,
      capacity: this.config.capacity,
      droppedCount: this.droppedCount,
      flyingCount: this.flyingCount,
      hitCount: this.hitCount,
      simulationSteps: this.simulationSteps,
      spawnedCount: this.spawnedCount,
      stuckCount: this.stuckCount,
    };
  }

  public reset(): void {
    if (this.disposed) return;
    this.states.fill(STATE_FREE);
    this.positions.fill(0);
    this.previousPositions.fill(0);
    this.velocities.fill(0);
    this.targetCenters.fill(0);
    this.targetRadii.fill(0);
    this.ages.fill(0);
    this.freeSlots.length = 0;
    for (let slot = this.config.capacity - 1; slot >= 0; slot -= 1) this.freeSlots.push(slot);
    this.accumulator = 0;
    this.activeCount = 0;
    this.flyingCount = 0;
    this.stuckCount = 0;
    this.spawnedCount = 0;
    this.droppedCount = 0;
    this.hitCount = 0;
    this.simulationSteps = 0;
    this.hideAllInstances();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.impactListeners.clear();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private spawnArrow(input: {
    color: Color | string | number;
    flightSeconds: number;
    origin: Readonly<Vector3>;
    target: Readonly<Vector3>;
    targetCenter: Readonly<Vector3>;
    targetRadius: number;
    targetVelocity: Readonly<Vector3>;
  }): boolean {
    const slot = this.acquireSlot();
    if (slot === undefined) return false;
    const offset = slot * 3;
    this.positions.set([input.origin.x, input.origin.y, input.origin.z], offset);
    this.previousPositions.set([input.origin.x, input.origin.y, input.origin.z], offset);
    this.targetCenters.set([input.targetCenter.x, input.targetCenter.y, input.targetCenter.z], offset);
    this.targetRadii[slot] = Math.max(0, input.targetRadius);
    this.scratchOrigin.copy(input.origin);
    this.scratchGravity.set(0, this.config.gravity, 0);
    resolveBallisticLaunchVelocity(
      this.scratchOrigin,
      input.target,
      input.targetVelocity,
      this.scratchGravity,
      input.flightSeconds,
      this.scratchVelocity,
    );
    this.velocities.set(this.scratchVelocity.toArray(), offset);
    this.ages[slot] = 0;
    this.states[slot] = STATE_FLYING;
    this.mesh.setColorAt(slot, this.scratchColor.set(input.color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.activeCount += 1;
    this.flyingCount += 1;
    this.spawnedCount += 1;
    this.mesh.count = this.config.capacity;
    this.matricesDirty = true;
    return true;
  }

  private acquireSlot(): number | undefined {
    const free = this.freeSlots.pop();
    if (free !== undefined) return free;
    let oldestSlot = -1;
    let oldestAge = -1;
    for (let slot = 0; slot < this.config.capacity; slot += 1) {
      if (this.states[slot] !== STATE_FREE && this.ages[slot] > oldestAge) {
        oldestAge = this.ages[slot];
        oldestSlot = slot;
      }
    }
    if (oldestSlot < 0) return undefined;
    this.droppedCount += 1;
    this.releaseSlot(oldestSlot);
    return this.freeSlots.pop();
  }

  private step(deltaSeconds: number): void {
    this.matricesDirty = this.activeCount > 0;
    for (let slot = 0; slot < this.config.capacity; slot += 1) {
      const state = this.states[slot];
      if (state === STATE_FREE) continue;
      this.ages[slot] += deltaSeconds;
      if (state === STATE_STUCK) {
        if (this.ages[slot] >= this.config.stickSeconds) this.releaseSlot(slot);
        continue;
      }
      if (this.ages[slot] >= MAX_FLIGHT_SECONDS) {
        this.releaseSlot(slot);
        continue;
      }
      this.stepFlyingArrow(slot, deltaSeconds);
    }
  }

  private stepFlyingArrow(slot: number, deltaSeconds: number): void {
    const offset = slot * 3;
    const previousX = this.positions[offset];
    const previousY = this.positions[offset + 1];
    const previousZ = this.positions[offset + 2];
    const velocityX = this.velocities[offset];
    const velocityY = this.velocities[offset + 1];
    const velocityZ = this.velocities[offset + 2];
    const nextX = previousX + velocityX * deltaSeconds;
    const nextY = previousY + velocityY * deltaSeconds + 0.5 * this.config.gravity * deltaSeconds * deltaSeconds;
    const nextZ = previousZ + velocityZ * deltaSeconds;
    this.previousPositions[offset] = previousX;
    this.previousPositions[offset + 1] = previousY;
    this.previousPositions[offset + 2] = previousZ;
    this.positions[offset] = nextX;
    this.positions[offset + 1] = nextY;
    this.positions[offset + 2] = nextZ;
    this.velocities[offset + 1] = velocityY + this.config.gravity * deltaSeconds;

    const targetFraction = resolveSegmentSphereFraction(
      previousX,
      previousY,
      previousZ,
      nextX,
      nextY,
      nextZ,
      this.targetCenters[offset],
      this.targetCenters[offset + 1],
      this.targetCenters[offset + 2],
      this.targetRadii[slot] + this.config.sweepRadius,
    );
    const groundFraction = previousY > 0 && nextY <= 0 ? previousY / Math.max(1e-6, previousY - nextY) : undefined;
    const hitTarget =
      targetFraction !== undefined && (groundFraction === undefined || targetFraction <= groundFraction);
    const hitFraction = hitTarget ? targetFraction : groundFraction;
    if (hitFraction === undefined) return;

    this.positions[offset] = previousX + (nextX - previousX) * hitFraction;
    this.positions[offset + 1] = previousY + (nextY - previousY) * hitFraction;
    this.positions[offset + 2] = previousZ + (nextZ - previousZ) * hitFraction;
    this.states[slot] = STATE_STUCK;
    this.ages[slot] = 0;
    this.flyingCount -= 1;
    this.stuckCount += 1;
    this.hitCount += Number(hitTarget);
    this.emitImpact(slot, hitTarget);
  }

  private emitImpact(slot: number, targetHit: boolean): void {
    if (this.impactListeners.size === 0) return;
    const offset = slot * 3;
    const event: ArrowImpactEvent = {
      position: new Vector3(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]),
      targetHit,
      velocity: new Vector3(this.velocities[offset], this.velocities[offset + 1], this.velocities[offset + 2]),
    };
    this.impactListeners.forEach((listener) => listener(event));
  }

  private releaseSlot(slot: number): void {
    const state = this.states[slot];
    if (state === STATE_FREE) return;
    if (state === STATE_FLYING) this.flyingCount -= 1;
    if (state === STATE_STUCK) this.stuckCount -= 1;
    this.activeCount -= 1;
    this.states[slot] = STATE_FREE;
    this.ages[slot] = 0;
    this.freeSlots.push(slot);
    this.scratchMatrix.compose(this.scratchPosition.set(0, -10_000, 0), this.scratchQuaternion.identity(), ZERO_SCALE);
    this.mesh.setMatrixAt(slot, this.scratchMatrix);
    if (this.activeCount === 0) this.mesh.count = 0;
    this.matricesDirty = true;
  }

  private updateInstanceMatrices(): void {
    for (let slot = 0; slot < this.config.capacity; slot += 1) {
      if (this.states[slot] === STATE_FREE) continue;
      const offset = slot * 3;
      this.scratchPosition.set(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]);
      this.scratchDirection
        .set(this.velocities[offset], this.velocities[offset + 1], this.velocities[offset + 2])
        .normalize();
      this.scratchQuaternion.setFromUnitVectors(ARROW_FORWARD, this.scratchDirection);
      this.scratchMatrix.compose(this.scratchPosition, this.scratchQuaternion, this.visualScale);
      this.mesh.setMatrixAt(slot, this.scratchMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.matricesDirty = false;
  }

  private hideAllInstances(): void {
    this.scratchMatrix.compose(this.scratchPosition.set(0, -10_000, 0), this.scratchQuaternion.identity(), ZERO_SCALE);
    for (let slot = 0; slot < this.config.capacity; slot += 1) this.mesh.setMatrixAt(slot, this.scratchMatrix);
    this.mesh.count = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.matricesDirty = false;
  }
}

const WORLD_RIGHT = new Vector3(1, 0, 0);
const WORLD_UP = new Vector3(0, 1, 0);

function normalizeConfig(config: ArrowProjectileSystemConfig): ArrowProjectileSystemConfig {
  return {
    capacity: clampInteger(config.capacity, 1, 2_048),
    fixedStep: clamp(config.fixedStep, 1 / 240, 1 / 30),
    gravity: clamp(config.gravity, -40, 0),
    maxSubsteps: clampInteger(config.maxSubsteps, 1, 12),
    stickSeconds: clamp(config.stickSeconds, 0.1, 30),
    sweepRadius: clamp(config.sweepRadius, 0.001, 0.5),
    visualScale: clamp(config.visualScale, 0.1, 3),
  };
}

function createArrowGeometry(): BufferGeometry {
  const shaft = new CylinderGeometry(0.012, 0.012, 0.74, 6);
  shaft.rotateX(Math.PI / 2);
  const head = new ConeGeometry(0.04, 0.11, 5);
  head.rotateX(Math.PI / 2);
  head.translate(0, 0, 0.425);
  const fletchingA = new BoxGeometry(0.075, 0.012, 0.16);
  fletchingA.translate(0, 0, -0.3);
  const fletchingB = new BoxGeometry(0.012, 0.075, 0.16);
  fletchingB.translate(0, 0, -0.3);
  const geometry = mergeGeometries([shaft, head, fletchingA, fletchingB], false);
  shaft.dispose();
  head.dispose();
  fletchingA.dispose();
  fletchingB.dispose();
  if (!geometry) throw new Error("Unable to create the shared arrow projectile geometry");
  geometry.computeBoundingSphere();
  return geometry;
}

function resolveSegmentSphereFraction(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  radius: number,
): number | undefined {
  const segmentX = toX - fromX;
  const segmentY = toY - fromY;
  const segmentZ = toZ - fromZ;
  const offsetX = fromX - centerX;
  const offsetY = fromY - centerY;
  const offsetZ = fromZ - centerZ;
  const c = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ - radius * radius;
  if (c <= 0) return 0;
  const a = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;
  if (a <= 1e-12) return undefined;
  const b = 2 * (offsetX * segmentX + offsetY * segmentY + offsetZ * segmentZ);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return undefined;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return fraction >= 0 && fraction <= 1 ? fraction : undefined;
}

function nextRandomState(state: number): number {
  let value = state;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0 || 0x9e3779b9;
}

function randomUnit(state: number): number {
  return (state / 0x1_0000_0000) * 2 - 1;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}
