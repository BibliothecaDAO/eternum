import { Group, Quaternion, Vector3 } from "three";

import { ProceduralArcherController } from "./archer/procedural-archer-controller";
import type { ProceduralUnitImpact, ProceduralUnitReactionInput } from "./collision/procedural-impact";
import type { ProceduralArcherUpperBodyPose } from "./archer/procedural-archer-pose";
import type { ProceduralArcherShotPhase } from "./archer/procedural-archer-shot-cycle";
import { resolveProceduralCrossbowCarryPose } from "./crossbow/procedural-crossbow-pose";
import { ProceduralMeleeController } from "./melee/procedural-melee-controller";
import type { ProceduralMeleeUpperBodyPose } from "./melee/procedural-melee-pose";
import type { ProceduralMeleeAttackPhase } from "./melee/procedural-melee-attack-cycle";
import type { ProceduralMeleeEquipmentSource } from "./melee/procedural-melee-weapon-library";
import { ProceduralMeleeWeaponLibrary } from "./melee/procedural-melee-weapon-library";
import type { ProceduralMeleeOffhandId, ProceduralMeleeWeaponId } from "./melee/procedural-melee-weapon-catalog";
import type { CharacterPartId } from "./procedural-character-rig";
import { ProceduralCrowdUpdateScheduler } from "./procedural-crowd-update-scheduler";
import { createDefaultProceduralCharacterConfig, type ProceduralCharacterConfig } from "./procedural-character-config";
import { resolveJoltWorldConfig } from "./jolt-character-ragdoll";
import { JoltRagdollWorld } from "./jolt-ragdoll-world";
import {
  ProceduralCharacterRuntime,
  type ProceduralCharacterActor,
  type ProceduralCharacterActorStats,
  type ProceduralCharacterMode,
  type ProceduralCharacterRuntimeOptions,
} from "./procedural-character-runtime";
import {
  applyProceduralUnitConfigPatch,
  type ProceduralUnitConfig,
  type ProceduralUnitKind,
} from "./procedural-unit-config";
import { ProceduralUnitEquipment } from "./procedural-unit-equipment";
import {
  resolveProceduralUnitPoseDiagnostics,
  type ProceduralUnitPoseDiagnostics,
} from "./procedural-unit-diagnostics";
import { ProceduralHorseRuntime, type ProceduralHorseActor } from "./horse/procedural-horse-runtime";
import { resolveHorseGaitCadence } from "./horse/procedural-horse-gait";

interface ProceduralUnitActorStats extends ProceduralCharacterActorStats {
  kind: ProceduralUnitKind;
  maximumHorseBoneStretchRatio: number;
  minimumBendAlignment: number;
  meleeContactCount: number;
  meleeOffhandId: ProceduralMeleeOffhandId;
  meleeOffhandSource: ProceduralMeleeEquipmentSource | "none";
  meleePhase: ProceduralMeleeAttackPhase;
  meleeWeaponId: ProceduralMeleeWeaponId;
  meleeWeaponSource: ProceduralMeleeEquipmentSource;
  stanceHoofCount: number;
  rangedPhase: ProceduralArcherShotPhase;
  rangedReleaseCount: number;
  previewArrowVisible: boolean;
  stringContinuityError: number;
}

export interface ProceduralRangedReleaseEvent {
  direction: Vector3;
  origin: Vector3;
  seed: number;
  shotGeneration: number;
  target: Vector3;
}

export interface ProceduralMeleeContactEvent {
  attackGeneration: number;
  direction: Vector3;
  impactStrength: number;
  origin: Vector3;
  target: Vector3;
  weaponId: ProceduralMeleeWeaponId;
}

export interface ProceduralUnitActor {
  readonly kind: ProceduralUnitKind;
  readonly mode: ProceduralCharacterMode;
  readonly object: Group;

