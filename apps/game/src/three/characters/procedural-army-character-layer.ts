import type {
  ProceduralMeleeContactEvent,
  ProceduralRangedReleaseEvent,
  ProceduralUnitActor,
  ProceduralUnitConfig,
  ProceduralUnitRuntime,
} from "@/three/characters";
import { T1_KNIGHT_WORLD_SCALE } from "@/three/constants/army-constants";
import type { CosmeticAttachmentTemplate } from "@/three/cosmetics/types";
import { CombatImpactRegistry } from "@/three/combat/combat-impact-registry";
import { intersectSweptSphere } from "@/three/projectiles/arrow-ballistics";
import type { ArrowImpactEvent } from "@/three/projectiles/arrow-projectile-system";
import type { ProjectileSweepHit, ProjectileSweepRequest } from "@/three/projectiles/projectile-hit-query";
import {
  createProceduralCollisionBudget,
  createProceduralCollisionProfile,
  type ProceduralCollisionBudget,
  type ProceduralCollisionProfile,
} from "@/three/characters/collision/procedural-collision-profile";
import type { ProceduralImpactAuthority, ProceduralUnitImpact } from "@/three/characters/collision/procedural-impact";
import {
  ProceduralSeparationSimulation,
  type ProceduralSeparationBodySnapshot,
  type ProceduralSeparationInput,
} from "@/three/characters/collision/procedural-separation-simulation";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import {
  BoxGeometry,
  Euler,
  type Intersection,
  Mesh,
  MeshBasicMaterial,
  type Raycaster,
  type Scene,
  Vector3,
} from "three";

type CharacterModule = typeof import("@/three/characters");

export interface ProceduralArmyCharacterPresentation {
  category: TroopType;
  attachments?: readonly CosmeticAttachmentTemplate[];
  entityId: number;
  distanceToCameraSquared?: number;
  isNaval: boolean;
  isMoving: boolean;
  isSelected?: boolean;
  position: Vector3;
  primaryColor: string;
  rotation?: Euler;
  tier: TroopTier;
}

type ProceduralArmyActorFamily = "boat" | "foot" | "paladin-dragon" | "paladin-horse";

interface ProceduralArmyActorRecord {
  actor: ProceduralUnitActor;
  actorFamily: ProceduralArmyActorFamily;
  attackAuthority: ProceduralImpactAuthority;
  attackTargetEntityId?: number;
  collisionProfile: ProceduralCollisionProfile;
  configSignature: string;
  renderDetail: RenderDetail;
  isT1Knight: boolean;
  hitTarget: Mesh;
  lastReactionStrength: number;
  unsubscribeActionEvents: () => void;
  wasInContact: boolean;
}

interface DefeatedProceduralArmyActor {
  actor: ProceduralUnitActor;
  awaitingImpactSeconds: number;
  entityId: number;
  hitTarget: Mesh;
  inheritedVelocityX: number;
  inheritedVelocityZ: number;
  ragdollStarted: boolean;
  remainingSeconds: number;
}

export interface ProceduralArmyCharacterLayerStats {
  actorCount: number;
  nearKnightCount: number;
  midKnightCount: number;
  meshDrawsPerPass: number;
  trianglesPerPass: number;
  collisionBodyCount: number;
  collisionMaximumOffset: number;
  collisionPairCount: number;
  defeatedActorCount: number;
  hitTargetCount: number;
  loadState: "failed" | "idle" | "loading" | "ready";
  pendingImpactCount: number;
  ragdollCount: number;
  sinkingCount: number;
}

export interface ProceduralArmyRaycastHit {
  distance: number;
  entityId: number;
}

const WORLD_CHARACTER_SCALE = 0.72;
const MAX_ACTOR_CREATIONS_PER_SYNC = 4;
const DEFEAT_LIFETIME_SECONDS = 2.6;
const NAVAL_DEFEAT_LIFETIME_SECONDS = 5.2;
const PROJECTILE_IMPACT_WAIT_SECONDS = 2.4;

/**
 * Production unit presentation for visible land and naval armies. ArmyModel keeps
 * authoritative movement and slots; this layer mirrors those transforms into
 * articulated actors after its shared runtime is ready.
 */
