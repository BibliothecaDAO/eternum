import { Quaternion, Vector3, type Group } from "three";

import {
  normalizeProceduralReaction,
  type ProceduralUnitImpact,
  type ProceduralUnitReactionInput,
} from "../collision/procedural-impact";
import { ProceduralBoatAvatar } from "./procedural-boat-avatar";
import {
  advanceProceduralBoatBroadside,
  cancelProceduralBoatBroadside,
  createIdleProceduralBoatBroadsideState,
  resolveProceduralBoatBroadsideSignals,
  startProceduralBoatBroadside,
  type ProceduralBoatBroadsidePhase,
  type ProceduralBoatBroadsideSide,
} from "./procedural-boat-broadside-cycle";
import { applyProceduralBoatConfigPatch, type ProceduralBoatConfig } from "./procedural-boat-config";
import {
  resolveProceduralBoatMotion,
  type ProceduralBoatMotionPose,
  type ProceduralBoatSinkState,
} from "./procedural-boat-motion";
import { QuaterniusPirateShipLibrary } from "./quaternius-pirate-ship-assets";

export interface ProceduralBoatReleaseEvent {
  generation: number;
  origins: readonly Vector3[];
  seed: number;
  side: ProceduralBoatBroadsideSide;
  target: Vector3;
}

export interface ProceduralBoatActorStats {
  assetId: string;
  assetLabel: string;
  authoredClipCount: number;
  broadsidePhase: ProceduralBoatBroadsidePhase;
  heave: number;
  meshCount: number;
  pitchDegrees: number;
  releaseCount: number;
  rollDegrees: number;
  sinkProgress: number;
  wakeStrength: number;
}

export interface ProceduralBoatActor {
  readonly mode: "animated" | "sinking";
  readonly object: Group;

  applyImpact(impact: ProceduralUnitImpact): Promise<void>;
  applyImpulse(): Promise<void>;
  applyReaction(reaction: ProceduralUnitReactionInput): void;
  attack(targetWorld: Readonly<Vector3>): boolean;
  cancelAttack(): void;
  dispose(): void;
  getStats(): ProceduralBoatActorStats;
  hasFiniteState(): boolean;
  onRelease(listener: (event: ProceduralBoatReleaseEvent) => void): () => void;
  reset(): void;
  setTarget(targetWorld?: Readonly<Vector3>): void;
  startSinking(side?: ProceduralBoatBroadsideSide): Promise<void>;
  stepOnce(): void;
  update(deltaSeconds: number): void;
  updateConfig(config: ProceduralBoatConfig): void;
}

export class ProceduralBoatRuntime {
  private readonly actors = new Set<RuntimeProceduralBoatActor>();
  private disposed = false;

  private constructor(private readonly library: QuaterniusPirateShipLibrary) {}

  public static async create(): Promise<ProceduralBoatRuntime> {
    return new ProceduralBoatRuntime(await QuaterniusPirateShipLibrary.load());
  }