  applyReaction(reaction: ProceduralUnitReactionInput): void;
  applyImpact(impact: ProceduralUnitImpact): Promise<void>;
  applyImpulse(partId?: CharacterPartId): Promise<void>;
  attack(targetWorld: Readonly<Vector3>): boolean;
  cancelMeleeAttack(): void;
  dispose(): void;
  fireMeleeAttack(targetWorld: Readonly<Vector3>): boolean;
  getPoseDiagnostics(): ProceduralUnitPoseDiagnostics;
  getStats(): ProceduralUnitActorStats;
  hasFiniteState(): boolean;
  cancelRangedAttack(): void;
  fireRangedAttack(targetWorld: Readonly<Vector3>): boolean;
  onRangedRelease(listener: (event: ProceduralRangedReleaseEvent) => void): () => void;
  onMeleeContact(listener: (event: ProceduralMeleeContactEvent) => void): () => void;
  reset(): void;
  startRagdoll(): Promise<void>;
  setRangedTarget(targetWorld?: Readonly<Vector3>): void;
  setMeleeTarget(targetWorld?: Readonly<Vector3>): void;
  stepOnce(): void;
  update(deltaSeconds: number): void;
  updateConfig(config: ProceduralUnitConfig): void;
}

export class ProceduralUnitRuntime {
  private readonly actors = new Set<ProceduralUnitActor>();
  private readonly animationScheduler = new ProceduralCrowdUpdateScheduler<ProceduralUnitActor>();
  private disposed = false;

  private constructor(
    private readonly characterRuntime: ProceduralCharacterRuntime,
    private readonly horseRuntime: ProceduralHorseRuntime,
    private readonly physicsWorld: JoltRagdollWorld,
    private readonly meleeLibrary: ProceduralMeleeWeaponLibrary,
  ) {}

  public static async create(options: ProceduralCharacterRuntimeOptions = {}): Promise<ProceduralUnitRuntime> {
    const physicsWorld = await JoltRagdollWorld.create(
      resolveJoltWorldConfig(createDefaultProceduralCharacterConfig()),
    );
    const results = await Promise.allSettled([
      ProceduralCharacterRuntime.create({ ...options, physicsWorld }),
      ProceduralHorseRuntime.create(physicsWorld),
      ProceduralMeleeWeaponLibrary.create(),
    ] as const);
    const [characterResult, horseResult, meleeResult] = results;
    if (
      characterResult.status === "rejected" ||
      horseResult.status === "rejected" ||
      meleeResult.status === "rejected"
    ) {
      if (characterResult.status === "fulfilled") characterResult.value.dispose();
      if (horseResult.status === "fulfilled") horseResult.value.dispose();
      physicsWorld.dispose();
      if (characterResult.status === "rejected") throw characterResult.reason;
      if (horseResult.status === "rejected") throw horseResult.reason;
      if (meleeResult.status === "rejected") throw meleeResult.reason;
      throw new Error("Procedural unit runtime initialization failed");
    }
    return new ProceduralUnitRuntime(characterResult.value, horseResult.value, physicsWorld, meleeResult.value);
  }

  public createActor(config: ProceduralUnitConfig): ProceduralUnitActor {
    if (this.disposed) throw new Error("Cannot create a unit from a disposed procedural unit runtime");
    const normalized = applyProceduralUnitConfigPatch(config, {});
    const release = (actor: ProceduralUnitActor) => {
      this.animationScheduler.delete(actor);
      this.actors.delete(actor);
    };
    const actor = createUnitActor(this.characterRuntime, this.horseRuntime, this.meleeLibrary, normalized, release);
    this.actors.add(actor);
    this.animationScheduler.add(actor);
    return actor;
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    this.physicsWorld.update(deltaSeconds);
    this.animationScheduler.update(
      deltaSeconds,
      (actor) => actor.mode === "ragdoll",
      (actor, elapsedSeconds) => actor.update(elapsedSeconds),
    );
  }

  public setCrowdAnimationLaneCount(laneCount: number): void {
    this.animationScheduler.setLaneCount(laneCount);
  }

  public getCrowdAnimationStats() {
    return this.animationScheduler.getStats();
  }

  public updateActorConfig(actor: ProceduralUnitActor, config: ProceduralUnitConfig): void {
    if (this.disposed || !this.actors.has(actor)) return;
    const normalized = applyProceduralUnitConfigPatch(config, {});
    actor.updateConfig(normalized);
  }

  public updatePhysicsConfig(config: ProceduralCharacterConfig): void {
    if (this.disposed) return;
    this.physicsWorld.updateConfig(resolveJoltWorldConfig(config));
  }

  public stepOnce(): void {
    if (this.disposed) return;
    this.physicsWorld.stepOnce();
    this.actors.forEach((actor) => actor.stepOnce());
  }

  public getPhysicsStats() {
    return this.physicsWorld.getStats();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    [...this.actors].forEach((actor) => actor.dispose());
    this.actors.clear();
    this.animationScheduler.clear();
    this.characterRuntime.dispose();
    this.horseRuntime.dispose();
    this.physicsWorld.dispose();
  }
}