export class ProceduralArmyCharacterLayer {
  private readonly actors = new Map<number, ProceduralArmyActorRecord>();
  private readonly defeatedActors: DefeatedProceduralArmyActor[] = [];
  private readonly meleeContactListeners = new Set<
    (
      entityId: number,
      event: ProceduralMeleeContactEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void
  >();
  private readonly rangedReleaseListeners = new Set<
    (
      entityId: number,
      event: ProceduralRangedReleaseEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void
  >();
  private readonly desiredEntityIds = new Set<number>();
  private readonly hitTargetGeometry = new BoxGeometry(1, 1, 1);
  private readonly hitTargetMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private readonly raycastHits: Intersection[] = [];
  private readonly collisionBudget: ProceduralCollisionBudget = createProceduralCollisionBudget("quality");
  private readonly separationSimulation = new ProceduralSeparationSimulation({
    maxNeighborsPerBody: this.collisionBudget.maxNeighborsPerBody,
    maxPairResolutions: this.collisionBudget.maxPairResolutions,
  });
  private readonly impactRegistry = new CombatImpactRegistry();
  private readonly expectedProjectileImpacts = new Map<number, number>();
  private readonly collisionCandidates: ProceduralArmyCharacterPresentation[] = [];
  private readonly separationInputs: ProceduralSeparationInput[] = [];
  private readonly projectileTargetCenter = new Vector3();
  private readonly projectileHitPoint = new Vector3();
  private readonly projectileImpactDirection = new Vector3();
  private characterModule?: CharacterModule;
  private runtime?: ProceduralUnitRuntime;
  private runtimePromise?: Promise<void>;
  private preparingAssets?: Promise<void>;
  private latestPresentations: readonly ProceduralArmyCharacterPresentation[] = [];
  private readonly assetNeeds = new Map<string, { failed: boolean }>();
  private readonly desiredAssetSignatures = new Set<string>();
  private generation = 0;
  private shadowsEnabled = false;
  private elapsedSeconds = 0;
  private disposed = false;

  public constructor(private readonly scene: Scene) {}

  public sync(presentations: readonly ProceduralArmyCharacterPresentation[], deltaSeconds: number): void {
    if (this.disposed) return;
    this.syncAssetNeeds(presentations);

    if (!this.runtime || !this.characterModule) {
      if (presentations.length === 0) {
        this.latestPresentations = [];
        return;
      }
      this.latestPresentations = presentations.map(clonePresentation);
      this.startRuntimeLoad();
      return;
    }

    this.latestPresentations = [];
    this.syncReadyPresentations(presentations, deltaSeconds);
  }

  public async startRagdoll(entityId: number): Promise<void> {
    const actor = await this.requireActor(entityId);
    await actor?.startRagdoll();
  }

  public async applyImpulse(entityId: number): Promise<void> {
    const actor = await this.requireActor(entityId);
    await actor?.applyImpulse();
  }

  public playAttack(
    entityId: number,
    targetWorld: Readonly<Vector3>,
    targetEntityId?: number,
    authority: ProceduralImpactAuthority = "provisional",
  ): boolean {
    const record = this.actors.get(entityId);
    if (!record) return false;
    record.attackTargetEntityId = targetEntityId;
    record.attackAuthority = authority;
    const started = record.actor.attack(targetWorld);
    if (started && targetEntityId !== undefined && isRangedKind(record.actor.kind)) {
      this.expectedProjectileImpacts.set(targetEntityId, this.elapsedSeconds + PROJECTILE_IMPACT_WAIT_SECONDS);
    }
    return started;
  }

  public sweepProjectile(request: ProjectileSweepRequest): ProjectileSweepHit | undefined {
    const targetEntityId = request.intendedTargetEntityId;
    if (targetEntityId === undefined || targetEntityId === request.ownerEntityId) return undefined;
    const record = this.actors.get(targetEntityId);
    const defeated = this.findAwaitingDefeat(targetEntityId);
    const actor = record?.actor ?? defeated?.actor;
    const hitTarget = record?.hitTarget ?? defeated?.hitTarget;
    if (!actor || !hitTarget || actor.mode !== "animated") return undefined;
    hitTarget.updateWorldMatrix(true, false);
    hitTarget.getWorldPosition(this.projectileTargetCenter);
    const hit = intersectSweptSphere(
      request.from,
      request.to,
      this.projectileTargetCenter,
      resolveProjectileTargetRadius(actor.kind) + request.radius,
      this.projectileHitPoint,
    );
    if (!hit) return undefined;
    const normal = hit.point.clone().sub(this.projectileTargetCenter);
    if (normal.lengthSq() <= 1e-8) normal.copy(request.to).sub(request.from).normalize().multiplyScalar(-1);
    else normal.normalize();
    return {
      fraction: hit.fraction,
      material: actor.kind === "boat" ? "wood" : isArmoredKind(actor.kind) ? "metal" : "flesh",
      normal,
      partId: "chest",
      point: hit.point.clone(),
      targetEntityId,
    };
  }

  public presentProjectileImpact(event: ArrowImpactEvent): boolean {
    const targetEntityId = event.targetEntityId;
    if (targetEntityId === undefined) return false;
    const record = this.actors.get(targetEntityId);
    const defeated = this.findAwaitingDefeat(targetEntityId);
    const actor = record?.actor ?? defeated?.actor;
    if (!actor || actor.mode !== "animated") return false;
    const impact = this.createProjectileImpact(event, targetEntityId, actor, defeated);
    actor.applyReaction(impact);
    if (defeated) {
      this.startDefeatedRagdoll(defeated, impact);
      return true;
    }
    this.impactRegistry.record({
      authority: event.authority,
      impact,
      nowSeconds: this.elapsedSeconds,
      targetEntityId,
    });
    return true;
  }

  public onMeleeContact(
    listener: (
      entityId: number,
      event: ProceduralMeleeContactEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void,
  ): () => void {
    this.meleeContactListeners.add(listener);
    return () => this.meleeContactListeners.delete(listener);
  }

  public onRangedRelease(
    listener: (
      entityId: number,
      event: ProceduralRangedReleaseEvent,
      targetEntityId: number | undefined,
      authority: ProceduralImpactAuthority,
    ) => void,
  ): () => void {
    this.rangedReleaseListeners.add(listener);
    return () => this.rangedReleaseListeners.delete(listener);
  }

  /** Detach a defeated actor from live army state and let Jolt own its final pose briefly. */
  public playDefeat(entityId: number): boolean {
    const record = this.actors.get(entityId);
    if (!record) return false;

    this.actors.delete(entityId);
    record.unsubscribeActionEvents();
    this.makeRoomForDefeatedActor();
    const presentationVelocity = this.separationSimulation.getBodySnapshot(entityId);
    const defeated: DefeatedProceduralArmyActor = {
      actor: record.actor,
      awaitingImpactSeconds: 0,
      entityId,
      hitTarget: record.hitTarget,
      inheritedVelocityX: presentationVelocity?.velocityX ?? 0,
      inheritedVelocityZ: presentationVelocity?.velocityZ ?? 0,
      ragdollStarted: false,
      remainingSeconds: record.actor.kind === "boat" ? NAVAL_DEFEAT_LIFETIME_SECONDS : DEFEAT_LIFETIME_SECONDS,
    };
    this.defeatedActors.push(defeated);
    const impact = this.impactRegistry.consume(entityId, this.elapsedSeconds);
    const expectedImpactExpiresAt = this.expectedProjectileImpacts.get(entityId) ?? 0;
    if (impact) this.startDefeatedRagdoll(defeated, impact);
    else if (expectedImpactExpiresAt > this.elapsedSeconds) {
      defeated.awaitingImpactSeconds = Math.min(
        PROJECTILE_IMPACT_WAIT_SECONDS,
        expectedImpactExpiresAt - this.elapsedSeconds,
      );
    } else this.startDefeatedRagdoll(defeated);
    return true;
  }

  public reset(entityId: number): void {
    this.impactRegistry.remove(entityId);
    this.actors.get(entityId)?.actor.reset();
  }

  public hasActor(entityId: number): boolean {
    return this.actors.has(entityId);
  }

  public hasProjectileTarget(entityId: number): boolean {
    return this.actors.has(entityId) || this.findAwaitingDefeat(entityId) !== undefined;
  }

  public getStats(): ProceduralArmyCharacterLayerStats {
    let nearKnightCount = 0,
      midKnightCount = 0,
      meshDrawsPerPass = 0,
      trianglesPerPass = 0;
    this.actors.forEach(({ actor, renderDetail, isT1Knight }) => {
      if (isT1Knight) {
        if (renderDetail === "hero") nearKnightCount++;
        else midKnightCount++;
      }
      actor.object.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        meshDrawsPerPass += Array.isArray(object.material) ? object.geometry.groups.length : 1;
        trianglesPerPass += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      });
    });
    const collision = this.separationSimulation.getStats();
    return {
      actorCount: this.actors.size,
      nearKnightCount,
      midKnightCount,
      meshDrawsPerPass,
      trianglesPerPass,
      collisionBodyCount: collision.bodyCount,
      collisionMaximumOffset: collision.maximumOffset,
      collisionPairCount: collision.resolvedPairCount,
      defeatedActorCount: this.defeatedActors.length,
      hitTargetCount: this.actors.size,
      loadState: [...this.assetNeeds.values()].some((need) => need.failed)
        ? "failed"
        : this.runtime
          ? "ready"
          : this.runtimePromise
            ? "loading"
            : "idle",
      pendingImpactCount: this.impactRegistry.getStats().activeCount,
      ragdollCount:
        [...this.actors.values()].filter(({ actor }) => actor.mode === "ragdoll").length +
        this.defeatedActors.filter(({ actor }) => actor.mode === "ragdoll").length,
      sinkingCount:
        [...this.actors.values()].filter(({ actor }) => actor.mode === "sinking").length +
        this.defeatedActors.filter(({ actor }) => actor.mode === "sinking").length,
    };
  }

  public getCollisionSnapshots(): ProceduralSeparationBodySnapshot[] {
    return this.separationSimulation.getSnapshots();
  }

  public raycastNearest(raycaster: Raycaster): ProceduralArmyRaycastHit | undefined {
    this.raycastHits.length = 0;
    this.actors.forEach(({ hitTarget }) => {
      hitTarget.updateWorldMatrix(true, false);
      hitTarget.raycast(raycaster, this.raycastHits);
    });
    let nearest: Intersection | undefined;
    this.raycastHits.forEach((hit) => {
      if (!nearest || hit.distance < nearest.distance) nearest = hit;
    });
    const entityId = nearest?.object.userData.entityId;
    return typeof entityId === "number" && nearest ? { distance: nearest.distance, entityId } : undefined;
  }

  public setShadowsEnabled(enabled: boolean): void {
    if (this.shadowsEnabled === enabled) return;
    this.shadowsEnabled = enabled;
    this.actors.forEach(({ actor }) => this.applyActorShadowState(actor));
    this.defeatedActors.forEach(({ actor }) => this.applyActorShadowState(actor));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.assetNeeds.clear();
    this.desiredAssetSignatures.clear();
    this.latestPresentations = [];
    this.separationSimulation.reset();
    this.impactRegistry.reset();
    this.expectedProjectileImpacts.clear();
    this.clearActors();
    this.clearDefeatedActors();
    this.meleeContactListeners.clear();
    this.rangedReleaseListeners.clear();
    this.runtime?.dispose();
    this.runtime = undefined;
    this.characterModule = undefined;
    this.hitTargetGeometry.dispose();
    this.hitTargetMaterial.dispose();
  }

  /** A failure belongs to this continuous need; leaving it permits a fresh attempt on return. */
  private syncAssetNeeds(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    this.desiredAssetSignatures.clear();
    presentations.forEach((presentation) => {
      const signature = resolveAssetSignature(presentation, this.renderDetailOf(presentation));
      this.desiredAssetSignatures.add(signature);
      if (!this.assetNeeds.has(signature)) this.assetNeeds.set(signature, { failed: false });
    });
    this.assetNeeds.forEach((_need, signature) => {
      if (!this.desiredAssetSignatures.has(signature)) this.assetNeeds.delete(signature);
    });
  }

  private startRuntimeLoad(): void {
    const needs = [...this.assetNeeds.values()];
    if (this.runtimePromise || !needs.some((need) => !need.failed)) return;
    const generation = this.generation;
    this.runtimePromise = import("@/three/characters")
      .then(async (characterModule) => {
        const runtime = await characterModule.ProceduralUnitRuntime.create();
        if (this.disposed || generation !== this.generation) {
          runtime.dispose();
          return;
        }
        this.characterModule = characterModule;
        this.runtime = runtime;
        runtime.updatePhysicsConfig(characterModule.createDefaultProceduralUnitConfig().humanoid);
        const pendingPresentations = this.latestPresentations;
        this.latestPresentations = [];
        this.syncReadyPresentations(pendingPresentations, 0);
      })
      .catch((error: unknown) => {
        if (this.disposed || generation !== this.generation) return;
        needs.forEach((need) => {
          need.failed = true;
        });
        console.error("[ProceduralArmyCharacterLayer] Failed to load the procedural unit runtime", error);
      })
      .finally(() => {
        this.runtimePromise = undefined;
      });
  }

  private reconcileActors(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    const runtime = this.runtime;
    if (!runtime) return;
    this.desiredEntityIds.clear();
    presentations.forEach(({ entityId }) => this.desiredEntityIds.add(entityId));
    this.actors.forEach((record, entityId) => {
      if (this.desiredEntityIds.has(entityId)) return;
      this.disposeActorRecord(record);
      this.actors.delete(entityId);
    });
    let remainingCreations = MAX_ACTOR_CREATIONS_PER_SYNC;
    presentations.forEach((presentation) => {
      const desiredActorFamily = resolveActorFamily(presentation);
      const record = this.actors.get(presentation.entityId);
      if (record && record.actorFamily !== desiredActorFamily) {
        this.disposeActorRecord(record);
        this.actors.delete(presentation.entityId);
      }
      const creating = !this.actors.has(presentation.entityId);
      if (creating && remainingCreations === 0) return;
      this.syncActor(presentation);
      // Only an actor made spends the budget: one whose skin is still loading, or failed, leaves it to the next.
      if (creating && this.actors.has(presentation.entityId)) remainingCreations -= 1;
    });
  }

  private syncReadyPresentations(
    presentations: readonly ProceduralArmyCharacterPresentation[],
    deltaSeconds: number,
  ): void {
    this.reconcileActors(presentations);
    this.updatePresentationSeparation(presentations, deltaSeconds);
    this.applyResolvedPresentationTransforms(presentations);
    this.updateRuntime(deltaSeconds);
  }

  private updatePresentationSeparation(
    presentations: readonly ProceduralArmyCharacterPresentation[],
    deltaSeconds: number,
  ): void {
    this.collisionCandidates.length = 0;
    presentations.forEach((presentation) => {
      if (this.actors.get(presentation.entityId)?.actor.mode === "animated") {
        this.collisionCandidates.push(presentation);
      }
    });
    this.collisionCandidates.sort(compareCollisionPriority);
    const count = Math.min(this.collisionBudget.maxActivePresentationBodies, this.collisionCandidates.length);
    for (let index = 0; index < count; index += 1) {
      const presentation = this.collisionCandidates[index];
      const record = this.actors.get(presentation.entityId);
      if (!record) continue;
      const input = this.separationInputs[index] ?? {
        anchorX: 0,
        anchorZ: 0,
        entityId: 0,
        profile: record.collisionProfile,
        yaw: 0,
      };
      input.anchorX = presentation.position.x;
      input.anchorZ = presentation.position.z;
      input.entityId = presentation.entityId;
      input.profile = record.collisionProfile;
      input.yaw = presentation.rotation?.y ?? 0;
      this.separationInputs[index] = input;
    }
    this.separationInputs.length = count;
    this.separationSimulation.update(this.separationInputs, deltaSeconds);
  }

  private applyResolvedPresentationTransforms(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    presentations.forEach((presentation) => {
      const record = this.actors.get(presentation.entityId);
      if (!record || record.actor.mode !== "animated") return;
      const resolved = this.separationSimulation.getBodySnapshot(presentation.entityId);
      record.actor.object.position.set(
        resolved?.positionX ?? presentation.position.x,
        presentation.position.y,
        resolved?.positionZ ?? presentation.position.z,
      );
      record.actor.object.rotation.copy(presentation.rotation ?? ZERO_ROTATION);
      this.applyContactReaction(record, resolved);
    });
  }

  private applyContactReaction(
    record: ProceduralArmyActorRecord,
    resolved: ProceduralSeparationBodySnapshot | undefined,
  ): void {
    if (!resolved || resolved.contactCount === 0) {
      record.wasInContact = false;
      record.lastReactionStrength = 0;
      return;
    }
    const shouldTrigger = !record.wasInContact || resolved.reactionStrength > record.lastReactionStrength * 1.25;
    record.wasInContact = true;
    record.lastReactionStrength = Math.max(record.lastReactionStrength, resolved.reactionStrength);
    if (!shouldTrigger) return;
    record.actor.applyReaction({
      directionX: resolved.reactionX,
      directionY: 0,
      directionZ: resolved.reactionZ,
      source: "body-contact",
      strength: resolved.reactionStrength,
    });
  }

  private updateRuntime(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;
    this.runtime?.update(deltaSeconds);
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 1) : 0;
    this.elapsedSeconds += elapsed;
    this.impactRegistry.prune(this.elapsedSeconds);
    this.pruneExpectedProjectileImpacts();
    for (let index = this.defeatedActors.length - 1; index >= 0; index -= 1) {
      const defeated = this.defeatedActors[index];
      if (!defeated.ragdollStarted) {
        defeated.awaitingImpactSeconds -= elapsed;
        if (defeated.awaitingImpactSeconds <= 0) this.startDefeatedRagdoll(defeated);
        continue;
      }
      defeated.remainingSeconds -= elapsed;
      if (defeated.remainingSeconds > 0) continue;
      this.disposeDefeatedActor(defeated);
      this.defeatedActors.splice(index, 1);
    }
  }

