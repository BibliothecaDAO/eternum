import type { ProceduralCollisionProfile, ProceduralCollisionProxy } from "./procedural-collision-profile";

export interface ProceduralSeparationSimulationConfig {
  cellSize: number;
  contactSlop: number;
  correctionStrength: number;
  fixedStep: number;
  maxCatchUpSteps: number;
  maxNeighborsPerBody: number;
  maxPairResolutions: number;
  snapDistance: number;
  solverIterations: number;
}

export interface ProceduralSeparationInput {
  anchorX: number;
  anchorZ: number;
  entityId: number;
  profile: ProceduralCollisionProfile;
  yaw: number;
}

export interface ProceduralSeparationBodySnapshot {
  anchorX: number;
  anchorZ: number;
  contactCount: number;
  entityId: number;
  offsetX: number;
  offsetZ: number;
  positionX: number;
  positionZ: number;
  reactionStrength: number;
  reactionX: number;
  reactionZ: number;
  velocityX: number;
  velocityZ: number;
}

export interface ProceduralSeparationSimulationStats {
  bodyCount: number;
  candidatePairCount: number;
  droppedPairCount: number;
  maximumOffset: number;
  maximumOverlapRatio: number;
  resolvedPairCount: number;
  simulationSteps: number;
}

interface ProceduralSeparationBody {
  anchorVelocityX: number;
  anchorVelocityZ: number;
  anchorX: number;
  anchorZ: number;
  cellX: number;
  cellZ: number;
  contactCount: number;
  entityId: number;
  offsetVelocityX: number;
  offsetVelocityZ: number;
  offsetX: number;
  offsetZ: number;
  profile: ProceduralCollisionProfile;
  reactionStrength: number;
  reactionX: number;
  reactionZ: number;
  seenGeneration: number;
  yaw: number;
}

interface ProxyContact {
  combinedRadius: number;
  normalX: number;
  normalZ: number;
  overlap: number;
}

const DEFAULT_CONFIG: ProceduralSeparationSimulationConfig = {
  cellSize: 1,
  contactSlop: 0.005,
  correctionStrength: 0.82,
  fixedStep: 1 / 60,
  maxCatchUpSteps: 4,
  maxNeighborsPerBody: 8,
  maxPairResolutions: 1_024,
  snapDistance: 0.75,
  solverIterations: 2,
};

const HASH_X = 73_856_093;
const HASH_Z = 19_349_663;
const MIN_DISTANCE_SQUARED = 1e-10;

export class ProceduralSeparationSimulation {
  private readonly bodies = new Map<number, ProceduralSeparationBody>();
  private readonly orderedBodyIds: number[] = [];
  private readonly buckets = new Map<number, number[]>();
  private readonly reusableBuckets: number[][] = [];
  private readonly activeBucketArrays: number[][] = [];
  private readonly contact: ProxyContact = { combinedRadius: 0, normalX: 1, normalZ: 0, overlap: 0 };
  private config: ProceduralSeparationSimulationConfig;
  private accumulator = 0;
  private syncGeneration = 0;
  private orderedIdsDirty = false;
  private simulationSteps = 0;
  private candidatePairCount = 0;
  private resolvedPairCount = 0;
  private droppedPairCount = 0;
  private maximumOverlapRatio = 0;

  public constructor(config: Partial<ProceduralSeparationSimulationConfig> = {}) {
    this.config = normalizeConfig({ ...DEFAULT_CONFIG, ...config });
  }

  public update(inputs: readonly ProceduralSeparationInput[], deltaSeconds: number): void {
    const elapsed = normalizeDelta(deltaSeconds);
    this.reconcileInputs(inputs, elapsed);
    this.accumulator += elapsed;
    this.simulationSteps = 0;
    while (this.accumulator >= this.config.fixedStep && this.simulationSteps < this.config.maxCatchUpSteps) {
      this.step(this.config.fixedStep);
      this.accumulator -= this.config.fixedStep;
      this.simulationSteps += 1;
    }
    if (this.simulationSteps === this.config.maxCatchUpSteps && this.accumulator >= this.config.fixedStep) {
      this.accumulator = 0;
    }
  }

