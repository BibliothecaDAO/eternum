import { type Group, Quaternion, Vector3 } from "three";

import type { JoltCharacterRagdoll, JoltRagdollStats } from "./jolt-character-ragdoll";
import type { JoltRagdollWorld } from "./jolt-ragdoll-world";
import { applyProceduralCharacterConfigPatch, type ProceduralCharacterConfig } from "./procedural-character-config";
import type { ProceduralCharacterUpperBodyAction } from "./procedural-character-action";
import {
  advanceProceduralCharacterGaitPhase,
  resolveInitialProceduralCharacterPhase,
  resolveProceduralCharacterStrideLength,
  type CharacterFootId,
} from "./procedural-character-gait";
import { ProceduralCharacterAvatar, type ProceduralCharacterAvatarStats } from "./procedural-character-avatar";
import {
  resolveProceduralCharacterPoseDiagnostics,
  type ProceduralCharacterPoseDiagnostics,
} from "./procedural-character-diagnostics";
import {
  isProceduralCharacterPoseFinite,
  resolveProceduralCharacterPose,
  type ProceduralCharacterPose,
} from "./procedural-character-pose";
import { ProceduralCharacterPoseFilter } from "./procedural-character-pose-filter";
import {
  applyCharacterRigLimbLengths,
  resolveCharacterRig,
  type CharacterPartId,
  type ResolvedCharacterRig,
} from "./procedural-character-rig";
import { ProceduralPlantController } from "./procedural-plant-controller";
import type { CharacterSocketId, ProceduralCharacterSocketReader } from "./procedural-character-sockets";
import { wrapUnitPhase } from "./procedural-motion-curves";
import { loadQuaterniusCharacterLibrary, QuaterniusCharacterLibrary } from "./quaternius-character-assets";

export type ProceduralCharacterMode = "animated" | "ragdoll";

export interface ProceduralCharacterRuntimeOptions {
  physicsWorld?: JoltRagdollWorld;
  preloadPhysics?: boolean;
}

export interface ProceduralCharacterActorStats extends ProceduralCharacterAvatarStats {
  activeBodyCount: number;
  bodyCount: number;
  constraintCount: number;
  mode: ProceduralCharacterMode;
  physicsSteps: number;
  stanceFootCount: number;
  wasmHeapBytes: number;
}

export interface ProceduralCharacterActor extends ProceduralCharacterSocketReader {
  readonly mode: ProceduralCharacterMode;
  readonly object: Group;

  applyImpulse(partId?: CharacterPartId): Promise<void>;
  dispose(): void;
  getPoseDiagnostics(): ProceduralCharacterPoseDiagnostics;
  getStats(): ProceduralCharacterActorStats;
  hasFiniteState(): boolean;
  reset(): void;
  setUpperBodyAction(action?: ProceduralCharacterUpperBodyAction): void;
  startRagdoll(): Promise<void>;
  stepOnce(phaseOverride?: number): void;
  update(deltaSeconds: number, phaseOverride?: number): number;
  updateConfig(config: ProceduralCharacterConfig): void;
}

/**
 * Production character entry point shared by game scenes and the animation
 * gym. The runtime owns decoded assets; every actor owns its pose, materials,
 * skeletons, and optional Jolt ragdoll.
 */
export class ProceduralCharacterRuntime {
  private readonly actors = new Set<RuntimeProceduralCharacterActor>();
  private disposed = false;

  private constructor(
    private readonly library: QuaterniusCharacterLibrary,
    private readonly physicsWorld?: JoltRagdollWorld,
  ) {}

  public static async create(options: ProceduralCharacterRuntimeOptions = {}): Promise<ProceduralCharacterRuntime> {
    const library = await loadQuaterniusCharacterLibrary();
    try {
      if (options.preloadPhysics) await preloadProceduralCharacterPhysics();
      return new ProceduralCharacterRuntime(library, options.physicsWorld);
    } catch (error) {
      library.dispose();
      throw error;
    }
  }

  public createActor(config: ProceduralCharacterConfig): ProceduralCharacterActor {
    if (this.disposed) throw new Error("Cannot create an actor from a disposed procedural character runtime");
    const actor = new RuntimeProceduralCharacterActor(
      this.library.instantiate(),
      config,
      this.physicsWorld,
      (disposedActor) => {
        this.actors.delete(disposedActor);
      },
    );
    this.actors.add(actor);
    return actor;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    [...this.actors].forEach((actor) => actor.dispose());
    this.actors.clear();
    this.library.dispose();
  }
}