  private syncActor(presentation: ProceduralArmyCharacterPresentation): void {
    const runtime = this.runtime;
    const characterModule = this.characterModule;
    if (!runtime || !characterModule) return;

    const renderDetail = this.renderDetailOf(presentation);
    const configSignature = resolveConfigSignature(presentation, renderDetail);
    let record = this.actors.get(presentation.entityId);
    if (!record || record.configSignature !== configSignature) {
      const config = resolveUnitConfig(characterModule, presentation, renderDetail);
      if (!this.prepareActorAssets(runtime, config, resolveAssetSignature(presentation, renderDetail))) return;
      const desiredKind = resolveUnitKind(presentation);
      if (!record) {
        record = this.createActorRecord(runtime, presentation, config, configSignature);
        this.actors.set(presentation.entityId, record);
      } else {
        runtime.updateActorConfig(record.actor, config);
        record.collisionProfile = createProceduralCollisionProfile(
          desiredKind,
          resolveWorldCharacterScale(presentation.category, presentation.isNaval),
        );
        record.configSignature = configSignature;
        record.renderDetail = config.humanoid.renderDetail;
        record.isT1Knight = isT1FootKnight(presentation);
      }
    }

    configureHitTarget(record.hitTarget, presentation.category, presentation.isNaval);
    if (isT1FootKnight(presentation)) {
      record.hitTarget.position.set(0, 0.31, 0);
      record.hitTarget.scale.set(0.45, 0.64, 0.3);
    }
    if (record.actor.mode === "animated") {
      record.actor.object.scale.setScalar(
        isT1FootKnight(presentation)
          ? T1_KNIGHT_WORLD_SCALE
          : resolveWorldCharacterScale(presentation.category, presentation.isNaval),
      );
    }
  }