  public stepOnce(inputs?: readonly ProceduralSeparationInput[]): void {
    if (inputs) this.reconcileInputs(inputs, this.config.fixedStep);
    this.step(this.config.fixedStep);
    this.simulationSteps = 1;
  }

  public updateConfig(config: Partial<ProceduralSeparationSimulationConfig>): void {
    this.config = normalizeConfig({ ...this.config, ...config });
    this.accumulator = 0;
  }

  public getBodySnapshot(entityId: number): ProceduralSeparationBodySnapshot | undefined {
    const body = this.bodies.get(entityId);
    return body ? createBodySnapshot(body) : undefined;
  }

  public getSnapshots(): ProceduralSeparationBodySnapshot[] {
    this.ensureOrderedIds();
    return this.orderedBodyIds.flatMap((entityId) => {
      const body = this.bodies.get(entityId);
      return body ? [createBodySnapshot(body)] : [];
    });
  }

  public getStats(): ProceduralSeparationSimulationStats {
    let maximumOffset = 0;
    this.bodies.forEach((body) => {
      maximumOffset = Math.max(maximumOffset, Math.hypot(body.offsetX, body.offsetZ));
    });
    return {
      bodyCount: this.bodies.size,
      candidatePairCount: this.candidatePairCount,
      droppedPairCount: this.droppedPairCount,
      maximumOffset,
      maximumOverlapRatio: this.maximumOverlapRatio,
      resolvedPairCount: this.resolvedPairCount,
      simulationSteps: this.simulationSteps,
    };
  }

  public reset(): void {
    this.bodies.clear();
    this.orderedBodyIds.length = 0;
    this.releaseBuckets();
    this.accumulator = 0;
    this.syncGeneration = 0;
    this.orderedIdsDirty = false;
    this.resetStepStats();
    this.simulationSteps = 0;
  }