class RuntimeProceduralCharacterActor implements ProceduralCharacterActor {
  public readonly object: Group;

  private readonly avatar: ProceduralCharacterAvatar;
  private ragdoll?: JoltCharacterRagdoll;
  private ragdollStartPromise?: Promise<void>;
  private ragdollGeneration = 0;
  private rig: ResolvedCharacterRig;
  private pose: ProceduralCharacterPose;
  private config: ProceduralCharacterConfig;
  private readonly plantController = new ProceduralPlantController<CharacterFootId>();
  private readonly poseFilter = new ProceduralCharacterPoseFilter();
  private gaitPhase: number;
  private readonly scratchRagdollPosition = new Vector3();
  private readonly scratchRagdollQuaternion = new Quaternion();
  private readonly scratchInverseWorldQuaternion = new Quaternion();
  private readonly diagnosticHandLeft = new Vector3();
  private readonly diagnosticHandRight = new Vector3();
  private readonly diagnosticGripLeft = new Vector3();
  private readonly diagnosticGripRight = new Vector3();
  private readonly diagnosticDrawRight = new Vector3();
  private readonly diagnosticJawAnchor = new Vector3();
  private readonly diagnosticSocketQuaternion = new Quaternion();
  private elapsedSeconds = 0;
  private upperBodyAction?: ProceduralCharacterUpperBodyAction;
  private physicsSteps = 0;
  private disposed = false;

  public constructor(
    assets: ConstructorParameters<typeof ProceduralCharacterAvatar>[0],
    config: ProceduralCharacterConfig,
    private readonly physicsWorld: JoltRagdollWorld | undefined,
    private readonly release: (actor: RuntimeProceduralCharacterActor) => void,
  ) {
    this.config = applyProceduralCharacterConfigPatch(config, {});
    this.rig = resolveCharacterRig(this.config);
    this.gaitPhase = resolveInitialProceduralCharacterPhase(this.config.seed);
    this.avatar = new ProceduralCharacterAvatar(assets, this.rig, this.config);
    this.calibrateRigToActiveAvatar();
    this.object = this.avatar.group;
    this.plantController.beginFrame(this.object);
    this.pose = this.poseFilter.apply(
      resolveProceduralCharacterPose(this.rig, this.config, 0, this.plantController.resolveTarget, this.gaitPhase),
      0,
      this.config.secondaryMotion,
    );
    this.avatar.applyPose(this.pose);
  }

  public get mode(): ProceduralCharacterMode {
    return this.ragdoll ? "ragdoll" : "animated";
  }

  public update(deltaSeconds: number, phaseOverride?: number): number {
    if (this.disposed) return 0;
    if (!this.ragdoll) {
      const elapsed = resolveDeltaSeconds(deltaSeconds);
      this.elapsedSeconds += elapsed;
      this.advanceAnimatedPose(elapsed, phaseOverride);
      this.physicsSteps = 0;
      return 0;
    }

    this.physicsSteps = this.ragdoll.update(deltaSeconds);
    this.syncRagdollToAvatar();
    return this.physicsSteps;
  }

  public stepOnce(phaseOverride?: number): void {
    if (this.disposed) return;
    if (!this.ragdoll) {
      this.elapsedSeconds += this.config.fixedStep;
      this.advanceAnimatedPose(this.config.fixedStep, phaseOverride);
      return;
    }
    this.ragdoll.stepOnce();
    this.physicsSteps = 1;
    this.syncRagdollToAvatar();
  }

  public updateConfig(config: ProceduralCharacterConfig): void {
    if (this.disposed) return;
    const normalized = applyProceduralCharacterConfigPatch(this.config, config);
    const requiresRigRebuild = normalized.seed !== this.config.seed || normalized.tier !== this.config.tier;
    const requiresPlantReset = requiresRigRebuild || normalized.animationMode !== this.config.animationMode;
    this.config = normalized;
    if (requiresPlantReset) {
      this.plantController.reset();
      this.poseFilter.reset();
      this.gaitPhase = resolveInitialProceduralCharacterPhase(normalized.seed);
    }

    if (requiresRigRebuild) {
      this.resetRagdoll();
      this.rig = resolveCharacterRig(normalized);
      this.avatar.rebuild(this.rig, normalized);
      this.calibrateRigToActiveAvatar();
      this.applyAnimatedPose();
      return;
    }

    this.avatar.updateConfig(normalized);
    this.ragdoll?.updateConfig(normalized);
    if (!this.ragdoll) this.applyAnimatedPose();
  }