  /** The detail an army's actor draws at: its current one until the camera passes the far edge of the switch band. */
  private renderDetailOf(presentation: ProceduralArmyCharacterPresentation): RenderDetail {
    return resolveArmyRenderDetail(
      presentation.distanceToCameraSquared,
      this.actors.get(presentation.entityId)?.renderDetail,
    );
  }

  private prepareActorAssets(runtime: ProceduralUnitRuntime, config: ProceduralUnitConfig, signature: string): boolean {
    const need = this.assetNeeds.get(signature);
    if (!need) return false;
    if (runtime.areAssetsReady(config)) {
      need.failed = false;
      return true;
    }
    if (!this.preparingAssets && !need.failed) {
      this.preparingAssets = runtime
        .prepareAssets(config)
        .catch((error) => {
          if (this.disposed) return;
          need.failed = true;
          console.error("[ProceduralArmyCharacterLayer] Failed to load visible unit assets", error);
        })
        .finally(() => {
          this.preparingAssets = undefined;
        });
    }
    return false;
  }

  private createActorRecord(
    runtime: ProceduralUnitRuntime,
    presentation: ProceduralArmyCharacterPresentation,
    config: ProceduralUnitConfig,
    configSignature: string,
  ): ProceduralArmyActorRecord {
    const actor = runtime.createActor(config);
    actor.object.name = `procedural-army-character:${presentation.entityId}`;
    const hitTarget = this.createHitTarget(presentation);
    actor.object.add(hitTarget);
    const unsubscribeRanged = actor.onRangedRelease((event) => {
      const attack = this.actors.get(presentation.entityId);
      this.rangedReleaseListeners.forEach((listener) =>
        listener(presentation.entityId, event, attack?.attackTargetEntityId, attack?.attackAuthority ?? "provisional"),
      );
    });
    const unsubscribeMelee = actor.onMeleeContact((event) => {
      const attack = this.actors.get(presentation.entityId);
      this.meleeContactListeners.forEach((listener) =>
        listener(presentation.entityId, event, attack?.attackTargetEntityId, attack?.attackAuthority ?? "provisional"),
      );
    });
    this.applyActorShadowState(actor);
    this.scene.add(actor.object);
    return {
      actor,
      actorFamily: resolveActorFamily(presentation),
      attackAuthority: "provisional",
      attackTargetEntityId: undefined,
      collisionProfile: createProceduralCollisionProfile(
        resolveUnitKind(presentation),
        resolveWorldCharacterScale(presentation.category, presentation.isNaval),
      ),
      configSignature,
      renderDetail: config.humanoid.renderDetail,
      isT1Knight: isT1FootKnight(presentation),
      hitTarget,
      lastReactionStrength: 0,
      unsubscribeActionEvents: () => {
        unsubscribeRanged();
        unsubscribeMelee();
      },
      wasInContact: false,
    };
  }