  private reconcileInputs(inputs: readonly ProceduralSeparationInput[], deltaSeconds: number): void {
    const generation = ++this.syncGeneration;
    for (const input of inputs) {
      if (!isFiniteInput(input)) continue;
      const existing = this.bodies.get(input.entityId);
      if (!existing) {
        this.bodies.set(input.entityId, createBody(input, generation));
        this.orderedIdsDirty = true;
        continue;
      }
      const deltaX = input.anchorX - existing.anchorX;
      const deltaZ = input.anchorZ - existing.anchorZ;
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance > this.config.snapDistance) {
        existing.offsetX = 0;
        existing.offsetZ = 0;
        existing.offsetVelocityX = 0;
        existing.offsetVelocityZ = 0;
      }
      const inverseDelta = deltaSeconds > 1e-6 ? 1 / deltaSeconds : 0;
      existing.anchorVelocityX = deltaX * inverseDelta;
      existing.anchorVelocityZ = deltaZ * inverseDelta;
      existing.anchorX = input.anchorX;
      existing.anchorZ = input.anchorZ;
      existing.profile = input.profile;
      existing.seenGeneration = generation;
      existing.yaw = input.yaw;
    }
    this.bodies.forEach((body, entityId) => {
      if (body.seenGeneration === generation) return;
      this.bodies.delete(entityId);
      this.orderedIdsDirty = true;
    });
  }

  private step(deltaSeconds: number): void {
    this.ensureOrderedIds();
    this.resetStepStats();
    this.integrateOffsets(deltaSeconds);
    for (let iteration = 0; iteration < this.config.solverIterations; iteration += 1) {
      this.rebuildBuckets();
      this.resolveBucketContacts();
    }
    this.clampOffsets();
  }

  private integrateOffsets(deltaSeconds: number): void {
    this.bodies.forEach((body) => {
      body.contactCount = 0;
      body.reactionStrength = 0;
      body.reactionX = 0;
      body.reactionZ = 0;
      const omega = Math.LN2 / Math.max(0.01, body.profile.returnHalfLifeSeconds);
      const accelerationX = -omega * omega * body.offsetX - 2 * omega * body.offsetVelocityX;
      const accelerationZ = -omega * omega * body.offsetZ - 2 * omega * body.offsetVelocityZ;
      body.offsetVelocityX += accelerationX * deltaSeconds;
      body.offsetVelocityZ += accelerationZ * deltaSeconds;
      body.offsetX += body.offsetVelocityX * deltaSeconds;
      body.offsetZ += body.offsetVelocityZ * deltaSeconds;
    });
  }

  private rebuildBuckets(): void {
    this.releaseBuckets();
    const inverseCellSize = 1 / this.config.cellSize;
    this.orderedBodyIds.forEach((entityId) => {
      const body = this.bodies.get(entityId);
      if (!body) return;
      body.cellX = Math.floor((body.anchorX + body.offsetX) * inverseCellSize);
      body.cellZ = Math.floor((body.anchorZ + body.offsetZ) * inverseCellSize);
      const key = hashCell(body.cellX, body.cellZ);
      let bucket = this.buckets.get(key);
      if (!bucket) {
        bucket = this.reusableBuckets.pop() ?? [];
        this.buckets.set(key, bucket);
        this.activeBucketArrays.push(bucket);
      }
      bucket.push(entityId);
    });
  }

  private releaseBuckets(): void {
    this.activeBucketArrays.forEach((bucket) => {
      bucket.length = 0;
      this.reusableBuckets.push(bucket);
    });
    this.activeBucketArrays.length = 0;
    this.buckets.clear();
  }

  private resolveBucketContacts(): void {
    for (const entityId of this.orderedBodyIds) {
      const body = this.bodies.get(entityId);
      if (!body) continue;
      let neighborCount = 0;
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        for (let zOffset = -1; zOffset <= 1; zOffset += 1) {
          const bucket = this.buckets.get(hashCell(body.cellX + xOffset, body.cellZ + zOffset));
          if (!bucket) continue;
          for (const otherId of bucket) {
            if (otherId <= entityId) continue;
            this.candidatePairCount += 1;
            if (
              neighborCount >= this.config.maxNeighborsPerBody ||
              this.resolvedPairCount >= this.config.maxPairResolutions
            ) {
              this.droppedPairCount += 1;
              continue;
            }
            const other = this.bodies.get(otherId);
            if (!other || !resolveDeepestContact(body, other, this.contact)) continue;
            neighborCount += 1;
            this.resolveContact(body, other, this.contact);
          }
        }
      }
    }
  }

  private resolveContact(left: ProceduralSeparationBody, right: ProceduralSeparationBody, contact: ProxyContact): void {
    const inverseMassLeft = 1 / Math.max(0.01, left.profile.mass);
    const inverseMassRight = 1 / Math.max(0.01, right.profile.mass);
    const inverseMassSum = inverseMassLeft + inverseMassRight;
    const correction =
      (Math.max(0, contact.overlap - this.config.contactSlop) * this.config.correctionStrength) / inverseMassSum;
    left.offsetX -= contact.normalX * correction * inverseMassLeft;
    left.offsetZ -= contact.normalZ * correction * inverseMassLeft;
    right.offsetX += contact.normalX * correction * inverseMassRight;
    right.offsetZ += contact.normalZ * correction * inverseMassRight;

    const leftVelocityX = left.anchorVelocityX + left.offsetVelocityX;
    const leftVelocityZ = left.anchorVelocityZ + left.offsetVelocityZ;
    const rightVelocityX = right.anchorVelocityX + right.offsetVelocityX;
    const rightVelocityZ = right.anchorVelocityZ + right.offsetVelocityZ;
    const relativeVelocityX = rightVelocityX - leftVelocityX;
    const relativeVelocityZ = rightVelocityZ - leftVelocityZ;
    const normalSpeed = relativeVelocityX * contact.normalX + relativeVelocityZ * contact.normalZ;
    let normalImpulse = 0;
    if (normalSpeed < 0) {
      const restitution = Math.min(left.profile.restitution, right.profile.restitution);
      normalImpulse = (-(1 + restitution) * normalSpeed) / inverseMassSum;
      left.offsetVelocityX -= contact.normalX * normalImpulse * inverseMassLeft;
      left.offsetVelocityZ -= contact.normalZ * normalImpulse * inverseMassLeft;
      right.offsetVelocityX += contact.normalX * normalImpulse * inverseMassRight;
      right.offsetVelocityZ += contact.normalZ * normalImpulse * inverseMassRight;
    }

    const tangentX = -contact.normalZ;
    const tangentZ = contact.normalX;
    const tangentSpeed = relativeVelocityX * tangentX + relativeVelocityZ * tangentZ;
    const tangentDamping = Math.min(left.profile.tangentialDamping, right.profile.tangentialDamping);
    const tangentImpulse = (-tangentSpeed * tangentDamping) / inverseMassSum;
    left.offsetVelocityX -= tangentX * tangentImpulse * inverseMassLeft;
    left.offsetVelocityZ -= tangentZ * tangentImpulse * inverseMassLeft;
    right.offsetVelocityX += tangentX * tangentImpulse * inverseMassRight;
    right.offsetVelocityZ += tangentZ * tangentImpulse * inverseMassRight;

    const reactionStrength = Math.max(contact.overlap, Math.abs(normalImpulse));
    applyReaction(left, -contact.normalX, -contact.normalZ, reactionStrength);
    applyReaction(right, contact.normalX, contact.normalZ, reactionStrength);
    this.maximumOverlapRatio = Math.max(
      this.maximumOverlapRatio,
      contact.overlap / Math.max(1e-6, contact.combinedRadius),
    );
    this.resolvedPairCount += 1;
  }

  private clampOffsets(): void {
    this.bodies.forEach((body) => {
      const distance = Math.hypot(body.offsetX, body.offsetZ);
      const maximum = body.profile.maxVisualOffset;
      if (distance <= maximum || distance <= 1e-8) return;
      const scale = maximum / distance;
      body.offsetX *= scale;
      body.offsetZ *= scale;
      const outwardSpeed = body.offsetVelocityX * body.offsetX + body.offsetVelocityZ * body.offsetZ;
      if (outwardSpeed > 0) {
        const inverseLengthSquared = 1 / Math.max(1e-8, body.offsetX * body.offsetX + body.offsetZ * body.offsetZ);
        body.offsetVelocityX -= body.offsetX * outwardSpeed * inverseLengthSquared;
        body.offsetVelocityZ -= body.offsetZ * outwardSpeed * inverseLengthSquared;
      }
    });
  }

  private ensureOrderedIds(): void {
    if (!this.orderedIdsDirty) return;
    this.orderedBodyIds.length = 0;
    this.bodies.forEach((_body, entityId) => this.orderedBodyIds.push(entityId));
    this.orderedBodyIds.sort((left, right) => left - right);
    this.orderedIdsDirty = false;
  }

  private resetStepStats(): void {
    this.candidatePairCount = 0;
    this.resolvedPairCount = 0;
    this.droppedPairCount = 0;
    this.maximumOverlapRatio = 0;
  }
}