  public setUpperBodyAction(action?: ProceduralCharacterUpperBodyAction): void {
    this.upperBodyAction = action;
    this.avatar.setUpperBodyAction(action);
  }

  public writeSocketWorldTransform(
    socketId: CharacterSocketId,
    outPosition: Vector3,
    outQuaternion: Quaternion,
  ): boolean {
    return this.avatar.writeSocketWorldTransform(socketId, outPosition, outQuaternion);
  }

  public async startRagdoll(): Promise<void> {
    if (this.disposed || this.ragdoll) return;
    if (this.ragdollStartPromise) return this.ragdollStartPromise;

    const generation = this.ragdollGeneration;
    this.ragdollStartPromise = createProceduralCharacterRagdoll(
      this.rig,
      this.pose,
      this.config,
      this.physicsWorld,
      this.object,
    )
      .then((ragdoll) => {
        if (this.disposed || generation !== this.ragdollGeneration) {
          ragdoll.dispose();
          return;
        }
        this.ragdoll = ragdoll;
        ragdoll.updateConfig(this.config);
        this.syncRagdollToAvatar();
      })
      .finally(() => {
        this.ragdollStartPromise = undefined;
      });
    return this.ragdollStartPromise;
  }

  public async applyImpulse(partId: CharacterPartId = "chest"): Promise<void> {
    await this.startRagdoll();
    this.ragdoll?.applyConfiguredImpulse(partId);
  }

  public reset(): void {
    if (this.disposed) return;
    this.resetRagdoll();
    this.plantController.reset();
    this.poseFilter.reset();
    this.gaitPhase = resolveInitialProceduralCharacterPhase(this.config.seed);
    this.elapsedSeconds = 0;
    this.upperBodyAction = undefined;
    this.avatar.setUpperBodyAction(undefined);
    this.applyAnimatedPose();
  }

  public hasFiniteState(): boolean {
    return (
      isProceduralCharacterPoseFinite(this.pose) &&
      this.avatar.hasFiniteTransforms() &&
      (this.ragdoll?.hasFiniteTransforms() ?? true)
    );
  }

  public getStats(): ProceduralCharacterActorStats {
    const avatar = this.avatar.getStats();
    const physics = this.ragdoll?.getStats() ?? EMPTY_RAGDOLL_STATS;
    return {
      ...avatar,
      activeBodyCount: physics.activeBodyCount,
      bodyCount: physics.bodyCount,
      constraintCount: physics.constraintCount,
      mode: this.mode,
      physicsSteps: this.physicsSteps,
      stanceFootCount: Object.values(this.pose.feet).filter(({ cycle }) => cycle.contact === "stance").length,
      wasmHeapBytes: physics.wasmHeapBytes,
    };
  }

