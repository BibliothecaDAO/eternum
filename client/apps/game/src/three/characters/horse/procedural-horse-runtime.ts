import { type Group, Quaternion, Vector3 } from "three";

import type { ProceduralCharacterConfig } from "../procedural-character-config";
import type { JoltRagdollStats } from "../jolt-ragdoll-world";
import type { JoltRagdollWorld } from "../jolt-ragdoll-world";
import { ProceduralPlantController } from "../procedural-plant-controller";
import {
  ProceduralHorseAvatar,
  type ProceduralHorseAvatarStats,
  type ProceduralHorsePhysicsPose,
} from "./procedural-horse-avatar";
import { applyProceduralHorseConfigPatch, type ProceduralHorseConfig } from "./procedural-horse-config";
import {
  resolveProceduralHorsePoseDiagnostics,
  type ProceduralHorsePoseDiagnostics,
} from "./procedural-horse-diagnostics";
import { advanceHorseGaitPhase, resolveInitialHorseGaitPhase, type HorseHoofId } from "./procedural-horse-gait";
import {
  isProceduralHorsePoseFinite,
  resolveProceduralHorsePose,
  type HorseGroundSampler,
  type ProceduralHorsePose,
} from "./procedural-horse-pose";
import { ProceduralHorsePoseFilter } from "./procedural-horse-pose-filter";
import { QuaterniusHorseLibrary } from "./quaternius-horse-assets";
import { HORSE_RAGDOLL_BODY_IDS, JoltHorseRagdoll, type HorseRagdollPartId } from "./jolt-horse-ragdoll";
import { HORSE_LEG_SEGMENT_IDS, type HorseLegSegmentId } from "./procedural-horse-rig";

export interface ProceduralHorseActor {
  readonly mode: "animated" | "ragdoll";
  readonly object: Group;

  applyImpulse(): Promise<void>;
  dispose(): void;
  getPhysicsStats(): JoltRagdollStats;
  getPose(): ProceduralHorsePose;
  getPoseDiagnostics(): ProceduralHorsePoseDiagnostics;
  getStats(): ProceduralHorseAvatarStats;
  hasFiniteState(): boolean;
  reset(): void;
  setGroundSampler(sampleGround?: HorseGroundSampler): void;
  startRagdoll(): Promise<void>;
  stepOnce(): void;
  update(deltaSeconds: number): void;
  updateConfig(config: ProceduralHorseConfig, physicsConfig?: ProceduralCharacterConfig): void;
}

export class ProceduralHorseRuntime {
  private readonly actors = new Set<RuntimeProceduralHorseActor>();
  private disposed = false;

  private constructor(
    private readonly library: QuaterniusHorseLibrary,
    private readonly physicsWorld?: JoltRagdollWorld,
  ) {}

  public static async create(physicsWorld?: JoltRagdollWorld): Promise<ProceduralHorseRuntime> {
    return new ProceduralHorseRuntime(await QuaterniusHorseLibrary.load(), physicsWorld);
  }