  private async requireActor(entityId: number): Promise<ProceduralUnitActor | undefined> {
    if (this.disposed) return undefined;
    const actor = this.actors.get(entityId)?.actor;
    if (actor) return actor;
    await this.runtimePromise;
    return this.disposed ? undefined : this.actors.get(entityId)?.actor;
  }

  private clearActors(): void {
    this.actors.forEach((record) => this.disposeActorRecord(record));
    this.actors.clear();
  }

  private disposeActorRecord(record: ProceduralArmyActorRecord): void {
    record.unsubscribeActionEvents();
    record.actor.dispose();
  }

  private clearDefeatedActors(): void {
    this.defeatedActors.forEach((defeated) => this.disposeDefeatedActor(defeated));
    this.defeatedActors.length = 0;
  }

  private makeRoomForDefeatedActor(): void {
    const maximum = Math.max(1, this.collisionBudget.maxActiveRagdolls);
    while (this.defeatedActors.length >= maximum) {
      const defeated = this.defeatedActors.shift();
      if (defeated) this.disposeDefeatedActor(defeated);
    }
  }

  private findAwaitingDefeat(entityId: number): DefeatedProceduralArmyActor | undefined {
    return this.defeatedActors.find((defeated) => defeated.entityId === entityId && !defeated.ragdollStarted);
  }

