import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { resolveBallisticLaunchVelocity } from "./arrow-ballistics";
import {
  createGroundPlaneHit,
  selectEarlierProjectileHit,
  type ProjectileHitQuery,
  type ProjectileSweepHit,
} from "./projectile-hit-query";
import type { ProceduralImpactAuthority } from "../characters/collision/procedural-impact";

export type BallisticProjectileKind = "arrow" | "cannonball";

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
  authority?: ProceduralImpactAuthority;
  color: Color | string | number;
  count: number;
  flightSeconds: number;
  kind?: BallisticProjectileKind;
  origin: Readonly<Vector3>;
  ownerEntityId?: number;
  presentationId?: string;
  seed: number;
  spreadDegrees: number;
  target: Readonly<Vector3>;
  targetEntityId?: number;
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
  authority: ProceduralImpactAuthority;
  impactId: string;
  kind: BallisticProjectileKind;
  material: "flesh" | "ground" | "metal" | "wood";
  normal: Vector3;
  ownerEntityId?: number;
  partId?: string;
  position: Vector3;
  targetEntityId?: number;
  targetHit: boolean;
  velocity: Vector3;
}

const STATE_FREE = 0;
const STATE_FLYING = 1;
const STATE_STUCK = 2;
const ARROW_FORWARD = new Vector3(0, 0, 1);
const ZERO_SCALE = new Vector3(0, 0, 0);
const MAX_FLIGHT_SECONDS = 4;

/** Shared pooled ballistic simulation; the historical class name remains for import compatibility. */
export class ArrowProjectileSystem {
  public readonly group = new Group();

