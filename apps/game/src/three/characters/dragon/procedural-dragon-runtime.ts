import { Group, Quaternion, Vector3 } from "three";

import {
  ProceduralContactReactionController,
  type ProceduralContactReactionPose,
} from "../collision/procedural-contact-reaction";
import type { ProceduralUnitReactionInput } from "../collision/procedural-impact";
import { normalizeProceduralImpact, type ProceduralUnitImpact } from "../collision/procedural-impact";
import type { JoltRagdollStats } from "../jolt-ragdoll-world";
import type { HorseGroundSampler } from "../horse/procedural-horse-pose";
import { ProceduralDragonAvatar, type ProceduralDragonAvatarStats } from "./procedural-dragon-avatar";
import { applyProceduralDragonConfigPatch, type ProceduralDragonConfig } from "./procedural-dragon-config";
import { IcyDragonLibrary, loadIcyDragonLibrary } from "./icy-dragon-assets";
import {
  advanceProceduralDragonFire,
  cancelProceduralDragonFire,
  createIdleProceduralDragonFireState,
  resolveProceduralDragonFireSignals,
  startProceduralDragonFire,
  type ProceduralDragonFirePhase,
  type ProceduralDragonFireState,
} from "./procedural-dragon-fire-cycle";
import {
  isProceduralDragonPoseFinite,
  resolveProceduralDragonPose,
  type ProceduralDragonPose,
} from "./procedural-dragon-pose";

export interface ProceduralDragonFireRelease {
  direction: Vector3;
  generation: number;
  origin: Vector3;
  target: Vector3;
}

export type ProceduralDragonFlightState = "flying" | "landed" | "landing" | "taking-off";

export interface ProceduralDragonPoseDiagnostics {
  altitude: number;
  contactCount: number;
  firePhase: ProceduralDragonFirePhase;
  flightState: ProceduralDragonFlightState;
  issues: readonly string[];
  locomotionMode: ProceduralDragonConfig["locomotionMode"];
  mouthWorld: readonly [number, number, number];
  saddleWorld: readonly [number, number, number];
}

export interface ProceduralDragonActor {
  readonly mode: "animated" | "ragdoll";
  readonly object: Group;

  applyImpact(impact: ProceduralUnitImpact): Promise<void>;
  applyImpulse(): Promise<void>;
  applyReaction(reaction: ProceduralUnitReactionInput): void;
  cancelFire(): void;
  dispose(): void;
  fireAt(targetWorld: Readonly<Vector3>): boolean;
  getPhysicsStats(): JoltRagdollStats;
  getPose(): ProceduralDragonPose;
  getPoseDiagnostics(): ProceduralDragonPoseDiagnostics;
  getStats(): ProceduralDragonAvatarStats & { firePhase: ProceduralDragonFirePhase; releaseCount: number };
  hasFiniteState(): boolean;
  onFireRelease(listener: (event: ProceduralDragonFireRelease) => void): () => void;
  reset(): void;
  setFireTarget(targetWorld?: Readonly<Vector3>): void;
  setGroundSampler(sampleGround?: HorseGroundSampler): void;
  startRagdoll(): Promise<void>;
  stepOnce(): void;
  update(deltaSeconds: number): void;
  updateConfig(config: ProceduralDragonConfig): void;
}

export class ProceduralDragonRuntime {
  private readonly actors = new Set<RuntimeProceduralDragonActor>();
  private disposed = false;

  private constructor(private readonly library: IcyDragonLibrary) {}

  public static async create(library?: IcyDragonLibrary): Promise<ProceduralDragonRuntime> {
    return new ProceduralDragonRuntime(library ?? (await loadIcyDragonLibrary()));
  }