function createUnitActor(
  characterRuntime: ProceduralCharacterRuntime,
  horseRuntime: ProceduralHorseRuntime,
  meleeLibrary: ProceduralMeleeWeaponLibrary,
  config: ProceduralUnitConfig,
  release: (actor: ProceduralUnitActor) => void,
): ProceduralUnitActor {
  if (config.kind === "horse") {
    return new HorseUnitActor(horseRuntime.createActor(config.horse, config.humanoid), config, release);
  }
  if (config.kind === "paladin") {
    return new MountedUnitActor(
      horseRuntime.createActor(config.horse, config.humanoid),
      characterRuntime.createActor(resolveMountedRiderConfig(config)),
      config,
      meleeLibrary,
      release,
    );
  }
  return new HumanoidUnitActor(
    characterRuntime.createActor(resolveFootUnitCharacterConfig(config)),
    config,
    meleeLibrary,
    release,
  );
}

class HumanoidUnitActor implements ProceduralUnitActor {
  public readonly object: Group;
  private readonly equipment: ProceduralUnitEquipment;
  private readonly archer: ProceduralArcherController;
  private readonly melee: ProceduralMeleeController;
  private readonly rangedReleaseListeners = new Set<(event: ProceduralRangedReleaseEvent) => void>();
  private readonly meleeContactListeners = new Set<(event: ProceduralMeleeContactEvent) => void>();
  private readonly releaseOrigin = new Vector3();
  private readonly releaseDirection = new Vector3();
  private readonly releaseTarget = new Vector3();
  private readonly meleeContactOrigin = new Vector3();
  private readonly meleeTarget = new Vector3();
  private crossbowElapsedSeconds = 0;
  private rangedReleaseCount = 0;
  private archerPose?: ProceduralArcherUpperBodyPose;
  private meleePose?: ProceduralMeleeUpperBodyPose;
  private config: ProceduralUnitConfig;
  private disposed = false;

  public constructor(
    private readonly actor: ProceduralCharacterActor,
    config: ProceduralUnitConfig,
    meleeLibrary: ProceduralMeleeWeaponLibrary,
    private readonly release: (actor: ProceduralUnitActor) => void,
  ) {
    this.config = config;
    this.object = actor.object;
    this.archer = new ProceduralArcherController(config.archer, config.humanoid.seed);
    this.melee = new ProceduralMeleeController(config.melee, false);
    this.equipment = new ProceduralUnitEquipment(
      this.object,
      actor,
      config.kind,
      config.humanoid,
      config.melee,
      meleeLibrary,
    );
  }

  public get kind(): ProceduralUnitKind {
    return this.config.kind;
  }

  public get mode(): ProceduralCharacterMode {
    return this.actor.mode;
  }

  public update(deltaSeconds: number): void {
    this.updateAction(deltaSeconds);
    this.actor.update(deltaSeconds);
    this.updateEquipment();
    this.emitPendingRangedReleases();
    this.emitPendingMeleeContacts();
  }

  public stepOnce(): void {
    this.updateAction(this.config.humanoid.fixedStep);
    this.actor.stepOnce();
    this.updateEquipment();
    this.emitPendingRangedReleases();
    this.emitPendingMeleeContacts();
  }

  public updateConfig(config: ProceduralUnitConfig): void {
    const kindChanged = config.kind !== this.config.kind;
    if (kindChanged) this.crossbowElapsedSeconds = 0;
    this.config = config;
    this.archer.updateConfig(config.archer, config.humanoid.seed);
    this.melee.updateConfig(config.melee);
    if (kindChanged) this.actor.setUpperBodyAction(undefined);
    this.actor.updateConfig(resolveFootUnitCharacterConfig(config));
    if (config.kind !== "archer") this.clearArcherAction();
    if (!isMeleeUnitKind(config.kind)) this.clearMeleeAction();
    this.updateEquipment();
  }

  public startRagdoll(): Promise<void> {
    this.clearActionsForRagdoll();
    return this.actor.startRagdoll();
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    this.actor.applyReaction(reaction);
  }