  public getPoseDiagnostics(): ProceduralCharacterPoseDiagnostics {
    const avatar = this.avatar.getStats();
    const sockets = {
      ...(this.avatar.writeSocketWorldTransform(
        "drawRight",
        this.diagnosticDrawRight,
        this.diagnosticSocketQuaternion,
      ) && { drawRight: this.diagnosticDrawRight }),
      ...(this.avatar.writeSocketWorldTransform(
        "gripLeft",
        this.diagnosticGripLeft,
        this.diagnosticSocketQuaternion,
      ) && { gripLeft: this.diagnosticGripLeft }),
      ...(this.avatar.writeSocketWorldTransform(
        "gripRight",
        this.diagnosticGripRight,
        this.diagnosticSocketQuaternion,
      ) && { gripRight: this.diagnosticGripRight }),
      ...(this.avatar.writeSocketWorldTransform(
        "handLeft",
        this.diagnosticHandLeft,
        this.diagnosticSocketQuaternion,
      ) && { handLeft: this.diagnosticHandLeft }),
      ...(this.avatar.writeSocketWorldTransform(
        "handRight",
        this.diagnosticHandRight,
        this.diagnosticSocketQuaternion,
      ) && { handRight: this.diagnosticHandRight }),
      ...(this.avatar.writeSocketWorldTransform(
        "jawAnchor",
        this.diagnosticJawAnchor,
        this.diagnosticSocketQuaternion,
      ) && { jawAnchor: this.diagnosticJawAnchor }),
      joints: this.avatar.readWorldDiagnosticJoints(),
    };
    return resolveProceduralCharacterPoseDiagnostics({
      leftPalmInwardDot: avatar.leftPalmInwardDot,
      pose: this.pose,
      rig: this.rig,
      rightPalmInwardDot: avatar.rightPalmInwardDot,
      root: this.object,
      sockets,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetRagdoll();
    this.avatar.dispose();
    this.release(this);
  }

  private advanceAnimatedPose(deltaSeconds: number, phaseOverride?: number): void {
    this.plantController.beginFrame(this.object);
    this.gaitPhase = Number.isFinite(phaseOverride)
      ? wrapUnitPhase(phaseOverride ?? 0)
      : advanceProceduralCharacterGaitPhase(
          this.gaitPhase,
          this.config,
          deltaSeconds,
          this.plantController.getFrameTravelDistance(),
          resolveProceduralCharacterStrideLength(this.config, this.rig.morphology.scale),
        );
    this.applyAnimatedPose(false, deltaSeconds);
  }

  private calibrateRigToActiveAvatar(): void {
    this.rig = applyCharacterRigLimbLengths(this.rig, this.avatar.measureActiveLimbLengths());
    this.avatar.rebuild(this.rig, this.config);
  }

  private applyAnimatedPose(beginPlantFrame = true, deltaSeconds = this.config.fixedStep): void {
    if (beginPlantFrame) this.plantController.beginFrame(this.object);
    this.pose = this.poseFilter.apply(
      resolveProceduralCharacterPose(
        this.rig,
        this.config,
        this.elapsedSeconds,
        this.plantController.resolveTarget,
        this.gaitPhase,
        this.upperBodyAction,
      ),
      deltaSeconds,
      this.config.secondaryMotion,
    );
    this.avatar.applyPose(this.pose);
  }

  private resetRagdoll(): void {
    this.ragdollGeneration += 1;
    this.ragdoll?.dispose();
    this.ragdoll = undefined;
    this.physicsSteps = 0;
  }

  private syncRagdollToAvatar(): void {
    this.object.updateWorldMatrix(true, false);
    this.object.getWorldQuaternion(this.scratchInverseWorldQuaternion).invert();
    this.ragdoll?.writePartTransforms((partId, ...values) => {
      const [x, y, z, qx, qy, qz, qw] = values;
      this.scratchRagdollPosition.set(x, y, z);
      this.object.worldToLocal(this.scratchRagdollPosition);
      this.scratchRagdollQuaternion.set(qx, qy, qz, qw).premultiply(this.scratchInverseWorldQuaternion).normalize();
      this.avatar.setPartTransformValues(
        partId,
        this.scratchRagdollPosition.x,
        this.scratchRagdollPosition.y,
        this.scratchRagdollPosition.z,
        this.scratchRagdollQuaternion.x,
        this.scratchRagdollQuaternion.y,
        this.scratchRagdollQuaternion.z,
        this.scratchRagdollQuaternion.w,
      );
    });
  }
}

const EMPTY_RAGDOLL_STATS: JoltRagdollStats = {
  activeBodyCount: 0,
  bodyCount: 0,
  constraintCount: 0,
  wasmHeapBytes: 0,
};

function resolveDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(0, value), 0.1) : 0;
}

async function preloadProceduralCharacterPhysics(): Promise<void> {
  const { preloadJoltCharacterPhysics } = await import("./jolt-character-ragdoll");
  await preloadJoltCharacterPhysics();
}

async function createProceduralCharacterRagdoll(
  rig: ResolvedCharacterRig,
  pose: ProceduralCharacterPose,
  config: ProceduralCharacterConfig,
  physicsWorld?: JoltRagdollWorld,
  coordinateSpace?: Group,
): Promise<JoltCharacterRagdoll> {
  const { JoltCharacterRagdoll } = await import("./jolt-character-ragdoll");
  return JoltCharacterRagdoll.create(rig, pose, config, physicsWorld, coordinateSpace);
}