  private startDefeatedRagdoll(
    defeated: DefeatedProceduralArmyActor,
    impact?: Parameters<ProceduralUnitActor["applyImpact"]>[0],
  ): void {
    if (defeated.ragdollStarted) return;
    defeated.ragdollStarted = true;
    defeated.awaitingImpactSeconds = 0;
    defeated.hitTarget.removeFromParent();
    this.expectedProjectileImpacts.delete(defeated.entityId);
    const ragdoll = impact ? defeated.actor.applyImpact(impact) : defeated.actor.applyImpulse();
    void ragdoll.catch((error: unknown) => {
      console.warn(`[ProceduralArmyCharacterLayer] Failed to ragdoll defeated army ${defeated.entityId}`, error);
    });
  }

  private createProjectileImpact(
    event: ArrowImpactEvent,
    targetEntityId: number,
    actor: ProceduralUnitActor,
    defeated: DefeatedProceduralArmyActor | undefined,
  ): ProceduralUnitImpact {
    this.projectileImpactDirection.copy(event.velocity);
    const speed = this.projectileImpactDirection.length();
    if (speed <= 1e-8) this.projectileImpactDirection.set(0, 0, 1);
    else this.projectileImpactDirection.multiplyScalar(1 / speed);
    const inheritedVelocity = this.separationSimulation.getBodySnapshot(targetEntityId);
    return {
      directionX: this.projectileImpactDirection.x,
      directionY: this.projectileImpactDirection.y,
      directionZ: this.projectileImpactDirection.z,
      impactId: event.impactId,
      inheritedVelocityX: defeated?.inheritedVelocityX ?? inheritedVelocity?.velocityX ?? 0,
      inheritedVelocityY: 0,
      inheritedVelocityZ: defeated?.inheritedVelocityZ ?? inheritedVelocity?.velocityZ ?? 0,
      partId: event.partId,
      pointX: event.position.x,
      pointY: event.position.y,
      pointZ: event.position.z,
      source: event.kind,
      strength:
        event.kind === "cannonball" ? Math.min(28, Math.max(10, speed * 1.15)) : Math.min(18, Math.max(4, speed * 0.8)),
      target: resolveImpactTarget(actor, event.position.y),
    };
  }