  public applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    return this.actor.applyImpact(impact);
  }

  public applyImpulse(partId?: CharacterPartId): Promise<void> {
    return this.actor.applyImpulse(partId);
  }

  public reset(): void {
    this.archer.reset();
    this.melee.reset();
    this.archerPose = undefined;
    this.meleePose = undefined;
    this.crossbowElapsedSeconds = 0;
    this.rangedReleaseCount = 0;
    this.actor.setUpperBodyAction(undefined);
    this.equipment.reset();
    this.actor.reset();
    if (this.kind === "crossbowman") {
      this.actor.setUpperBodyAction(
        resolveProceduralCrossbowCarryPose(this.crossbowElapsedSeconds, this.config.humanoid.seed),
      );
      this.actor.update(0);
      this.updateEquipment();
    }
  }

  public fireRangedAttack(targetWorld: Readonly<Vector3>): boolean {
    return this.kind === "archer" && this.mode === "animated" && this.archer.fireAt(targetWorld);
  }

  public fireMeleeAttack(targetWorld: Readonly<Vector3>): boolean {
    return isMeleeUnitKind(this.kind) && this.mode === "animated" && this.melee.attack(targetWorld);
  }

  public attack(targetWorld: Readonly<Vector3>): boolean {
    return this.kind === "archer" ? this.fireRangedAttack(targetWorld) : this.fireMeleeAttack(targetWorld);
  }

  public setRangedTarget(targetWorld?: Readonly<Vector3>): void {
    this.archer.setTarget(targetWorld);
  }

  public cancelRangedAttack(): void {
    this.archer.cancel();
  }

  public setMeleeTarget(targetWorld?: Readonly<Vector3>): void {
    this.melee.setTarget(targetWorld);
  }

  public cancelMeleeAttack(): void {
    this.melee.cancel();
  }

  public onRangedRelease(listener: (event: ProceduralRangedReleaseEvent) => void): () => void {
    this.rangedReleaseListeners.add(listener);
    return () => this.rangedReleaseListeners.delete(listener);
  }

  public onMeleeContact(listener: (event: ProceduralMeleeContactEvent) => void): () => void {
    this.meleeContactListeners.add(listener);
    return () => this.meleeContactListeners.delete(listener);
  }

  public hasFiniteState(): boolean {
    return this.actor.hasFiniteState();
  }

  public getStats(): ProceduralUnitActorStats {
    const archer = this.archer.getStats();
    const bow = this.equipment.getArcherStats();
    const melee = this.melee.getStats();
    const meleeEquipment = this.equipment.getMeleeStats();
    return {
      ...this.actor.getStats(),
      kind: this.kind,
      maximumHorseBoneStretchRatio: 1,
      minimumBendAlignment: 1,
      meleeContactCount: melee.contactCount,
      meleeOffhandId: meleeEquipment.offhandId,
      meleeOffhandSource: meleeEquipment.offhandSource,
      meleePhase: melee.phase,
      meleeWeaponId: meleeEquipment.weaponId,
      meleeWeaponSource: meleeEquipment.weaponSource,
      previewArrowVisible: bow.previewArrowVisible,
      rangedPhase: archer.phase,
      rangedReleaseCount: this.rangedReleaseCount,
      stanceHoofCount: 0,
      stringContinuityError: bow.stringContinuityError,
    };
  }

  public getPoseDiagnostics(): ProceduralUnitPoseDiagnostics {
    return resolveProceduralUnitPoseDiagnostics({
      ...(this.kind === "archer" && { bow: this.equipment.getArcherPoseDiagnostics() }),
      ...(this.kind === "crossbowman" && { crossbow: this.equipment.getCrossbowPoseDiagnostics() }),
      humanoid: this.actor.getPoseDiagnostics(),
      kind: this.kind,
      ...(isMeleeUnitKind(this.kind) && { melee: this.equipment.getMeleePoseDiagnostics() }),
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rangedReleaseListeners.clear();
    this.meleeContactListeners.clear();
    this.equipment.dispose();
    this.actor.dispose();
    this.release(this);
  }

  private updateAction(deltaSeconds: number): void {
    if (this.mode === "ragdoll") {
      this.actor.setUpperBodyAction(undefined);
      return;
    }
    if (this.kind === "archer") {
      this.archerPose = this.archer.update(deltaSeconds, this.object);
      this.actor.setUpperBodyAction(this.archerPose.actionWeight > 1e-4 ? this.archerPose : undefined);
      return;
    }
    if (this.kind === "crossbowman") {
      this.crossbowElapsedSeconds += Math.min(Math.max(0, deltaSeconds), 0.1);
      this.actor.setUpperBodyAction(
        resolveProceduralCrossbowCarryPose(this.crossbowElapsedSeconds, this.config.humanoid.seed),
      );
      return;
    }
    if (isMeleeUnitKind(this.kind)) {
      this.meleePose = this.melee.update(deltaSeconds, this.object);
      this.actor.setUpperBodyAction(this.meleePose.actionWeight > 1e-4 ? this.meleePose : undefined);
      return;
    }
    this.actor.setUpperBodyAction(undefined);
  }

  private clearArcherAction(): void {
    this.archer.cancel();
    this.archerPose = undefined;
    this.actor.setUpperBodyAction(undefined);
    this.equipment.reset();
  }

  private clearMeleeAction(): void {
    this.melee.cancel();
    this.meleePose = undefined;
    this.actor.setUpperBodyAction(undefined);
  }

  private clearActionsForRagdoll(): void {
    this.archer.reset();
    this.melee.reset();
    this.archerPose = undefined;
    this.meleePose = undefined;
    this.actor.setUpperBodyAction(undefined);
    this.equipment.reset();
  }

  private updateEquipment(): void {
    this.equipment.update(
      this.kind,
      this.config.humanoid,
      this.config.melee,
      this.meleePose,
      this.config.archer,
      this.archerPose,
    );
  }

  private emitPendingRangedReleases(): void {
    let generation = this.archer.consumeReleaseGeneration();
    while (generation !== undefined) {
      const hasTransform = this.equipment.writeArcherReleaseTransform(this.releaseOrigin, this.releaseDirection);
      const hasTarget = this.archer.writeTarget(this.releaseTarget);
      if (hasTransform && hasTarget) {
        const event: ProceduralRangedReleaseEvent = {
          direction: this.releaseDirection.clone(),
          origin: this.releaseOrigin.clone(),
          seed: (this.config.humanoid.seed ^ generation) >>> 0,
          shotGeneration: generation,
          target: this.releaseTarget.clone(),
        };
        this.rangedReleaseCount += 1;
        this.rangedReleaseListeners.forEach((listener) => listener(event));
      }
      generation = this.archer.consumeReleaseGeneration();
    }
  }

  private emitPendingMeleeContacts(): void {
    emitPendingMeleeContacts({
      config: this.config,
      controller: this.melee,
      equipment: this.equipment,
      listeners: this.meleeContactListeners,
      origin: this.meleeContactOrigin,
      target: this.meleeTarget,
    });
  }
}

class HorseUnitActor implements ProceduralUnitActor {
  public readonly object: Group;
  private config: ProceduralUnitConfig;
  private disposed = false;

  public constructor(
    protected readonly horse: ProceduralHorseActor,
    config: ProceduralUnitConfig,
    private readonly release: (actor: ProceduralUnitActor) => void,
  ) {
    this.config = config;
    this.object = horse.object;
  }

  public get kind(): ProceduralUnitKind {
    return this.config.kind;
  }

  public get mode(): ProceduralCharacterMode {
    return this.horse.mode;
  }

  public update(deltaSeconds: number): void {
    this.horse.update(deltaSeconds);
  }

  public stepOnce(): void {
    this.horse.stepOnce();
  }

  public updateConfig(config: ProceduralUnitConfig): void {
    this.config = config;
    this.horse.updateConfig(config.horse, config.humanoid);
  }

  public startRagdoll(): Promise<void> {
    return this.horse.startRagdoll();
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    this.horse.applyReaction(reaction);
  }

  public applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    return this.horse.applyImpact({ ...impact, target: "mount" });
  }

  public applyImpulse(): Promise<void> {
    return this.horse.applyImpulse();
  }

  public attack(): boolean {
    return false;
  }

  public fireRangedAttack(): boolean {
    return false;
  }

  public fireMeleeAttack(): boolean {
    return false;
  }

  public setRangedTarget(): void {}

  public cancelRangedAttack(): void {}

  public setMeleeTarget(): void {}

  public cancelMeleeAttack(): void {}

  public onRangedRelease(): () => void {
    return () => undefined;
  }

  public onMeleeContact(): () => void {
    return () => undefined;
  }

  public reset(): void {
    this.horse.reset();
  }

  public hasFiniteState(): boolean {
    return this.horse.hasFiniteState();
  }

  public getStats(): ProceduralUnitActorStats {
    const horse = this.horse.getStats();
    const physics = this.horse.getPhysicsStats();
    return {
      ...EMPTY_UNIT_STATS,
      ...physics,
      assetLabel: horse.assetLabel,
      authoredClipCount: horse.authoredClipCount,
      boneCount: horse.boneCount,
      kind: this.kind,
      maximumHorseBoneStretchRatio: horse.maximumBoneStretchRatio,
      minimumBendAlignment: horse.minimumBendAlignment,
      skinnedMeshCount: horse.skinnedMeshCount,
      stanceHoofCount: horse.stanceHoofCount,
    };
  }

  public getPoseDiagnostics(): ProceduralUnitPoseDiagnostics {
    return resolveProceduralUnitPoseDiagnostics({ horse: this.horse.getPoseDiagnostics(), kind: this.kind });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.horse.dispose();
    this.release(this);
  }
}