  public createActor(config: ProceduralHorseConfig, physicsConfig: ProceduralCharacterConfig): ProceduralHorseActor {
    if (this.disposed) throw new Error("Cannot create a horse from a disposed procedural horse runtime");
    const actor = new RuntimeProceduralHorseActor(
      this.library.instantiate(),
      config,
      physicsConfig,
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

class RuntimeProceduralHorseActor implements ProceduralHorseActor {
  public readonly object: Group;

  private readonly avatar: ProceduralHorseAvatar;
  private config: ProceduralHorseConfig;
  private physicsConfig: ProceduralCharacterConfig;
  private pose: ProceduralHorsePose;
  private ragdoll?: JoltHorseRagdoll;
  private phase: number;
  private elapsedSeconds = 0;
  private sampleGround?: HorseGroundSampler;
  private readonly plantController = new ProceduralPlantController<HorseHoofId>();
  private readonly poseFilter = new ProceduralHorsePoseFilter();
  private readonly scratchWorldPosition = new Vector3();
  private readonly scratchLocalPosition = new Vector3();
  private readonly scratchWorldQuaternion = new Quaternion();
  private readonly scratchLocalQuaternion = new Quaternion();
  private readonly scratchInverseWorldQuaternion = new Quaternion();
  private disposed = false;

  public constructor(
    asset: ConstructorParameters<typeof ProceduralHorseAvatar>[0],
    config: ProceduralHorseConfig,
    physicsConfig: ProceduralCharacterConfig,
    private readonly physicsWorld: JoltRagdollWorld | undefined,
    private readonly release: (actor: RuntimeProceduralHorseActor) => void,
  ) {
    this.config = applyProceduralHorseConfigPatch(config, {});
    this.phase = resolveInitialHorseGaitPhase(this.config.seed);
    this.physicsConfig = physicsConfig;
    this.avatar = new ProceduralHorseAvatar(asset, this.config);
    this.object = this.avatar.group;
    this.plantController.beginFrame(this.object);
    this.pose = this.poseFilter.apply(
      resolveProceduralHorsePose(
        this.avatar.rig,
        this.config,
        this.phase,
        this.elapsedSeconds,
        this.sampleGround,
        this.plantController.resolveTarget,
      ),
      0,
      this.config.secondaryMotion,
    );
    this.avatar.applyPose(this.pose);
  }

  public get mode(): "animated" | "ragdoll" {
    return this.ragdoll ? "ragdoll" : "animated";
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    if (this.ragdoll) {
      this.syncRagdollToAvatar();
      return;
    }
    const elapsed = resolveDeltaSeconds(deltaSeconds);
    this.elapsedSeconds += elapsed;
    this.plantController.beginFrame(this.object);
    this.phase = advanceHorseGaitPhase(this.phase, this.config, elapsed, this.plantController.getFrameTravelDistance());
    this.applyPose(false, elapsed);
  }

  public stepOnce(): void {
    this.update(1 / 60);
  }

  public updateConfig(
    config: ProceduralHorseConfig,
    physicsConfig: ProceduralCharacterConfig = this.physicsConfig,
  ): void {
    if (this.disposed) return;
    const normalized = applyProceduralHorseConfigPatch(this.config, config);
    const gaitChanged = normalized.gait !== this.config.gait;
    const seedChanged = normalized.seed !== this.config.seed;
    this.config = normalized;
    if (gaitChanged || seedChanged) {
      this.plantController.reset();
      this.poseFilter.reset();
    }
    if (seedChanged) this.phase = resolveInitialHorseGaitPhase(normalized.seed);
    this.physicsConfig = physicsConfig;
    this.avatar.updateConfig(this.config);
    this.ragdoll?.updateConfig(physicsConfig);
    this.applyPose();
  }

  public setGroundSampler(sampleGround?: HorseGroundSampler): void {
    this.sampleGround = sampleGround;
    this.plantController.reset();
    this.poseFilter.reset();
    this.applyPose();
  }

  public reset(): void {
    if (this.disposed) return;
    this.ragdoll?.dispose();
    this.ragdoll = undefined;
    this.plantController.reset();
    this.poseFilter.reset();
    this.phase = resolveInitialHorseGaitPhase(this.config.seed);
    this.elapsedSeconds = 0;
    this.applyPose();
  }

  public getPose(): ProceduralHorsePose {
    return this.pose;
  }

  public getPoseDiagnostics(): ProceduralHorsePoseDiagnostics {
    return resolveProceduralHorsePoseDiagnostics(this.pose, this.object);
  }

  public getStats(): ProceduralHorseAvatarStats {
    return this.avatar.getStats();
  }

  public getPhysicsStats(): JoltRagdollStats {
    return this.ragdoll?.getStats() ?? EMPTY_RAGDOLL_STATS;
  }

  public async startRagdoll(): Promise<void> {
    if (this.disposed || this.ragdoll) return;
    if (!this.physicsWorld) throw new Error("Horse ragdoll requires a shared Jolt physics world");
    this.ragdoll = JoltHorseRagdoll.create(
      this.physicsWorld,
      this.avatar.rig,
      this.pose,
      this.physicsConfig,
      this.object,
    );
    this.syncRagdollToAvatar();
  }

  public async applyImpulse(): Promise<void> {
    await this.startRagdoll();
    this.ragdoll?.applyConfiguredImpulse();
  }

  public hasFiniteState(): boolean {
    return (
      isProceduralHorsePoseFinite(this.pose) &&
      this.avatar.hasFiniteTransforms() &&
      (this.ragdoll?.hasFiniteTransforms() ?? true)
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ragdoll?.dispose();
    this.ragdoll = undefined;
    this.avatar.dispose();
    this.release(this);
  }

  private applyPose(beginPlantFrame = true, deltaSeconds = 1 / 60): void {
    if (this.ragdoll) return;
    if (beginPlantFrame) this.plantController.beginFrame(this.object);
    this.pose = this.poseFilter.apply(
      resolveProceduralHorsePose(
        this.avatar.rig,
        this.config,
        this.phase,
        this.elapsedSeconds,
        this.sampleGround,
        this.plantController.resolveTarget,
      ),
      deltaSeconds,
      this.config.secondaryMotion,
    );
    this.avatar.applyPose(this.pose);
  }

  private syncRagdollToAvatar(): void {
    const ragdoll = this.ragdoll;
    if (!ragdoll) return;
    this.object.updateWorldMatrix(true, false);
    this.object.getWorldQuaternion(this.scratchInverseWorldQuaternion).invert();
    const segments = {} as Record<HorseLegSegmentId, ProceduralHorsePhysicsPose["segments"][HorseLegSegmentId]>;
    let bodyPosition: readonly [number, number, number] = this.avatar.rig.bodyCenter;
    let bodyQuaternion: readonly [number, number, number, number] = [0, 0, 0, 1];
    ragdoll.writePartTransforms((partId, x, y, z, qx, qy, qz, qw) => {
      this.scratchWorldPosition.set(x, y, z);
      this.scratchLocalPosition.copy(this.scratchWorldPosition);
      this.object.worldToLocal(this.scratchLocalPosition);
      this.scratchWorldQuaternion.set(qx, qy, qz, qw);
      this.scratchLocalQuaternion
        .copy(this.scratchWorldQuaternion)
        .premultiply(this.scratchInverseWorldQuaternion)
        .normalize();
      const position = toVectorTuple(this.scratchLocalPosition);
      const quaternion = toQuaternionTuple(this.scratchLocalQuaternion);
      if (partId === HORSE_RAGDOLL_BODY_IDS[0]) {
        bodyPosition = position;
        bodyQuaternion = quaternion;
        return;
      }
      if (isHorseLegSegmentId(partId)) {
        segments[partId] = { length: ragdoll.profile.segmentLengths[partId], position, quaternion };
      }
    });
    if (HORSE_LEG_SEGMENT_IDS.some((segmentId) => !segments[segmentId])) return;
    this.avatar.applyPhysicsPose({ bodyPosition, bodyQuaternion, segments });
  }
}

const EMPTY_RAGDOLL_STATS: JoltRagdollStats = {
  activeBodyCount: 0,
  bodyCount: 0,
  constraintCount: 0,
  wasmHeapBytes: 0,
};

function isHorseLegSegmentId(partId: HorseRagdollPartId): partId is HorseLegSegmentId {
  return (HORSE_LEG_SEGMENT_IDS as readonly string[]).includes(partId);
}

function toVectorTuple(vector: Vector3): readonly [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function toQuaternionTuple(quaternion: Quaternion): readonly [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function resolveDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(0, value), 0.1) : 0;
}