  private disposeDefeatedActor(defeated: DefeatedProceduralArmyActor): void {
    defeated.hitTarget.removeFromParent();
    defeated.actor.dispose();
    this.expectedProjectileImpacts.delete(defeated.entityId);
  }

  private pruneExpectedProjectileImpacts(): void {
    this.expectedProjectileImpacts.forEach((expiresAt, entityId) => {
      if (expiresAt >= this.elapsedSeconds) return;
      this.expectedProjectileImpacts.delete(entityId);
    });
  }

  private createHitTarget(presentation: ProceduralArmyCharacterPresentation): Mesh {
    const target = new Mesh(this.hitTargetGeometry, this.hitTargetMaterial);
    target.name = `procedural-army-hit-target:${presentation.entityId}`;
    target.visible = false;
    target.userData.entityId = presentation.entityId;
    configureHitTarget(target, presentation.category, presentation.isNaval);
    return target;
  }

  private applyActorShadowState(actor: ProceduralUnitActor): void {
    actor.object.traverse((object) => {
      if (object instanceof Mesh && object.userData.entityId === undefined) object.castShadow = this.shadowsEnabled;
    });
  }
}

const ZERO_ROTATION = new Euler();

function clonePresentation(presentation: ProceduralArmyCharacterPresentation): ProceduralArmyCharacterPresentation {
  return {
    ...presentation,
    position: presentation.position.clone(),
    rotation: presentation.rotation?.clone(),
  };
}

function compareCollisionPriority(
  left: ProceduralArmyCharacterPresentation,
  right: ProceduralArmyCharacterPresentation,
): number {
  const selectedDifference = Number(Boolean(right.isSelected)) - Number(Boolean(left.isSelected));
  if (selectedDifference !== 0) return selectedDifference;
  const movingDifference = Number(right.isMoving) - Number(left.isMoving);
  if (movingDifference !== 0) return movingDifference;
  const distanceDifference =
    (left.distanceToCameraSquared ?? Number.POSITIVE_INFINITY) -
    (right.distanceToCameraSquared ?? Number.POSITIVE_INFINITY);
  if (distanceDifference !== 0) return distanceDifference;
  return left.entityId - right.entityId;
}

function resolveProjectileTargetRadius(kind: ProceduralUnitActor["kind"]): number {
  if (kind === "boat") return 1.35;
  if (kind === "paladin") return 0.62;
  if (kind === "horse") return 0.55;
  return 0.4;
}

function isArmoredKind(kind: ProceduralUnitActor["kind"]): boolean {
  return kind === "crossbowman" || kind === "knight" || kind === "paladin";
}

function isRangedKind(kind: ProceduralUnitActor["kind"]): boolean {
  return kind === "archer" || kind === "boat" || kind === "crossbowman";
}

function resolveImpactTarget(actor: ProceduralUnitActor, impactY: number): "mount" | "rider" | "unit" {
  if (actor.kind !== "paladin") return actor.kind === "horse" ? "mount" : "unit";
  return impactY - actor.object.position.y < 0.72 ? "mount" : "rider";
}

function configureHitTarget(target: Mesh, category: TroopType, isNaval: boolean): void {
  if (isNaval) {
    target.position.set(0, 0.88, 0);
    target.scale.set(1.35, 2.15, 3.3);
    return;
  }
  if (category === TroopType.Paladin) {
    target.position.set(0, 1.25, 0);
    target.scale.set(1.5, 2.3, 2.7);
    return;
  }
  target.position.set(0, 1.15, 0);
  target.scale.set(0.8, 1.9, 0.8);
}

function resolveUnitConfig(
  characterModule: CharacterModule,
  presentation: ProceduralArmyCharacterPresentation,
  renderDetail: RenderDetail,
): ProceduralUnitConfig {
  const tier = resolveCharacterTier(presentation.tier);
  const kind = resolveUnitKind(presentation);
  return characterModule.applyProceduralUnitConfigPatch(characterModule.createDefaultProceduralUnitConfig(), {
    kind,
    boat: {
      broadsideCannons: tier + 2,
      motionMode: presentation.isMoving ? "sail" : "idle",
      primaryColor: presentation.primaryColor,
      seed: resolveCharacterSeed(presentation.entityId),
      showSockets: false,
      showWake: presentation.isMoving,
      speed: presentation.isMoving ? 1.6 : 0,
      tier,
    },
    dragon: {
      locomotionMode: presentation.isMoving ? "flight" : "idle",
      primaryColor: presentation.primaryColor,
      renderDetail: "crowd",
      seed: resolveCharacterSeed(presentation.entityId),
      showBones: false,
      showSockets: false,
      speed: presentation.isMoving ? 3.2 : 0,
      tier,
    },
    horse: {
      gait: presentation.isMoving ? "walk" : "idle",
      primaryColor: presentation.primaryColor,
      showBones: false,
      showHoofTargets: false,
      showSockets: false,
      speed: presentation.isMoving ? 1.4 : 0,
      tier,
    },
    humanoid: {
      animationMode: kind === "paladin" ? "mounted" : presentation.isMoving ? "walk" : "idle",
      autoRotate: false,
      primaryColor: presentation.primaryColor,
      renderDetail,
      seed: resolveCharacterSeed(presentation.entityId),
      tier,
    },
    archer: {
      detailedEquipment: false,
      volleyCount: tier === 3 ? 7 : tier === 2 ? 5 : 3,
      volleySpreadDegrees: tier === 3 ? 1.2 : 0.8,
    },
    melee: { detailedEquipment: kind === "knight" && tier === 1, ...resolveMeleeLoadout(presentation.attachments) },
  });
}