  public createActor(config: ProceduralBoatConfig): ProceduralBoatActor {
    if (this.disposed) throw new Error("Cannot create a boat from a disposed procedural boat runtime");
    const actor = new RuntimeProceduralBoatActor(this.library.instantiate(), config, (disposedActor) => {
      this.actors.delete(disposedActor);
    });
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

class RuntimeProceduralBoatActor implements ProceduralBoatActor {
  public readonly object: Group;

  private readonly avatar: ProceduralBoatAvatar;
  private readonly releaseListeners = new Set<(event: ProceduralBoatReleaseEvent) => void>();
  private readonly targetWorld = new Vector3();
  private readonly targetLocal = new Vector3();
  private readonly muzzleOrigins: Vector3[] = [];
  private readonly inverseWorldQuaternion = new Quaternion();
  private readonly reactionDirection = new Vector3();
  private config: ProceduralBoatConfig;
  private broadside = createIdleProceduralBoatBroadsideState();
  private pose: ProceduralBoatMotionPose;
  private sink?: ProceduralBoatSinkState;
  private elapsedSeconds = 0;
  private contactRoll = 0;
  private hasTarget = false;
  private disposed = false;

  public constructor(
    asset: ConstructorParameters<typeof ProceduralBoatAvatar>[0],
    config: ProceduralBoatConfig,
    private readonly release: (actor: RuntimeProceduralBoatActor) => void,
  ) {
    this.config = applyProceduralBoatConfigPatch(config, {});
    this.avatar = new ProceduralBoatAvatar(asset, this.config);
    this.object = this.avatar.group;
    this.pose = resolveProceduralBoatMotion(
      this.config,
      0,
      resolveProceduralBoatBroadsideSignals(this.broadside, this.config),
      this.broadside.side,
    );
    this.avatar.applyPose(this.pose, this.broadside.side);
  }

  public get mode(): "animated" | "sinking" {
    return this.sink ? "sinking" : "animated";
  }

  public update(deltaSeconds: number): void {
    if (this.disposed) return;
    const elapsed = normalizeDeltaSeconds(deltaSeconds);
    this.elapsedSeconds += elapsed;
    if (this.sink) this.sink.elapsedSeconds += elapsed;
    this.contactRoll *= Math.exp(-5.5 * elapsed);
    const autoSide = this.hasTarget ? this.resolveTargetSide() : undefined;
    if (!this.sink) {
      const advanced = advanceProceduralBoatBroadside(this.broadside, this.config, elapsed, autoSide);
      this.broadside = advanced.state;
      advanced.events.forEach((event) => {
        if (event.type === "release") this.emitRelease(event.generation, event.side);
      });
    }
    this.applyPose();
  }

  public stepOnce(): void {
    this.update(1 / 60);
  }

  public updateConfig(config: ProceduralBoatConfig): void {
    if (this.disposed) return;
    this.config = applyProceduralBoatConfigPatch(this.config, config);
    this.avatar.updateConfig(this.config);
    this.applyPose();
  }

  public setTarget(targetWorld?: Readonly<Vector3>): void {
    this.hasTarget = Boolean(targetWorld);
    if (targetWorld) this.targetWorld.copy(targetWorld);
  }

  public attack(targetWorld: Readonly<Vector3>): boolean {
    if (this.disposed || this.sink || this.broadside.phase !== "idle") return false;
    this.setTarget(targetWorld);
    this.broadside = startProceduralBoatBroadside(this.broadside, this.resolveTargetSide());
    return true;
  }

  public cancelAttack(): void {
    this.broadside = cancelProceduralBoatBroadside(this.broadside);
  }

  public applyReaction(reaction: ProceduralUnitReactionInput): void {
    if (this.disposed || this.sink) return;
    const normalized = normalizeProceduralReaction(reaction);
    this.object.updateWorldMatrix(true, false);
    this.object.getWorldQuaternion(this.inverseWorldQuaternion).invert();
    this.reactionDirection
      .set(normalized.directionX, normalized.directionY, normalized.directionZ)
      .applyQuaternion(this.inverseWorldQuaternion);
    this.contactRoll = Math.max(-0.18, Math.min(0.18, -this.reactionDirection.x * normalized.strength * 0.012));
  }

  public applyImpact(impact: ProceduralUnitImpact): Promise<void> {
    this.targetLocal.set(impact.pointX, impact.pointY, impact.pointZ);
    this.object.worldToLocal(this.targetLocal);
    return this.startSinking(this.targetLocal.x < 0 ? "port" : "starboard");
  }

  public applyImpulse(): Promise<void> {
    return this.startSinking(this.config.seed % 2 === 0 ? "port" : "starboard");
  }

  public startSinking(side: ProceduralBoatBroadsideSide = "starboard"): Promise<void> {
    if (this.disposed || this.sink) return Promise.resolve();
    this.cancelAttack();
    this.sink = { elapsedSeconds: 0, side };
    this.applyPose();
    return Promise.resolve();
  }

  public onRelease(listener: (event: ProceduralBoatReleaseEvent) => void): () => void {
    this.releaseListeners.add(listener);
    return () => this.releaseListeners.delete(listener);
  }

  public reset(): void {
    if (this.disposed) return;
    this.broadside = createIdleProceduralBoatBroadsideState();
    this.sink = undefined;
    this.elapsedSeconds = 0;
    this.contactRoll = 0;
    this.applyPose();
  }

  public getStats(): ProceduralBoatActorStats {
    const avatar = this.avatar.getStats();
    return {
      ...avatar,
      broadsidePhase: this.broadside.phase,
      heave: round(this.pose.heave),
      pitchDegrees: round((this.pose.pitchRadians * 180) / Math.PI),
      releaseCount: this.broadside.releaseCount,
      rollDegrees: round((this.pose.rollRadians * 180) / Math.PI),
      sinkProgress: round(this.pose.sinkProgress),
      wakeStrength: round(this.pose.wakeStrength),
    };
  }

  public hasFiniteState(): boolean {
    return this.avatar.hasFiniteState() && Object.values(this.pose).every(Number.isFinite);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.releaseListeners.clear();
    this.avatar.dispose();
    this.release(this);
  }

  private resolveTargetSide(): ProceduralBoatBroadsideSide {
    this.targetLocal.copy(this.targetWorld);
    this.object.worldToLocal(this.targetLocal);
    return this.targetLocal.x < 0 ? "port" : "starboard";
  }

  private emitRelease(generation: number, side: ProceduralBoatBroadsideSide): void {
    if (!this.hasTarget) return;
    this.avatar.writeMuzzleWorldPositions(side, this.config.broadsideCannons, this.muzzleOrigins);
    const event: ProceduralBoatReleaseEvent = {
      generation,
      origins: this.muzzleOrigins.map((origin) => origin.clone()),
      seed: (this.config.seed ^ generation ^ (side === "port" ? 0x51f15e : 0xa17b0a)) >>> 0,
      side,
      target: this.targetWorld.clone(),
    };
    this.releaseListeners.forEach((listener) => listener(event));
  }

  private applyPose(): void {
    this.pose = resolveProceduralBoatMotion(
      this.config,
      this.elapsedSeconds,
      resolveProceduralBoatBroadsideSignals(this.broadside, this.config),
      this.broadside.side,
      this.sink,
      this.contactRoll,
    );
    this.avatar.applyPose(this.pose, this.broadside.side);
  }
}

function normalizeDeltaSeconds(value: number): number {
  return Number.isFinite(value) ? Math.min(0.1, Math.max(0, value)) : 0;
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