class MountedUnitActor implements ProceduralUnitActor {
  public readonly object = new Group();
  private readonly equipment: ProceduralUnitEquipment;
  private readonly melee: ProceduralMeleeController;
  private readonly meleeContactListeners = new Set<(event: ProceduralMeleeContactEvent) => void>();
  private config: ProceduralUnitConfig;
  private disposed = false;
  private meleePose?: ProceduralMeleeUpperBodyPose;
  private readonly saddleQuaternion = new Quaternion();
  private readonly riderPelvisOffset = new Vector3();
  private readonly riderTargetPosition = new Vector3();
  private readonly meleeContactOrigin = new Vector3();
  private readonly meleeTarget = new Vector3();

  public constructor(
    private readonly horse: ProceduralHorseActor,
    private readonly rider: ProceduralCharacterActor,
    config: ProceduralUnitConfig,
    meleeLibrary: ProceduralMeleeWeaponLibrary,
    private readonly release: (actor: ProceduralUnitActor) => void,
  ) {
    this.config = config;
    this.object.name = "procedural-mounted-unit";
    this.object.add(horse.object, rider.object);
    rider.object.scale.setScalar(0.84);
    this.melee = new ProceduralMeleeController(config.melee, true);
    this.equipment = new ProceduralUnitEquipment(
      rider.object,
      rider,
      "paladin",
      config.humanoid,
      config.melee,
      meleeLibrary,
    );
    this.syncRiderToSaddle(0, true);
    this.updateEquipment();
  }