type RenderDetail = "hero" | "crowd";

/**
 * Near detail is reserved for close inspection; gameplay-distance armies use the mid mesh. An actor takes near detail
 * inside 11 units of the camera and keeps it out to 13, so a small zoom in the closest band never rebuilds its rig.
 */
const HERO_DETAIL_ENTER = 11;
const HERO_DETAIL_LEAVE = 13;

function resolveArmyRenderDetail(distanceSquared: number | undefined, current: RenderDetail | undefined): RenderDetail {
  const reach = current === "hero" ? HERO_DETAIL_LEAVE : HERO_DETAIL_ENTER;
  return (distanceSquared ?? Infinity) <= reach * reach ? "hero" : "crowd";
}

function resolveConfigSignature(presentation: ProceduralArmyCharacterPresentation, renderDetail: RenderDetail): string {
  return [
    resolveAssetSignature(presentation, renderDetail),
    presentation.primaryColor,
    presentation.isMoving ? "moving" : "idle",
  ].join(":");
}

function resolveAssetSignature(presentation: ProceduralArmyCharacterPresentation, renderDetail: RenderDetail): string {
  return [
    presentation.category,
    presentation.tier,
    renderDetail,
    presentation.isNaval ? "naval" : "land",
    resolveAttachmentSignature(presentation.attachments),
  ].join(":");
}

function resolveMeleeLoadout(
  attachments: readonly CosmeticAttachmentTemplate[] | undefined,
): Partial<ProceduralUnitConfig["melee"]> {
  const ids = new Set(attachments?.map(({ id }) => id));
  const weaponId = ids.has("winter-knight-primary")
    ? "winter-broadaxe"
    : ids.has("winter-paladin-primary")
      ? "winter-rider-battleaxe"
      : undefined;
  const offhandId = ids.has("winter-knight-secondary")
    ? "winter-targe"
    : ids.has("winter-paladin-secondary")
      ? "winter-rider-shield"
      : ids.has("light-paladin-secondary")
        ? "light-cavalry-shield"
        : undefined;
  return { ...(weaponId && { weaponId }), ...(offhandId && { offhandId }) };
}

function resolveAttachmentSignature(attachments: readonly CosmeticAttachmentTemplate[] | undefined): string {
  return (
    attachments
      ?.map(({ id }) => id)
      .toSorted()
      .join(",") ?? ""
  );
}

function resolveCharacterTier(tier: TroopTier): 1 | 2 | 3 {
  if (tier === TroopTier.T3) return 3;
  if (tier === TroopTier.T2) return 2;
  return 1;
}

function resolveCharacterSeed(entityId: number): number {
  if (!Number.isFinite(entityId)) return 0;
  return Math.abs(Math.trunc(entityId)) % 2_147_483_647;
}

function resolveUnitKind(
  presentation: Pick<ProceduralArmyCharacterPresentation, "category" | "isNaval" | "tier">,
): "archer" | "boat" | "crossbowman" | "knight" | "paladin" {
  if (presentation.isNaval) return "boat";
  if (presentation.category === TroopType.Crossbowman) {
    return presentation.tier === TroopTier.T2 ? "crossbowman" : "archer";
  }
  if (presentation.category === TroopType.Paladin) return "paladin";
  return "knight";
}

function resolveActorFamily(
  presentation: Pick<ProceduralArmyCharacterPresentation, "category" | "isNaval" | "tier">,
): ProceduralArmyActorFamily {
  if (presentation.isNaval) return "boat";
  if (presentation.category !== TroopType.Paladin) return "foot";
  return presentation.tier === TroopTier.T3 ? "paladin-dragon" : "paladin-horse";
}

function resolveWorldCharacterScale(category: TroopType, isNaval: boolean): number {
  if (isNaval) return 0.92;
  return category === TroopType.Paladin ? WORLD_CHARACTER_SCALE * 0.74 : WORLD_CHARACTER_SCALE;
}

function isT1FootKnight(presentation: ProceduralArmyCharacterPresentation): boolean {
  return !presentation.isNaval && presentation.category === TroopType.Knight && presentation.tier === TroopTier.T1;
}