  private readonly arrowGeometry = createArrowGeometry();
  private readonly cannonballGeometry = new IcosahedronGeometry(0.115, 1);
  private readonly arrowMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.24,
    roughness: 0.56,
  });
  private readonly cannonballMaterial = new MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.58,
    roughness: 0.42,
  });
  private readonly arrowMesh: InstancedMesh;
  private readonly cannonballMesh: InstancedMesh;
  private readonly states: Uint8Array;
  private readonly visualKinds: Uint8Array;
  private readonly positions: Float32Array;
  private readonly previousPositions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly targetCenters: Float32Array;
  private readonly targetRadii: Float32Array;
  private readonly ownerEntityIds: Float64Array;
  private readonly targetEntityIds: Float64Array;
  private readonly generations: Uint32Array;
  private readonly authorities: ProceduralImpactAuthority[];
  private readonly presentationIds: string[];
  private readonly ages: Float32Array;
  private readonly freeSlots: number[] = [];
  private readonly impactListeners = new Set<(event: ArrowImpactEvent) => void>();
  private readonly scratchOrigin = new Vector3();
  private readonly scratchTarget = new Vector3();
  private readonly scratchImpactTarget = new Vector3();
  private readonly scratchFrom = new Vector3();
  private readonly scratchTo = new Vector3();
  private readonly scratchTargetVelocity = new Vector3();
  private readonly scratchGravity = new Vector3();
  private readonly scratchVelocity = new Vector3();
  private readonly scratchPosition = new Vector3();
  private readonly scratchDirection = new Vector3();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchMatrix = new Matrix4();
  private readonly scratchColor = new Color();
  private readonly arrowVisualScale = new Vector3(1, 1, 1);
  private readonly cannonballVisualScale = new Vector3(1, 1, 1);
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

  public constructor(
    config: ArrowProjectileSystemConfig,
    private readonly hitQuery?: ProjectileHitQuery,
  ) {
    this.config = normalizeConfig(config);
    this.updateVisualScales();
    this.group.name = "arrow-projectile-system";
    this.arrowMesh = createProjectileMesh(
      this.arrowGeometry,
      this.arrowMaterial,
      this.config.capacity,
      "arrow-projectile-instances",
    );
    this.cannonballMesh = createProjectileMesh(
      this.cannonballGeometry,
      this.cannonballMaterial,
      this.config.capacity,
      "cannonball-projectile-instances",
    );
    this.states = new Uint8Array(this.config.capacity);
    this.visualKinds = new Uint8Array(this.config.capacity);
    this.positions = new Float32Array(this.config.capacity * 3);
    this.previousPositions = new Float32Array(this.config.capacity * 3);
    this.velocities = new Float32Array(this.config.capacity * 3);
    this.targetCenters = new Float32Array(this.config.capacity * 3);
    this.targetRadii = new Float32Array(this.config.capacity);
    this.ownerEntityIds = new Float64Array(this.config.capacity);
    this.targetEntityIds = new Float64Array(this.config.capacity);
    this.generations = new Uint32Array(this.config.capacity);
    this.authorities = Array.from({ length: this.config.capacity }, () => "debug");
    this.presentationIds = Array.from({ length: this.config.capacity }, () => "");
    this.ages = new Float32Array(this.config.capacity);
    for (let slot = this.config.capacity - 1; slot >= 0; slot -= 1) this.freeSlots.push(slot);
    this.hideAllInstances();
    this.group.add(this.arrowMesh, this.cannonballMesh);
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
          authority: request.authority ?? "debug",
          flightSeconds: request.flightSeconds,
          kind: request.kind ?? "arrow",
          origin: request.origin,
          ownerEntityId: request.ownerEntityId,
          presentationId: request.presentationId,
          target: this.scratchTarget,
          targetCenter: this.scratchImpactTarget,
          targetRadius: request.targetRadius,
          targetEntityId: request.targetEntityId,
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
    this.updateVisualScales();
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
    this.visualKinds.fill(VISUAL_ARROW);
    this.positions.fill(0);
    this.previousPositions.fill(0);
    this.velocities.fill(0);
    this.targetCenters.fill(0);
    this.targetRadii.fill(0);
    this.ownerEntityIds.fill(Number.NaN);
    this.targetEntityIds.fill(Number.NaN);
    this.ages.fill(0);
    this.authorities.fill("debug");
    this.presentationIds.fill("");
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
    this.arrowMesh.dispose();
    this.cannonballMesh.dispose();
    this.arrowGeometry.dispose();
    this.cannonballGeometry.dispose();
    this.arrowMaterial.dispose();
    this.cannonballMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private spawnArrow(input: {
    authority: ProceduralImpactAuthority;
    color: Color | string | number;
    flightSeconds: number;
    kind: BallisticProjectileKind;
    origin: Readonly<Vector3>;
    ownerEntityId?: number;
    presentationId?: string;
    target: Readonly<Vector3>;
    targetCenter: Readonly<Vector3>;
    targetRadius: number;
    targetEntityId?: number;
    targetVelocity: Readonly<Vector3>;
  }): boolean {
    const slot = this.acquireSlot();
    if (slot === undefined) return false;
    const offset = slot * 3;
    this.positions.set([input.origin.x, input.origin.y, input.origin.z], offset);
    this.previousPositions.set([input.origin.x, input.origin.y, input.origin.z], offset);
    this.targetCenters.set([input.targetCenter.x, input.targetCenter.y, input.targetCenter.z], offset);
    this.targetRadii[slot] = Math.max(0, input.targetRadius);
    this.ownerEntityIds[slot] = input.ownerEntityId ?? Number.NaN;
    this.targetEntityIds[slot] = input.targetEntityId ?? Number.NaN;
    this.generations[slot] = (this.generations[slot] + 1) >>> 0 || 1;
    this.visualKinds[slot] = input.kind === "cannonball" ? VISUAL_CANNONBALL : VISUAL_ARROW;
    this.authorities[slot] = input.authority;
    this.presentationIds[slot] = input.presentationId ?? "";
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
    const mesh = this.resolveProjectileMesh(slot);
    mesh.setColorAt(slot, this.scratchColor.set(input.color));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.activeCount += 1;
    this.flyingCount += 1;
    this.spawnedCount += 1;
    this.arrowMesh.count = this.config.capacity;
    this.cannonballMesh.count = this.config.capacity;
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

    const fallbackTargetFraction = resolveSegmentSphereFraction(
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
    this.scratchFrom.set(previousX, previousY, previousZ);
    this.scratchTo.set(nextX, nextY, nextZ);
    const intendedTargetEntityId = finiteEntityId(this.targetEntityIds[slot]);
    const queryOwnsTarget =
      this.hitQuery !== undefined &&
      intendedTargetEntityId !== undefined &&
      (this.hitQuery.hasTarget?.(intendedTargetEntityId) ?? true);
    const queriedHit = queryOwnsTarget
      ? this.hitQuery?.sweepSphere({
          from: this.scratchFrom,
          intendedTargetEntityId,
          ownerEntityId: finiteEntityId(this.ownerEntityIds[slot]),
          radius: this.config.sweepRadius,
          to: this.scratchTo,
        })
      : undefined;
    const fallbackHit =
      queryOwnsTarget || queriedHit || fallbackTargetFraction === undefined
        ? undefined
        : createFallbackTargetHit(
            this.scratchFrom,
            this.scratchTo,
            fallbackTargetFraction,
            this.targetCenters,
            offset,
            intendedTargetEntityId,
          );
    const hit = selectEarlierProjectileHit(
      queriedHit ?? fallbackHit,
      createGroundPlaneHit(this.scratchFrom, this.scratchTo),
    );
    if (!hit) return;

    this.positions[offset] = hit.point.x;
    this.positions[offset + 1] = hit.point.y;
    this.positions[offset + 2] = hit.point.z;
    const hitTarget = hit.targetEntityId !== undefined || hit.material !== "ground";
    this.hitCount += Number(hitTarget);
    this.emitImpact(slot, hitTarget, hit);
    if (this.visualKinds[slot] === VISUAL_CANNONBALL) {
      this.releaseSlot(slot);
      return;
    }
    this.states[slot] = STATE_STUCK;
    this.ages[slot] = 0;
    this.flyingCount -= 1;
    this.stuckCount += 1;
  }

  private emitImpact(slot: number, targetHit: boolean, hit: ProjectileSweepHit): void {
    if (this.impactListeners.size === 0) return;
    const offset = slot * 3;
    const event: ArrowImpactEvent = {
      authority: this.authorities[slot],
      impactId: this.resolveImpactId(slot),
      kind: this.visualKinds[slot] === VISUAL_CANNONBALL ? "cannonball" : "arrow",
      material: hit.material,
      normal: hit.normal.clone(),
      ownerEntityId: finiteEntityId(this.ownerEntityIds[slot]),
      partId: hit.partId,
      position: new Vector3(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]),
      targetEntityId: hit.targetEntityId,
      targetHit,
      velocity: new Vector3(this.velocities[offset], this.velocities[offset + 1], this.velocities[offset + 2]),
    };
    this.impactListeners.forEach((listener) => listener(event));
  }

  private resolveImpactId(slot: number): string {
    const presentationId = this.presentationIds[slot];
    const kind = this.visualKinds[slot] === VISUAL_CANNONBALL ? "cannonball" : "arrow";
    return `${presentationId || kind}:${slot}:${this.generations[slot]}`;
  }

  private releaseSlot(slot: number): void {
    const state = this.states[slot];
    if (state === STATE_FREE) return;
    if (state === STATE_FLYING) this.flyingCount -= 1;
    if (state === STATE_STUCK) this.stuckCount -= 1;
    this.activeCount -= 1;
    this.states[slot] = STATE_FREE;
    this.visualKinds[slot] = VISUAL_ARROW;
    this.ages[slot] = 0;
    this.ownerEntityIds[slot] = Number.NaN;
    this.targetEntityIds[slot] = Number.NaN;
    this.authorities[slot] = "debug";
    this.presentationIds[slot] = "";
    this.freeSlots.push(slot);
    this.scratchMatrix.compose(this.scratchPosition.set(0, -10_000, 0), this.scratchQuaternion.identity(), ZERO_SCALE);
    this.arrowMesh.setMatrixAt(slot, this.scratchMatrix);
    this.cannonballMesh.setMatrixAt(slot, this.scratchMatrix);
    if (this.activeCount === 0) {
      this.arrowMesh.count = 0;
      this.cannonballMesh.count = 0;
    }
    this.matricesDirty = true;
  }

  private updateInstanceMatrices(): void {
    for (let slot = 0; slot < this.config.capacity; slot += 1) {
      if (this.states[slot] === STATE_FREE) continue;
      const offset = slot * 3;
      this.scratchPosition.set(this.positions[offset], this.positions[offset + 1], this.positions[offset + 2]);
      const cannonball = this.visualKinds[slot] === VISUAL_CANNONBALL;
      if (cannonball) this.scratchQuaternion.identity();
      else {
        this.scratchDirection
          .set(this.velocities[offset], this.velocities[offset + 1], this.velocities[offset + 2])
          .normalize();
        this.scratchQuaternion.setFromUnitVectors(ARROW_FORWARD, this.scratchDirection);
      }
      this.scratchMatrix.compose(
        this.scratchPosition,
        this.scratchQuaternion,
        cannonball ? this.cannonballVisualScale : this.arrowVisualScale,
      );
      const activeMesh = cannonball ? this.cannonballMesh : this.arrowMesh;
      const inactiveMesh = cannonball ? this.arrowMesh : this.cannonballMesh;
      activeMesh.setMatrixAt(slot, this.scratchMatrix);
      this.scratchMatrix.compose(
        this.scratchPosition.set(0, -10_000, 0),
        this.scratchQuaternion.identity(),
        ZERO_SCALE,
      );
      inactiveMesh.setMatrixAt(slot, this.scratchMatrix);
    }
    this.arrowMesh.instanceMatrix.needsUpdate = true;
    this.cannonballMesh.instanceMatrix.needsUpdate = true;
    this.matricesDirty = false;
  }

  private hideAllInstances(): void {
    this.scratchMatrix.compose(this.scratchPosition.set(0, -10_000, 0), this.scratchQuaternion.identity(), ZERO_SCALE);
    for (let slot = 0; slot < this.config.capacity; slot += 1) {
      this.arrowMesh.setMatrixAt(slot, this.scratchMatrix);
      this.cannonballMesh.setMatrixAt(slot, this.scratchMatrix);
    }
    this.arrowMesh.count = 0;
    this.cannonballMesh.count = 0;
    this.arrowMesh.instanceMatrix.needsUpdate = true;
    this.cannonballMesh.instanceMatrix.needsUpdate = true;
    this.matricesDirty = false;
  }

  private resolveProjectileMesh(slot: number): InstancedMesh {
    return this.visualKinds[slot] === VISUAL_CANNONBALL ? this.cannonballMesh : this.arrowMesh;
  }

  private updateVisualScales(): void {
    this.arrowVisualScale.setScalar(this.config.visualScale);
    this.cannonballVisualScale.setScalar(this.config.visualScale * 1.15);
  }
}

const WORLD_RIGHT = new Vector3(1, 0, 0);
const WORLD_UP = new Vector3(0, 1, 0);
const VISUAL_ARROW = 0;
const VISUAL_CANNONBALL = 1;

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

function createProjectileMesh(
  geometry: BufferGeometry,
  material: MeshStandardMaterial,
  capacity: number,
  name: string,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = name;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  return mesh;
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

function createFallbackTargetHit(
  from: Readonly<Vector3>,
  to: Readonly<Vector3>,
  fraction: number,
  targetCenters: Float32Array,
  offset: number,
  targetEntityId: number | undefined,
): ProjectileSweepHit {
  const point = new Vector3().copy(from).lerp(to, fraction);
  const normal = point
    .clone()
    .sub(new Vector3(targetCenters[offset], targetCenters[offset + 1], targetCenters[offset + 2]));
  if (normal.lengthSq() <= 1e-8) normal.copy(to).sub(from).normalize().multiplyScalar(-1);
  else normal.normalize();
  return { fraction, material: "flesh", normal, point, targetEntityId };
}

function finiteEntityId(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
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