  public createActor(config: ProceduralDragonConfig): ProceduralDragonActor {
    if (this.disposed) throw new Error("Cannot create a dragon from a disposed procedural dragon runtime");
    const actor = new RuntimeProceduralDragonActor(config, this.library.instantiate(), (disposedActor) =>
      this.actors.delete(disposedActor),
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

class RuntimeProceduralDragonActor implements ProceduralDragonActor {
  public readonly object = new Group();

  private readonly avatar: ProceduralDragonAvatar;
  private readonly fireListeners = new Set<(event: ProceduralDragonFireRelease) => void>();
  private readonly reactionController = new ProceduralContactReactionController();
  private readonly targetWorld = new Vector3();
  private readonly targetLocal = new Vector3();
  private readonly mouthWorld = new Vector3();
  private readonly mouthQuaternion = new Quaternion();
  private readonly releaseDirection = new Vector3();
  private config: ProceduralDragonConfig;
  private fireState: ProceduralDragonFireState = createIdleProceduralDragonFireState();
  private pose: ProceduralDragonPose;
  private phase = 0;
  private flightBlend = 0;
  private elapsedSeconds = 0;
  private ragdollElapsedSeconds?: number;
  private reactionPose?: ProceduralContactReactionPose;
  private sampleGround?: HorseGroundSampler;
  private hasTarget = false;
  private disposed = false;

  public constructor(
    config: ProceduralDragonConfig,
    asset: ReturnType<IcyDragonLibrary["instantiate"]>,
    private readonly release: (actor: RuntimeProceduralDragonActor) => void,
  ) {
    this.config = applyProceduralDragonConfigPatch(config, {});
    this.phase = resolveInitialPhase(this.config.seed);
    this.flightBlend = resolveRequestedFlightBlend(this.config);
    this.object.name = "procedural-dragon-actor";
    this.avatar = new ProceduralDragonAvatar(this.config, asset);
    this.object.add(this.avatar.group);
    this.pose = this.resolvePose();
    this.avatar.applyPose(this.pose);
  }

  public get mode(): "animated" | "ragdoll" {
    return this.ragdollElapsedSeconds === undefined ? "animated" : "ragdoll";
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = normalizeDelta(deltaSeconds);
    if (this.ragdollElapsedSeconds !== undefined) {
      this.ragdollElapsedSeconds += elapsed;
      this.avatar.applyRagdollFall(1 - Math.exp(-this.ragdollElapsedSeconds * 2.8));
      return;
    }
    this.elapsedSeconds += elapsed;
    this.reactionPose = this.reactionController.update(elapsed);
    this.flightBlend = advanceFlightBlend(this.flightBlend, this.config, elapsed);
    this.phase = wrapUnit(this.phase + elapsed * resolvePhaseRate(this.config));
    const advanced = advanceProceduralDragonFire(this.fireState, this.config, elapsed);
    this.fireState = advanced.state;
    this.pose = this.resolvePose();
    this.avatar.applyPose(this.pose);
    advanced.events.forEach((event) => {
      if (event.type === "release") this.emitFireRelease(event.generation);
    });
  }

  public stepOnce(): void {
    this.update(1 / 60);
  }

  public updateConfig(config: ProceduralDragonConfig): void {
    if (this.disposed) return;
    const normalized = applyProceduralDragonConfigPatch(this.config, config);
    if (normalized.seed !== this.config.seed) this.phase = resolveInitialPhase(normalized.seed);
    this.config = normalized;
    this.avatar.updateConfig(normalized);
    this.applyPose();
  }

  public fireAt(targetWorld: Readonly<Vector3>): boolean {
    if (this.disposed || this.mode !== "animated" || this.fireState.phase !== "idle") return false;
    this.setFireTarget(targetWorld);
    this.fireState = startProceduralDragonFire(this.fireState);
    this.applyPose();
    return true;
  }

  public setFireTarget(targetWorld?: Readonly<Vector3>): void {
    this.hasTarget = Boolean(targetWorld);
    if (targetWorld) this.targetWorld.copy(targetWorld);
  }

  public cancelFire(): void {
    this.fireState = cancelProceduralDragonFire(this.fireState);
  }

  public onFireRelease(listener: (event: ProceduralDragonFireRelease) => void): () => void {
    this.fireListeners.add(listener);
    return () => this.fireListeners.delete(listener);
  }

  public setGroundSampler(sampleGround?: HorseGroundSampler): void {
    this.sampleGround = sampleGround;
    this.applyPose();
  }

  public reset(): void {
    if (this.disposed) return;
    this.fireState = createIdleProceduralDragonFireState();
    this.phase = resolveInitialPhase(this.config.seed);
    this.flightBlend = resolveRequestedFlightBlend(this.config);
    this.elapsedSeconds = 0;
    this.ragdollElapsedSeconds = undefined;
    this.reactionController.reset();
    this.reactionPose = undefined;
    this.avatar.resetRagdollTransform();
    this.applyPose();
  }

  public async startRagdoll(): Promise<void> {
    if (this.disposed || this.ragdollElapsedSeconds !== undefined) return;
    this.fireState = { ...this.fireState, phase: "idle", phaseElapsedSeconds: 0 };
    this.ragdollElapsedSeconds = 0;
    this.avatar.applyRagdollFall(0);
  }

  public async applyImpulse(): Promise<void> {
    await this.startRagdoll();
  }

  public async applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    normalizeProceduralImpact(impact);
    await this.startRagdoll();
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    if (this.disposed || this.mode !== "animated") return;
    this.reactionController.trigger({
      localDirectionX: reaction.directionX,
      localDirectionY: reaction.directionY,
      localDirectionZ: reaction.directionZ,
      source: reaction.source,
      strength: reaction.strength,
    });
    this.reactionPose = this.reactionController.getPose();
    this.applyPose();
  }

  public getPose(): ProceduralDragonPose {
    return this.pose;
  }

  public getPoseDiagnostics(): ProceduralDragonPoseDiagnostics {
    const saddleWorld = new Vector3(...this.pose.saddlePosition);
    this.object.localToWorld(saddleWorld);
    this.avatar.writeMouthWorldPosition(this.mouthWorld);
    const flightState = resolveFlightState(this.flightBlend, this.config);
    const issues: string[] = [];
    if (!isProceduralDragonPoseFinite(this.pose) || !this.avatar.hasFiniteTransforms()) {
      issues.push("dragon-non-finite-state");
    }
    if (this.pose.fireIntensity < 0 || this.pose.fireIntensity > 1) issues.push("dragon-fire-intensity-out-of-range");
    if (flightState === "flying" && this.pose.contactCount !== 0) {
      issues.push("flying-dragon-has-ground-contact");
    }
    return {
      altitude: this.pose.bodyPosition[1],
      contactCount: this.pose.contactCount,
      firePhase: this.fireState.phase,
      flightState,
      issues,
      locomotionMode: this.config.locomotionMode,
      mouthWorld: toTuple(this.mouthWorld),
      saddleWorld: toTuple(saddleWorld),
    };
  }

  public getStats() {
    return {
      ...this.avatar.getStats(),
      firePhase: this.fireState.phase,
      releaseCount: this.fireState.releaseCount,
    };
  }

  public getPhysicsStats(): JoltRagdollStats {
    return EMPTY_RAGDOLL_STATS;
  }

  public hasFiniteState(): boolean {
    return isProceduralDragonPoseFinite(this.pose) && this.avatar.hasFiniteTransforms();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fireListeners.clear();
    this.avatar.dispose();
    this.object.clear();
    this.object.removeFromParent();
    this.release(this);
  }

  private applyPose(): void {
    if (this.ragdollElapsedSeconds !== undefined) return;
    this.pose = this.resolvePose();
    this.avatar.applyPose(this.pose);
  }

  private resolvePose(): ProceduralDragonPose {
    if (this.hasTarget) {
      this.targetLocal.copy(this.targetWorld);
      this.object.updateWorldMatrix(true, false);
      this.object.worldToLocal(this.targetLocal);
    }
    return resolveProceduralDragonPose({
      config: this.config,
      elapsedSeconds: this.elapsedSeconds,
      firePhase: this.fireState.phase,
      fireSignals: resolveProceduralDragonFireSignals(this.fireState, this.config),
      flightBlend: this.flightBlend,
      phase: this.phase,
      reaction: this.reactionPose,
      sampleGround: this.sampleGround,
      targetLocal: this.hasTarget ? toTuple(this.targetLocal) : undefined,
    });
  }

  private emitFireRelease(generation: number): void {
    this.avatar.writeMouthWorldPosition(this.mouthWorld);
    this.avatar.writeMouthWorldQuaternion(this.mouthQuaternion);
    const target = this.hasTarget
      ? this.targetWorld.clone()
      : this.releaseDirection
          .set(0, 0, this.config.fireRange)
          .applyQuaternion(this.mouthQuaternion)
          .add(this.mouthWorld)
          .clone();
    this.releaseDirection.copy(target).sub(this.mouthWorld);
    if (this.releaseDirection.lengthSq() < 1e-8)
      this.releaseDirection.set(0, 0, 1).applyQuaternion(this.mouthQuaternion);
    else this.releaseDirection.normalize();
    const event: ProceduralDragonFireRelease = {
      direction: this.releaseDirection.clone(),
      generation,
      origin: this.mouthWorld.clone(),
      target,
    };
    this.fireListeners.forEach((listener) => listener(event));
  }
}

const EMPTY_RAGDOLL_STATS: JoltRagdollStats = {
  activeBodyCount: 0,
  bodyCount: 0,
  constraintCount: 0,
  wasmHeapBytes: 0,
};

function resolvePhaseRate(config: ProceduralDragonConfig): number {
  if (config.locomotionMode === "flight") return config.wingBeatHz;
  if (config.locomotionMode === "walk") return config.speed / Math.max(0.4, 2.1 * config.strideScale);
  return 0.18;
}

const TAKEOFF_SECONDS = 0.9;
const LANDING_SECONDS = 1.1;

function advanceFlightBlend(current: number, config: ProceduralDragonConfig, deltaSeconds: number): number {
  const target = resolveRequestedFlightBlend(config);
  const duration = target > current ? TAKEOFF_SECONDS : LANDING_SECONDS;
  const maximumDelta = deltaSeconds / duration;
  if (Math.abs(target - current) <= maximumDelta) return target;
  return current + Math.sign(target - current) * maximumDelta;
}

function resolveRequestedFlightBlend(config: ProceduralDragonConfig): number {
  return config.locomotionMode === "flight" ? 1 : 0;
}

function resolveFlightState(blend: number, config: ProceduralDragonConfig): ProceduralDragonFlightState {
  if (config.locomotionMode === "flight") return blend >= 1 - 1e-4 ? "flying" : "taking-off";
  return blend <= 1e-4 ? "landed" : "landing";
}

function resolveInitialPhase(seed: number): number {
  return ((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 10_000) / 10_000;
}

function toTuple(vector: Readonly<Vector3>): readonly [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function normalizeDelta(value: number): number {
  return Number.isFinite(value) ? Math.min(0.1, Math.max(0, value)) : 0;
}

function wrapUnit(value: number): number {
  return ((value % 1) + 1) % 1;
}