function createBody(input: ProceduralSeparationInput, generation: number): ProceduralSeparationBody {
  return {
    anchorVelocityX: 0,
    anchorVelocityZ: 0,
    anchorX: input.anchorX,
    anchorZ: input.anchorZ,
    cellX: 0,
    cellZ: 0,
    contactCount: 0,
    entityId: input.entityId,
    offsetVelocityX: 0,
    offsetVelocityZ: 0,
    offsetX: 0,
    offsetZ: 0,
    profile: input.profile,
    reactionStrength: 0,
    reactionX: 0,
    reactionZ: 0,
    seenGeneration: generation,
    yaw: input.yaw,
  };
}

function createBodySnapshot(body: ProceduralSeparationBody): ProceduralSeparationBodySnapshot {
  return {
    anchorX: body.anchorX,
    anchorZ: body.anchorZ,
    contactCount: body.contactCount,
    entityId: body.entityId,
    offsetX: body.offsetX,
    offsetZ: body.offsetZ,
    positionX: body.anchorX + body.offsetX,
    positionZ: body.anchorZ + body.offsetZ,
    reactionStrength: body.reactionStrength,
    reactionX: body.reactionX,
    reactionZ: body.reactionZ,
    velocityX: body.anchorVelocityX + body.offsetVelocityX,
    velocityZ: body.anchorVelocityZ + body.offsetVelocityZ,
  };
}