  public get kind(): ProceduralUnitKind {
    return "paladin";
  }

  public get mode(): ProceduralCharacterMode {
    return this.horse.mode === "ragdoll" || this.rider.mode === "ragdoll" ? "ragdoll" : "animated";
  }

  public update(deltaSeconds: number): void {
    this.horse.update(deltaSeconds);
    this.syncRiderToSaddle(deltaSeconds);
    this.updateMelee(deltaSeconds);
    this.rider.update(deltaSeconds, this.horse.getPose().phase);
    this.syncRiderToSaddle(deltaSeconds);
    this.updateEquipment();
    this.emitPendingMeleeContacts();
  }

  public stepOnce(): void {
    this.horse.stepOnce();
    this.syncRiderToSaddle(this.config.humanoid.fixedStep);
    this.updateMelee(this.config.humanoid.fixedStep);
    this.rider.stepOnce(this.horse.getPose().phase);
    this.syncRiderToSaddle(this.config.humanoid.fixedStep);
    this.updateEquipment();
    this.emitPendingMeleeContacts();
  }

  public updateConfig(config: ProceduralUnitConfig): void {
    this.config = config;
    this.melee.updateConfig(config.melee);
    this.horse.updateConfig(config.horse, config.humanoid);
    this.rider.updateConfig(resolveMountedRiderConfig(config));
    this.syncRiderToSaddle(config.humanoid.fixedStep);
    this.updateEquipment();
  }

  public async startRagdoll(): Promise<void> {
    this.melee.reset();
    this.meleePose = undefined;
    this.rider.setUpperBodyAction(undefined);
    await Promise.all([this.horse.startRagdoll(), this.rider.startRagdoll()]);
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    this.horse.applyReaction(reaction);
    this.rider.applyReaction(reaction);
  }

