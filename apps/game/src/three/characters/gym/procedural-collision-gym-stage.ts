import {
  applyProceduralUnitConfigPatch,
  type ProceduralUnitActor,
  type ProceduralUnitConfig,
  type ProceduralUnitKind,
  type ProceduralUnitRuntime,
} from "@/three/characters";
import { createProceduralCollisionProfile } from "../collision/procedural-collision-profile";
import type { ProceduralUnitImpact } from "../collision/procedural-impact";
import {
  ProceduralSeparationSimulation,
  type ProceduralSeparationInput,
} from "../collision/procedural-separation-simulation";
import { ArrowProjectileSystem, type ArrowImpactEvent } from "@/three/projectiles/arrow-projectile-system";
import { intersectSweptSphere } from "@/three/projectiles/arrow-ballistics";
import type {
  ProjectileHitQuery,
  ProjectileSweepHit,
  ProjectileSweepRequest,
} from "@/three/projectiles/projectile-hit-query";
import {
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";

import {
  applyProceduralCollisionGymConfigPatch,
  resolveCollisionGymActorCount,
  type ProceduralCollisionGymConfig,
} from "./procedural-collision-gym-config";

export interface ProceduralCollisionGymStats {
  activeContactCount: number;
  actorCount: number;
  activeProjectileCount: number;
  candidatePairCount: number;
  contactCount: number;
  droppedPairCount: number;
  elapsedSeconds: number;
  impactCount: number;
  maximumOffset: number;
  ragdollCount: number;
  scenario: ProceduralCollisionGymConfig["scenario"];
}

interface CollisionGymActorRecord {
  actor: ProceduralUnitActor;
  anchor: Vector3;
  contactActive: boolean;
  entityId: number;
  input: ProceduralSeparationInput;
  kind: ProceduralUnitKind;
  unsubscribeRanged: () => void;
  velocity: Vector3;
}

const MAX_GYM_ACTORS = 100;
const MAX_GYM_PROXIES = MAX_GYM_ACTORS * 2;
const ACTOR_BUILD_BATCH_SIZE = 1;
const GYM_ACTOR_SCALE = 0.78;
const ARENA_HALF_EXTENT = 3.2;

export class ProceduralCollisionGymStage implements ProjectileHitQuery {
  public readonly group = new Group();

  private readonly simulation = new ProceduralSeparationSimulation({ maxPairResolutions: 2_048 });
  private readonly actors: CollisionGymActorRecord[] = [];
  private readonly inputs: ProceduralSeparationInput[] = [];
  private readonly debugGeometry = new CylinderGeometry(1, 1, 0.025, 16);
  private readonly debugMaterial = new MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.45,
    wireframe: true,
  });
  private readonly debugMesh = new InstancedMesh(this.debugGeometry, this.debugMaterial, MAX_GYM_PROXIES);
  private readonly debugColor = new Color();
  private readonly debugMatrix = new Matrix4();
  private readonly debugQuaternion = new Quaternion();
  private readonly debugPosition = new Vector3();
  private readonly debugScale = new Vector3();
  private readonly targetPosition = new Vector3();
  private readonly hitPoint = new Vector3();
  private readonly hitCenter = new Vector3();
  private readonly impactDirection = new Vector3();
  private projectiles: ArrowProjectileSystem;
  private config: ProceduralCollisionGymConfig;
  private unitConfig: ProceduralUnitConfig;
  private elapsedSeconds = 0;
  private contactCount = 0;
  private impactCount = 0;
  private maximumDroppedPairCount = 0;
  private maximumOffset = 0;
  private automaticArrowFired = false;
  private desiredActorCount = 0;
  private actorsInitialized = false;
  private disposed = false;

  public constructor(
    private readonly unitRuntime: ProceduralUnitRuntime,
    unitConfig: ProceduralUnitConfig,
    config: ProceduralCollisionGymConfig,
  ) {
    this.unitConfig = unitConfig;
    this.config = applyProceduralCollisionGymConfigPatch(config, {});
    this.group.name = "procedural-collision-gym-stage";
    this.debugMesh.name = "procedural-collision-gym-proxies";
    this.debugMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.debugMesh.frustumCulled = false;
    this.projectiles = this.createProjectiles();
    this.group.add(this.debugMesh, this.projectiles.group);
    this.updateVisibility();
    if (this.config.enabled) this.rebuildActors();
  }

  public update(deltaSeconds: number): void {
    if (this.disposed || !this.config.enabled) return;
    if (!this.buildActorBatch()) return;
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(0.1, Math.max(0, deltaSeconds)) : 0;
    this.elapsedSeconds += elapsed;
    this.advanceAnchors(elapsed);
    this.inputs.length = 0;
    this.actors.forEach((record) => {
      if (record.actor.mode !== "animated") return;
      record.input.anchorX = record.anchor.x;
      record.input.anchorZ = record.anchor.z;
      record.input.yaw = Math.atan2(record.velocity.x, record.velocity.z);
      this.inputs.push(record.input);
    });
    this.simulation.update(this.inputs, elapsed);
    const simulation = this.simulation.getStats();
    this.maximumDroppedPairCount = Math.max(this.maximumDroppedPairCount, simulation.droppedPairCount);
    this.maximumOffset = Math.max(this.maximumOffset, simulation.maximumOffset);
    this.applyActorTransforms();
    this.updateDebugInstances();
    if (isArrowScenario(this.config.scenario) && !this.automaticArrowFired && this.elapsedSeconds >= 0.35) {
      this.automaticArrowFired = this.fireArrow();
    }
  }

  public updateProjectiles(deltaSeconds: number): void {
    if (!this.config.enabled || this.disposed) return;
    this.projectiles.update(deltaSeconds);
  }

  public stepOnce(): void {
    if (!this.config.enabled || this.disposed) return;
    this.update(1 / 60);
    this.projectiles.stepOnce();
  }

  public fireArrow(): boolean {
    if (!this.actorsInitialized || !isArrowScenario(this.config.scenario)) return false;
    const shooter = this.actors[0];
    const target = this.actors[1];
    if (!shooter || !target || shooter.actor.mode !== "animated" || target.actor.mode !== "animated") return false;
    this.writeTargetPosition(target, this.targetPosition);
    shooter.actor.setRangedTarget(this.targetPosition);
    return shooter.actor.fireRangedAttack(this.targetPosition);
  }

  public reset(): void {
    if (this.disposed) return;
    this.resetScenarioState();
    this.simulation.reset();
    this.projectiles.reset();
    this.actors.forEach(({ actor }) => actor.reset());
    this.initializeActorMotion();
    this.update(0);
  }

  public updateConfig(config: ProceduralCollisionGymConfig): void {
    if (this.disposed) return;
    const normalized = applyProceduralCollisionGymConfigPatch(this.config, config);
    const rebuild =
      normalized.enabled !== this.config.enabled ||
      normalized.actorCount !== this.config.actorCount ||
      normalized.scenario !== this.config.scenario ||
      normalized.seed !== this.config.seed;
    const restartMotion = normalized.speed !== this.config.speed;
    this.config = normalized;
    this.unitRuntime.setCrowdAnimationLaneCount(
      normalized.enabled && resolveCollisionGymActorCount(normalized) >= 50 ? 3 : 1,
    );
    this.updateVisibility();
    if (rebuild) {
      if (normalized.enabled) this.rebuildActors();
      else this.clearActors();
    } else if (restartMotion && normalized.enabled && this.actorsInitialized) {
      this.actors.forEach((record, index) => {
        this.unitRuntime.updateActorConfig(record.actor, this.resolveActorConfig(record.kind, index));
      });
      this.reset();
    }
    this.debugMesh.visible = normalized.enabled && normalized.showDebug;
  }

  public updateUnitConfig(config: ProceduralUnitConfig): void {
    this.unitConfig = config;
    if (!this.config.enabled) return;
    this.actors.forEach((record, index) => {
      this.unitRuntime.updateActorConfig(record.actor, this.resolveActorConfig(record.kind, index));
    });
    this.projectiles.updateConfig(resolveProjectileConfig(config));
  }

  public getStats(): ProceduralCollisionGymStats {
    const simulation = this.simulation.getStats();
    return {
      activeContactCount: simulation.resolvedPairCount,
      actorCount: this.actors.length,
      activeProjectileCount: this.projectiles.getStats().activeCount,
      candidatePairCount: simulation.candidatePairCount,
      contactCount: this.contactCount,
      droppedPairCount: this.maximumDroppedPairCount,
      elapsedSeconds: this.elapsedSeconds,
      impactCount: this.impactCount,
      maximumOffset: this.maximumOffset,
      ragdollCount: this.actors.reduce((count, record) => count + Number(record.actor.mode === "ragdoll"), 0),
      scenario: this.config.scenario,
    };
  }

  public sweepSphere(request: ProjectileSweepRequest): ProjectileSweepHit | undefined {
    const record = this.actors.find(({ entityId }) => entityId === request.intendedTargetEntityId);
    if (!record || record.entityId === request.ownerEntityId || record.actor.mode !== "animated") return undefined;
    this.writeTargetPosition(record, this.hitCenter);
    const radius = record.kind === "paladin" ? 0.62 : 0.42;
    const hit = intersectSweptSphere(request.from, request.to, this.hitCenter, radius + request.radius, this.hitPoint);
    if (!hit) return undefined;
    const normal = hit.point.clone().sub(this.hitCenter);
    if (normal.lengthSq() <= 1e-8) normal.copy(request.to).sub(request.from).normalize().multiplyScalar(-1);
    else normal.normalize();
    return {
      fraction: hit.fraction,
      material: record.kind === "archer" ? "flesh" : "metal",
      normal,
      partId: "chest",
      point: hit.point.clone(),
      targetEntityId: record.entityId,
    };
  }

  public hasTarget(entityId: number): boolean {
    return this.actors.some((record) => record.entityId === entityId && record.actor.mode === "animated");
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearActors();
    this.projectiles.dispose();
    this.debugMesh.dispose();
    this.debugGeometry.dispose();
    this.debugMaterial.dispose();
    this.group.clear();
    this.group.removeFromParent();
  }

  private rebuildActors(): void {
    this.clearActors();
    this.resetScenarioState();
    this.simulation.reset();
    this.projectiles.reset();
    this.desiredActorCount = resolveCollisionGymActorCount(this.config);
    this.actorsInitialized = false;
    this.debugMesh.count = 0;
  }

  private clearActors(): void {
    this.actors.forEach(({ actor, unsubscribeRanged }) => {
      unsubscribeRanged();
      actor.dispose();
    });
    this.actors.length = 0;
    this.inputs.length = 0;
    this.desiredActorCount = 0;
    this.actorsInitialized = false;
    this.debugMesh.count = 0;
  }

  private buildActorBatch(): boolean {
    const batchEnd = Math.min(this.desiredActorCount, this.actors.length + ACTOR_BUILD_BATCH_SIZE);
    while (this.actors.length < batchEnd) this.addActor(this.actors.length);
    this.debugMesh.count = 0;
    if (this.actors.length < this.desiredActorCount) return false;
    if (!this.actorsInitialized) {
      this.actorsInitialized = true;
      this.initializeActorMotion();
      this.actors.forEach(({ actor }) => {
        actor.object.visible = true;
      });
    }
    return true;
  }

  private addActor(index: number): void {
    const kind = resolveScenarioKind(this.config.scenario, index);
    const actor = this.unitRuntime.createActor(this.resolveActorConfig(kind, index));
    actor.object.name = `collision-gym-actor:${index + 1}`;
    actor.object.scale.setScalar(GYM_ACTOR_SCALE);
    actor.object.visible = false;
    this.group.add(actor.object);
    const record: CollisionGymActorRecord = {
      actor,
      anchor: new Vector3(),
      contactActive: false,
      entityId: index + 1,
      input: {
        anchorX: 0,
        anchorZ: 0,
        entityId: index + 1,
        profile: createProceduralCollisionProfile(kind, GYM_ACTOR_SCALE),
        yaw: 0,
      },
      kind,
      unsubscribeRanged: () => undefined,
      velocity: new Vector3(),
    };
    record.unsubscribeRanged = actor.onRangedRelease((event) => this.spawnReleasedArrow(record, event));
    this.actors.push(record);
  }

  private resetScenarioState(): void {
    this.elapsedSeconds = 0;
    this.contactCount = 0;
    this.impactCount = 0;
    this.maximumDroppedPairCount = 0;
    this.maximumOffset = 0;
    this.automaticArrowFired = false;
  }

  private initializeActorMotion(): void {
    let randomState = this.config.seed >>> 0 || 0x9e3779b9;
    this.actors.forEach((record, index) => {
      const scenario = this.config.scenario;
      if (isArrowScenario(scenario)) {
        record.anchor.set(0, 0, index === 0 ? -2.4 : 2);
        record.velocity.set(0, 0, 0);
        return;
      }
      if (scenario === "head-on" || scenario === "foot-vs-mounted") {
        record.anchor.set(index === 0 ? -1.35 : 1.35, 0, 0);
        record.velocity.set(index === 0 ? 1 : -1, 0, 0).multiplyScalar(this.config.speed);
        return;
      }
      if (scenario === "glancing") {
        record.anchor.set(index === 0 ? -1.35 : 1.35, 0, index === 0 ? -0.22 : 0.22);
        record.velocity.set(index === 0 ? 1 : -1, 0, 0).multiplyScalar(this.config.speed);
        return;
      }
      randomState = nextRandomState(randomState);
      const horizontal = randomUnit(randomState);
      randomState = nextRandomState(randomState);
      const vertical = randomUnit(randomState);
      const columns = Math.max(2, Math.ceil(Math.sqrt(this.actors.length)));
      const row = Math.floor(index / columns);
      const column = index % columns;
      record.anchor.set((column - (columns - 1) / 2) * 0.55, 0, (row - (columns - 1) / 2) * 0.55);
      if (scenario === "crossflow") {
        const lane = index % 4;
        record.velocity.set(lane < 2 ? (lane === 0 ? 1 : -1) : 0, 0, lane >= 2 ? (lane === 2 ? 1 : -1) : 0);
      } else {
        record.velocity.set(horizontal, 0, vertical).normalize();
      }
      record.velocity.multiplyScalar(this.config.speed * (0.78 + Math.abs(horizontal) * 0.32));
    });
  }

  private advanceAnchors(deltaSeconds: number): void {
    if (isArrowScenario(this.config.scenario)) {
      const target = this.actors[1];
      if (target) this.writeTargetPosition(target, this.targetPosition);
      this.actors[0]?.actor.setRangedTarget(target ? this.targetPosition : undefined);
      return;
    }
    this.actors.forEach((record) => {
      record.anchor.addScaledVector(record.velocity, deltaSeconds);
      if (Math.abs(record.anchor.x) > ARENA_HALF_EXTENT) {
        record.anchor.x = Math.sign(record.anchor.x) * ARENA_HALF_EXTENT;
        record.velocity.x *= -1;
      }
      if (Math.abs(record.anchor.z) > ARENA_HALF_EXTENT) {
        record.anchor.z = Math.sign(record.anchor.z) * ARENA_HALF_EXTENT;
        record.velocity.z *= -1;
      }
    });
  }

  private applyActorTransforms(): void {
    this.actors.forEach((record) => {
      if (record.actor.mode !== "animated") return;
      const state = this.simulation.getBodySnapshot(record.entityId);
      record.actor.object.position.set(state?.positionX ?? record.anchor.x, 0, state?.positionZ ?? record.anchor.z);
      record.actor.object.rotation.y = Math.atan2(record.velocity.x, record.velocity.z);
      const inContact = Boolean(state?.contactCount);
      if (inContact && !record.contactActive && state) {
        this.contactCount += 1;
        record.actor.applyReaction({
          directionX: state.reactionX,
          directionY: 0,
          directionZ: state.reactionZ,
          source: "body-contact",
          strength: state.reactionStrength,
        });
      }
      record.contactActive = inContact;
    });
  }

  private updateDebugInstances(): void {
    this.debugMesh.visible = this.config.showDebug;
    if (!this.config.showDebug) return;
    let instanceIndex = 0;
    this.actors.forEach((record) => {
      const state = this.simulation.getBodySnapshot(record.entityId);
      const positionX = state?.positionX ?? record.anchor.x;
      const positionZ = state?.positionZ ?? record.anchor.z;
      const sine = Math.sin(record.input.yaw);
      const cosine = Math.cos(record.input.yaw);
      record.input.profile.proxies.forEach((proxy) => {
        this.debugPosition.set(
          positionX + cosine * proxy.lateralOffset + sine * proxy.forwardOffset,
          0.02,
          positionZ - sine * proxy.lateralOffset + cosine * proxy.forwardOffset,
        );
        this.debugScale.set(proxy.radius, 1, proxy.radius);
        this.debugMatrix.compose(this.debugPosition, this.debugQuaternion.identity(), this.debugScale);
        this.debugMesh.setMatrixAt(instanceIndex, this.debugMatrix);
        this.debugMesh.setColorAt(instanceIndex, this.debugColor.set(record.contactActive ? 0xfb7185 : 0x67e8f9));
        instanceIndex += 1;
      });
    });
    this.debugMesh.count = instanceIndex;
    this.debugMesh.instanceMatrix.needsUpdate = true;
    if (this.debugMesh.instanceColor) this.debugMesh.instanceColor.needsUpdate = true;
  }

  private spawnReleasedArrow(
    shooter: CollisionGymActorRecord,
    event: { origin: Vector3; seed: number; target: Vector3 },
  ): void {
    const target = this.actors[1];
    if (!target) return;
    this.writeTargetPosition(target, this.targetPosition);
    this.projectiles.spawnVolley({
      authority: "debug",
      color: this.unitConfig.humanoid.primaryColor,
      count: 1,
      flightSeconds: this.unitConfig.archer.projectileFlightSeconds,
      origin: event.origin,
      ownerEntityId: shooter.entityId,
      presentationId: `collision-gym:${event.seed}`,
      seed: event.seed,
      spreadDegrees: 0,
      target: this.targetPosition,
      targetEntityId: target.entityId,
      targetRadius: this.unitConfig.archer.targetRadius,
    });
  }

  private handleProjectileImpact(event: ArrowImpactEvent): void {
    const record = this.actors.find(({ entityId }) => entityId === event.targetEntityId);
    if (!record) return;
    this.impactCount += 1;
    this.impactDirection.copy(event.velocity);
    const speed = this.impactDirection.length();
    if (speed <= 1e-8) this.impactDirection.set(0, 0, 1);
    else this.impactDirection.multiplyScalar(1 / speed);
    const impact: ProceduralUnitImpact = {
      directionX: this.impactDirection.x,
      directionY: this.impactDirection.y,
      directionZ: this.impactDirection.z,
      impactId: event.impactId,
      inheritedVelocityX: record.velocity.x,
      inheritedVelocityY: 0,
      inheritedVelocityZ: record.velocity.z,
      partId: event.partId,
      pointX: event.position.x,
      pointY: event.position.y,
      pointZ: event.position.z,
      source: "arrow" as const,
      strength: Math.min(18, Math.max(4, speed * 0.8)),
      target: record.kind === "paladin" ? (event.position.y < 0.72 ? "mount" : "rider") : "unit",
    };
    record.actor.applyReaction(impact);
    if (this.config.scenario === "arrow-defeat") void record.actor.applyImpact(impact);
  }

  private createProjectiles(): ArrowProjectileSystem {
    const projectiles = new ArrowProjectileSystem({ ...resolveProjectileConfig(this.unitConfig), capacity: 256 }, this);
    projectiles.onImpact((event) => this.handleProjectileImpact(event));
    return projectiles;
  }

  private resolveActorConfig(kind: ProceduralUnitKind, index: number): ProceduralUnitConfig {
    return applyProceduralUnitConfigPatch(this.unitConfig, {
      archer: {
        detailedEquipment: this.desiredActorCount < 50 && this.unitConfig.archer.detailedEquipment,
      },
      kind,
      horse: {
        gait: kind === "paladin" || kind === "horse" ? "trot" : this.unitConfig.horse.gait,
        seed: (this.config.seed + index * 97) >>> 0,
        speed: this.config.speed * 1.8,
        tier: this.resolveActorTier(index),
      },
      humanoid: {
        animationMode:
          kind === "paladin" ? "mounted" : kind === "archer" && isArrowScenario(this.config.scenario) ? "idle" : "run",
        autoRotate: false,
        renderDetail: this.desiredActorCount >= 50 ? "crowd" : this.unitConfig.humanoid.renderDetail,
        seed: (this.config.seed + index * 97) >>> 0,
        tier: this.resolveActorTier(index),
      },
      melee: {
        detailedEquipment: this.desiredActorCount < 50 && this.unitConfig.melee.detailedEquipment,
      },
    });
  }

  private resolveActorTier(index: number): 1 | 2 | 3 {
    return this.desiredActorCount >= 50 ? (((index % 3) + 1) as 1 | 2 | 3) : this.unitConfig.humanoid.tier;
  }

  private writeTargetPosition(record: CollisionGymActorRecord, out: Vector3): void {
    out.copy(record.actor.object.position);
    out.y += record.kind === "paladin" ? 1.05 : 0.9;
  }

  private updateVisibility(): void {
    this.group.visible = this.config.enabled;
    this.debugMesh.visible = this.config.enabled && this.config.showDebug;
  }
}

function resolveScenarioKind(scenario: ProceduralCollisionGymConfig["scenario"], index: number): ProceduralUnitKind {
  if (isArrowScenario(scenario)) return index === 0 ? "archer" : "knight";
  if (scenario === "foot-vs-mounted") return index === 0 ? "knight" : "paladin";
  if (scenario === "crowd") return (["knight", "archer", "crossbowman"] as const)[index % 3];
  if (scenario === "crossflow") {
    return (["knight", "archer", "crossbowman", "paladin"] as const)[index % 4];
  }
  return "knight";
}

function isArrowScenario(scenario: ProceduralCollisionGymConfig["scenario"]): boolean {
  return scenario === "arrow-defeat" || scenario === "arrow-nonlethal";
}

function resolveProjectileConfig(config: ProceduralUnitConfig) {
  return {
    fixedStep: config.archer.projectileFixedStep,
    gravity: config.archer.projectileGravity,
    maxSubsteps: 8,
    stickSeconds: config.archer.projectileStickSeconds,
    sweepRadius: config.archer.projectileSweepRadius,
    visualScale: 1,
  };
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