function resolveDeepestContact(
  left: ProceduralSeparationBody,
  right: ProceduralSeparationBody,
  out: ProxyContact,
): boolean {
  let deepestOverlap = 0;
  let normalX = 1;
  let normalZ = 0;
  let combinedRadius = 0;
  for (const leftProxy of left.profile.proxies) {
    const leftCenter = resolveProxyCenter(left, leftProxy);
    for (const rightProxy of right.profile.proxies) {
      const rightCenter = resolveProxyCenter(right, rightProxy);
      const deltaX = rightCenter.x - leftCenter.x;
      const deltaZ = rightCenter.z - leftCenter.z;
      const radius = leftProxy.radius + rightProxy.radius;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
      if (distanceSquared >= radius * radius) continue;
      const distance = Math.sqrt(distanceSquared);
      const overlap = radius - distance;
      if (overlap <= deepestOverlap) continue;
      deepestOverlap = overlap;
      combinedRadius = radius;
      if (distanceSquared <= MIN_DISTANCE_SQUARED) {
        const direction = resolveCoincidentNormal(left.entityId, right.entityId);
        normalX = direction.x;
        normalZ = direction.z;
      } else {
        normalX = deltaX / distance;
        normalZ = deltaZ / distance;
      }
    }
  }
  if (deepestOverlap <= 0) return false;
  out.combinedRadius = combinedRadius;
  out.normalX = normalX;
  out.normalZ = normalZ;
  out.overlap = deepestOverlap;
  return true;
}

function resolveProxyCenter(body: ProceduralSeparationBody, proxy: ProceduralCollisionProxy): { x: number; z: number } {
  const sine = Math.sin(body.yaw);
  const cosine = Math.cos(body.yaw);
  return {
    x: body.anchorX + body.offsetX + cosine * proxy.lateralOffset + sine * proxy.forwardOffset,
    z: body.anchorZ + body.offsetZ - sine * proxy.lateralOffset + cosine * proxy.forwardOffset,
  };
}

function resolveCoincidentNormal(leftId: number, rightId: number): { x: number; z: number } {
  const hash = Math.imul(leftId ^ 0x9e3779b9, 16_777_619) ^ Math.imul(rightId, 2_246_822_519);
  const angle = ((hash >>> 0) / 0x1_0000_0000) * Math.PI * 2;
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function applyReaction(body: ProceduralSeparationBody, x: number, z: number, strength: number): void {
  body.contactCount += 1;
  if (strength <= body.reactionStrength) return;
  body.reactionStrength = strength;
  body.reactionX = x;
  body.reactionZ = z;
}

function hashCell(x: number, z: number): number {
  return (Math.imul(x, HASH_X) ^ Math.imul(z, HASH_Z)) | 0;
}

function isFiniteInput(input: ProceduralSeparationInput): boolean {
  return (
    Number.isInteger(input.entityId) &&
    Number.isFinite(input.anchorX) &&
    Number.isFinite(input.anchorZ) &&
    Number.isFinite(input.yaw)
  );
}

function normalizeConfig(config: ProceduralSeparationSimulationConfig): ProceduralSeparationSimulationConfig {
  return {
    cellSize: clamp(config.cellSize, 0.25, 8),
    contactSlop: clamp(config.contactSlop, 0, 0.1),
    correctionStrength: clamp(config.correctionStrength, 0, 1),
    fixedStep: clamp(config.fixedStep, 1 / 120, 1 / 20),
    maxCatchUpSteps: clampInteger(config.maxCatchUpSteps, 1, 8),
    maxNeighborsPerBody: clampInteger(config.maxNeighborsPerBody, 1, 32),
    maxPairResolutions: clampInteger(config.maxPairResolutions, 1, 8_192),
    snapDistance: clamp(config.snapDistance, 0.1, 10),
    solverIterations: clampInteger(config.solverIterations, 1, 6),
  };
}

function normalizeDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(0.1, Math.max(0, value)) : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.round(clamp(value, minimum, maximum));
}