  public async applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    const passiveImpact = { ...impact, strength: 0 };
    if (impact.target === "mount") {
      await Promise.all([this.horse.applyImpact(impact), this.rider.applyImpact(passiveImpact)]);
      return;
    }
    await Promise.all([this.horse.applyImpact(passiveImpact), this.rider.applyImpact(impact)]);
  }

  public async applyImpulse(partId?: CharacterPartId): Promise<void> {
    await this.startRagdoll();
    await Promise.all([this.horse.applyImpulse(), this.rider.applyImpulse(partId)]);
  }

  public fireRangedAttack(): boolean {
    return false;
  }

  public fireMeleeAttack(targetWorld: Readonly<Vector3>): boolean {
    return this.mode === "animated" && this.melee.attack(targetWorld);
  }

  public attack(targetWorld: Readonly<Vector3>): boolean {
    return this.fireMeleeAttack(targetWorld);
  }

  public setRangedTarget(): void {}

  public cancelRangedAttack(): void {}

  public setMeleeTarget(targetWorld?: Readonly<Vector3>): void {
    this.melee.setTarget(targetWorld);
  }

  public cancelMeleeAttack(): void {
    this.melee.cancel();
  }

  public onRangedRelease(): () => void {
    return () => undefined;
  }

  public onMeleeContact(listener: (event: ProceduralMeleeContactEvent) => void): () => void {
    this.meleeContactListeners.add(listener);
    return () => this.meleeContactListeners.delete(listener);
  }

  public reset(): void {
    this.horse.reset();
    this.melee.reset();
    this.meleePose = undefined;
    this.rider.reset();
    this.syncRiderToSaddle(0, true);
    this.updateEquipment();
  }

  public hasFiniteState(): boolean {
    return this.horse.hasFiniteState() && this.rider.hasFiniteState();
  }

  public getStats(): ProceduralUnitActorStats {
    const horse = this.horse.getStats();
    const horsePhysics = this.horse.getPhysicsStats();
    const rider = this.rider.getStats();
    const melee = this.melee.getStats();
    const meleeEquipment = this.equipment.getMeleeStats();
    return {
      ...rider,
      activeBodyCount: horsePhysics.activeBodyCount + rider.activeBodyCount,
      assetLabel: `${horse.assetLabel} + ${rider.assetLabel}`,
      authoredClipCount: horse.authoredClipCount + rider.authoredClipCount,
      boneCount: horse.boneCount + rider.boneCount,
      bodyCount: horsePhysics.bodyCount + rider.bodyCount,
      constraintCount: horsePhysics.constraintCount + rider.constraintCount,
      kind: "paladin",
      maximumHorseBoneStretchRatio: horse.maximumBoneStretchRatio,
      minimumBendAlignment: horse.minimumBendAlignment,
      meleeContactCount: melee.contactCount,
      meleeOffhandId: meleeEquipment.offhandId,
      meleeOffhandSource: meleeEquipment.offhandSource,
      meleePhase: melee.phase,
      meleeWeaponId: meleeEquipment.weaponId,
      meleeWeaponSource: meleeEquipment.weaponSource,
      previewArrowVisible: false,
      rangedPhase: "idle",
      rangedReleaseCount: 0,
      skinnedMeshCount: horse.skinnedMeshCount + rider.skinnedMeshCount,
      stanceHoofCount: horse.stanceHoofCount,
      stringContinuityError: 0,
      wasmHeapBytes: Math.max(horsePhysics.wasmHeapBytes, rider.wasmHeapBytes),
    };
  }

  public getPoseDiagnostics(): ProceduralUnitPoseDiagnostics {
    return resolveProceduralUnitPoseDiagnostics({
      horse: this.horse.getPoseDiagnostics(),
      humanoid: this.rider.getPoseDiagnostics(),
      kind: "paladin",
      melee: this.equipment.getMeleePoseDiagnostics(),
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.meleeContactListeners.clear();
    this.equipment.dispose();
    this.horse.dispose();
    this.rider.dispose();
    this.object.clear();
    this.object.removeFromParent();
    this.release(this);
  }

  private syncRiderToSaddle(deltaSeconds: number, snap = false): void {
    if (this.mode === "ragdoll") return;
    const saddle = this.horse.getPose();
    this.saddleQuaternion.fromArray(saddle.saddleRotation);
    this.riderPelvisOffset.set(0, 1.12 * this.rider.object.scale.y, -0.04 * this.rider.object.scale.z);
    this.riderPelvisOffset.applyQuaternion(this.saddleQuaternion);
    this.riderTargetPosition.fromArray(saddle.saddlePosition).sub(this.riderPelvisOffset);
    if (snap) {
      this.rider.object.position.copy(this.riderTargetPosition);
      this.rider.object.quaternion.copy(this.saddleQuaternion);
      return;
    }
    const response = this.config.humanoid.secondaryMotion;
    const positionBlend = 1 - Math.exp(-(24 - response * 6) * Math.max(0, deltaSeconds));
    const rotationBlend = 1 - Math.exp(-(16 - response * 4) * Math.max(0, deltaSeconds));
    this.rider.object.position.lerp(this.riderTargetPosition, positionBlend);
    this.rider.object.quaternion.slerp(this.saddleQuaternion, rotationBlend);
  }

  private updateMelee(deltaSeconds: number): void {
    if (this.mode === "ragdoll") {
      this.rider.setUpperBodyAction(undefined);
      return;
    }
    this.meleePose = this.melee.update(deltaSeconds, this.rider.object);
    this.rider.setUpperBodyAction(this.meleePose.actionWeight > 1e-4 ? this.meleePose : undefined);
  }

  private updateEquipment(): void {
    this.equipment.update("paladin", this.config.humanoid, this.config.melee, this.meleePose);
  }

  private emitPendingMeleeContacts(): void {
    emitPendingMeleeContacts({
      config: this.config,
      controller: this.melee,
      equipment: this.equipment,
      listeners: this.meleeContactListeners,
      origin: this.meleeContactOrigin,
      target: this.meleeTarget,
    });
  }
}

function emitPendingMeleeContacts(input: {
  config: ProceduralUnitConfig;
  controller: ProceduralMeleeController;
  equipment: ProceduralUnitEquipment;
  listeners: ReadonlySet<(event: ProceduralMeleeContactEvent) => void>;
  origin: Vector3;
  target: Vector3;
}): void {
  let generation = input.controller.consumeContactGeneration();
  while (generation !== undefined) {
    const hasOrigin = input.equipment.writeMeleeWeaponTipWorldPosition(input.origin);
    const hasTarget = input.controller.writeTarget(input.target);
    if (hasOrigin && hasTarget) {
      const direction = input.target.clone().sub(input.origin);
      if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
      else direction.normalize();
      const event: ProceduralMeleeContactEvent = {
        attackGeneration: generation,
        direction,
        impactStrength: input.config.melee.impactStrength,
        origin: input.origin.clone(),
        target: input.target.clone(),
        weaponId: input.config.melee.weaponId,
      };
      input.listeners.forEach((listener) => listener(event));
    }
    generation = input.controller.consumeContactGeneration();
  }
}

function resolveMountedRiderConfig(config: ProceduralUnitConfig): ProceduralCharacterConfig {
  return {
    ...config.humanoid,
    animationMode: "mounted",
    animationSpeed: Math.max(0.1, resolveHorseGaitCadence(config.horse)),
  };
}

function resolveFootUnitCharacterConfig(config: ProceduralUnitConfig): ProceduralCharacterConfig {
  const isRanged = config.kind === "archer" || config.kind === "crossbowman";
  const equipmentSwingScale = isRanged ? 0.28 : config.kind === "knight" ? 0.62 : 1;
  return {
    ...config.humanoid,
    armSwing: config.humanoid.armSwing * equipmentSwingScale,
    secondaryMotion: config.humanoid.secondaryMotion * (isRanged ? 0.72 : 0.86),
  };
}

function isMeleeUnitKind(kind: ProceduralUnitKind): kind is "knight" | "paladin" {
  return kind === "knight" || kind === "paladin";
}

const EMPTY_UNIT_STATS: ProceduralUnitActorStats = {
  activeBodyCount: 0,
  assetId: "base",
  assetLabel: "",
  authoredClipCount: 0,
  bodyCount: 0,
  boneCount: 0,
  constraintCount: 0,
  kind: "horse",
  leftGripProfile: "open",
  leftPalmInwardDot: 1,
  maximumHorseBoneStretchRatio: 1,
  minimumBendAlignment: 1,
  meleeContactCount: 0,
  meleeOffhandId: "round-shield",
  meleeOffhandSource: "procedural",
  meleePhase: "idle",
  meleeWeaponId: "iron-longsword",
  meleeWeaponSource: "procedural",
  mode: "animated",
  physicsSteps: 0,
  previewArrowVisible: false,
  rangedPhase: "idle",
  rangedReleaseCount: 0,
  rightGripProfile: "open",
  rightPalmInwardDot: 1,
  skinnedMeshCount: 0,
  stanceFootCount: 0,
  stanceHoofCount: 0,
  stringContinuityError: 0,
  wasmHeapBytes: 0,
};
